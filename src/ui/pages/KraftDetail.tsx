import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, addDoc, collection, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Navigation from "../components/navigation/Navigation";
import SketchThumbnail from "../components/sketch/Sketchthumbnail";
import { AVAILABLE_TAGS, SketchEditor } from "./ExerciseDetail";
import type { Exercise } from "../../types/Exercise";
import type { SketchData } from "../../types/Sketch";
import db from "../../firebase";
import { useAuth } from "../../auth/authContext";
import { useGetUserData } from "../../hooks/useGetUserData";

const WORK_SECONDS = 50;
const REST_SECONDS = 10;

type Phase = "overview" | "work" | "rest" | "done";

const parseItems = (description: string): string[] =>
  description
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const KraftDetail = ({ exercise: initialExercise }: { exercise: Exercise }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");
  const userTeam = (userData as any)?.team ?? "";
  const currentUid = getAuth().currentUser?.uid ?? "";

  const [exercise, setExercise] = useState(initialExercise);
  const items = parseItems(exercise.description ?? "");

  const [phase, setPhase] = useState<Phase>("overview");
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);

  // ── Edit info ──────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Exercise>>({});

  // ── Edit sketch ────────────────────────────────────────────────────────────
  const [editingSketch, setEditingSketch] = useState(false);
  const [editSketch, setEditSketch] = useState<SketchData | undefined>(undefined);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/beep.mp3");
  }, []);

  const playBeep = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // ── Tick — only ever decrements `seconds`. No other state is touched here.
  // (Calling setState from inside another setState's updater function is an
  // anti-pattern: React's StrictMode double-invokes updater functions in dev
  // to check for side effects, which would fire any nested setState calls
  // twice — e.g. double-incrementing the exercise index. Keeping the tick
  // pure and handling phase transitions in a separate effect below avoids
  // that entirely.) ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return clearTimer;
  }, [running]);

  // ── Zero-crossing — fires exactly once per countdown reaching 0 ───────────
  useEffect(() => {
    if (seconds !== 0 || !running) return;
    clearTimer();
    setRunning(false);
    playBeep();
    if (phase === "work") {
      setPhase(index + 1 >= items.length ? "done" : "rest");
    } else if (phase === "rest") {
      setIndex((i) => i + 1);
      setPhase("work");
    }
  }, [seconds, running, phase, index, items.length]);

  // ── Whenever a new phase starts, (re)initialize its timer ─────────────────
  useEffect(() => {
    if (phase === "work") {
      setSeconds(WORK_SECONDS);
      setRunning(false);
    } else if (phase === "rest") {
      setSeconds(REST_SECONDS);
      setRunning(true);
    } else if (phase === "done") {
      setRunning(false);
    }
  }, [phase]);

  const startKraft = () => {
    setIndex(0);
    setPhase("work");
  };

  const handleStart = () => {
    playBeep();
    setRunning(true);
  };
  const handlePause = () => setRunning(false);
  const handleReset = () => {
    setRunning(false);
    setSeconds(WORK_SECONDS);
  };

  const handleNext = () => {
    clearTimer();
    if (index + 1 >= items.length) {
      setPhase("done");
    } else {
      setPhase("rest");
    }
  };

  const handleStop = () => {
    clearTimer();
    setRunning(false);
    setPhase("overview");
  };

  // ── Fork helper — same pattern as ExerciseDetail ───────────────────────────
  const forkIfNeeded = async (): Promise<string> => {
    const exTeam = (exercise as any).team;
    const teams: string[] = Array.isArray(exTeam) ? exTeam : exTeam ? [exTeam] : [];
    const isOwner =
      (teams.length === 1 && teams[0] === userTeam) ||
      (exercise as any).createdBy === currentUid;
    if (isOwner) return exercise.id;
    const { id: _id, ...exerciseData } = exercise as any;
    const forkRef = await addDoc(collection(db, "Excercises"), {
      ...exerciseData,
      team: userTeam ? [userTeam] : teams,
      forkedFrom: exercise.id,
      createdBy: currentUid,
      createdAt: Timestamp.now(),
    });
    return forkRef.id;
  };

  // ── Edit info handlers ─────────────────────────────────────────────────────
  const handleEditStart = () => {
    setEditData({
      title: exercise.title,
      description: exercise.description,
      difficulty: exercise.difficulty,
      tags: exercise.tags ?? [],
    });
    setEditing(true);
  };
  const handleEditCancel = () => {
    setEditing(false);
    setEditData({});
  };
  const handleEditChange = (field: keyof Exercise, value: unknown) =>
    setEditData((prev) => ({ ...prev, [field]: value }));
  const handleTagToggle = (tag: string) => {
    const current = editData.tags ?? [];
    handleEditChange(
      "tags",
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const targetId = await forkIfNeeded();
      const isForked = targetId !== exercise.id;
      await updateDoc(doc(db, "Excercises", targetId), {
        title: editData.title ?? exercise.title,
        description: editData.description ?? exercise.description,
        difficulty: editData.difficulty ?? exercise.difficulty,
        tags: editData.tags ?? exercise.tags,
      });
      setEditing(false);
      setEditData({});
      if (isForked) {
        navigate(`/exercise-detail/${targetId}`, { replace: true });
      } else {
        setExercise((prev) => ({ ...prev, ...editData }) as Exercise);
      }
    } catch (e) {
      console.error("Error updating Kraft exercise:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit sketch handlers ───────────────────────────────────────────────────
  const handleEditSketchStart = () => {
    setEditSketch(exercise.sketch);
    setEditingSketch(true);
  };
  const handleEditSketchCancel = () => {
    setEditingSketch(false);
    setEditSketch(undefined);
  };
  const handleSaveSketch = async () => {
    if (!editSketch) return;
    setSaving(true);
    try {
      const targetId = await forkIfNeeded();
      const isForked = targetId !== exercise.id;
      await updateDoc(doc(db, "Excercises", targetId), { sketch: editSketch });
      setEditingSketch(false);
      setEditSketch(undefined);
      if (isForked) {
        navigate(`/exercise-detail/${targetId}`, { replace: true });
      } else {
        setExercise((prev) => ({ ...prev, sketch: editSketch }));
      }
    } catch (e) {
      console.error("Error updating sketch:", e);
    } finally {
      setSaving(false);
    }
  };

  const currentTitle = items[index] ?? exercise.title;
  const isLast = index + 1 >= items.length;

  return (
    <>
      <Navigation />
      <div className="kraftdetail section">
        <div className="kraftdetail__inner">
          {phase === "overview" && (
            <>
              <div className="kraftdetail__back">
                <button className="btn__wired" onClick={() => navigate(-1)}>
                  <svg width="23" height="12" viewBox="0 0 23 12" fill="none">
                    <path
                      d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                      fill="black"
                    />
                  </svg>
                  Back
                </button>
              </div>

              <div className="kraftdetail__layout">
                <div className="kraftdetail__info">
                  {!editing && (
                    <div className="kraftdetail__actions">
                      <button className="btn__wired" onClick={handleEditStart}>
                        Edit
                      </button>
                    </div>
                  )}

                  {editing ? (
                    <input
                      className="exercisedetail__edit__input exercisedetail__edit__input--title"
                      value={editData.title ?? ""}
                      onChange={(e) => handleEditChange("title", e.target.value)}
                      placeholder="Exercise title"
                    />
                  ) : (
                    <h1 className="kraftdetail__title">{exercise.title}</h1>
                  )}

                  {editing ? (
                    <div className="kraftdetail__edit__difficulty">
                      <label>Difficulty</label>
                      <div className="exercisedetail__edit__difficulty__btns">
                        {[1, 2, 3, 4, 5].map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={`exercisedetail__edit__difficulty__btn ${(editData.difficulty ?? exercise.difficulty) === d ? "exercisedetail__edit__difficulty__btn--active" : ""}`}
                            onClick={() => handleEditChange("difficulty", d)}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`difficulty difficulty--${exercise.difficulty}`}
                    >
                      <span>Level {exercise.difficulty}</span>
                    </div>
                  )}

                  <div className="kraftdetail__tags">
                    {editing ? (
                      <div className="exercisedetail__edit__tags">
                        {AVAILABLE_TAGS.map((tag) => (
                          <label
                            key={tag}
                            className={[
                              "tags",
                              `tags--${tag.toLowerCase()}`,
                              (editData.tags ?? []).includes(tag)
                                ? `tags--${tag.toLowerCase()}--active`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{ cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              style={{ display: "none" }}
                              checked={(editData.tags ?? []).includes(tag)}
                              onChange={() => handleTagToggle(tag)}
                            />
                            {tag}
                          </label>
                        ))}
                      </div>
                    ) : (
                      (exercise.tags ?? []).map((tag) => (
                        <span key={tag} className={`tags tags--${tag.toLowerCase()}`}>
                          {tag}
                        </span>
                      ))
                    )}
                  </div>

                  {editing ? (
                    <div className="kraftdetail__edit__list">
                      <label className="kraftdetail__edit__list__label">
                        Exercises (one per line)
                      </label>
                      <textarea
                        className="exercisedetail__edit__input exercisedetail__edit__input--description"
                        value={editData.description ?? ""}
                        onChange={(e) => handleEditChange("description", e.target.value)}
                        placeholder={"Squats\nPush-ups\nPlank"}
                        rows={8}
                      />
                    </div>
                  ) : items.length > 0 ? (
                    <ul className="kraftdetail__list">
                      {items.map((item, i) => (
                        <li key={i} className="kraftdetail__list__item">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="kraftdetail__empty">
                      No exercises listed yet. Add one item per line in the
                      description.
                    </p>
                  )}

                  {editing ? (
                    <div className="kraftdetail__edit__actions">
                      <button className="btn__wired" onClick={handleEditCancel} disabled={saving}>
                        Cancel
                      </button>
                      <button className="btn__primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  ) : (
                    items.length > 0 && (
                      <button className="btn__primary kraftdetail__start" onClick={startKraft}>
                        Start Kraft
                      </button>
                    )
                  )}
                </div>

                <div className="kraftdetail__sketch__panel">
                  {editingSketch ? (
                    // "exercisedetail" class is required here so the shared
                    // .sketch__editor / .sketch__topbar / etc. styles (defined
                    // nested under .exercisedetail in SCSS) actually apply.
                    <div className="exercisedetail kraftdetail__sketch__edit-scope">
                      <SketchEditor sketch={editSketch} onChange={setEditSketch} />
                      <div className="kraftdetail__sketch__edit__actions">
                        <button className="btn__wired" onClick={handleEditSketchCancel} disabled={saving}>
                          Cancel
                        </button>
                        <button className="btn__primary" onClick={handleSaveSketch} disabled={saving}>
                          {saving ? "Saving…" : "Save sketch"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {exercise.sketch ? (
                        <div className="kraftdetail__sketch">
                          <SketchThumbnail sketch={exercise.sketch} />
                        </div>
                      ) : (
                        <div className="kraftdetail__sketch kraftdetail__sketch--empty" />
                      )}
                      {!editing && (
                        <button className="btn__wired" onClick={handleEditSketchStart}>
                          Edit sketch
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {(phase === "work" || phase === "rest") && (
            <div className="kraftdetail__session">
              <span className="kraftdetail__session__progress">
                {index + 1} / {items.length}
              </span>

              <h2 className="kraftdetail__session__title">
                {phase === "rest" ? "Rest" : currentTitle}
              </h2>

              <div
                className={`kraftdetail__session__timer${phase === "rest" ? " kraftdetail__session__timer--rest" : ""}`}
              >
                {seconds}
              </div>

              {phase === "work" ? (
                <>
                  <div className="kraftdetail__session__controls">
                    <button
                      className="btn__primary kraftdetail__icon-btn"
                      onClick={handleStart}
                      disabled={running || seconds === 0}
                      aria-label="Start timer"
                      title="Start timer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                    <button
                      className="btn__wired kraftdetail__icon-btn"
                      onClick={handlePause}
                      disabled={!running}
                      aria-label="Pause timer"
                      title="Pause timer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                      </svg>
                    </button>
                    <button
                      className="btn__wired kraftdetail__icon-btn"
                      onClick={handleReset}
                      aria-label="Reset to 50 seconds"
                      title="Reset to 50 seconds"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 13c0-4.42-3.58-8-8-8zm-6 8c0-1.01.25-1.97.7-2.8L5.24 8.74A7.93 7.93 0 0 0 4 13c0 4.42 3.58 8 8 8v3l5-4-5-4v3c-3.31 0-6-2.69-6-6z" />
                      </svg>
                    </button>
                  </div>

                  <button
                    className="btn__primary kraftdetail__icon-btn kraftdetail__session__next"
                    onClick={handleNext}
                  >
                    {isLast ? "Finish" : "Next exercise"}
                    <svg width="16" height="10" viewBox="0 0 23 12" fill="none">
                      <path
                        d="M1 5.25H0.25V6.75H1V5.25ZM22.5303 6.53C22.8232 6.237 22.8232 5.763 22.5303 5.47L17.757 0.697C17.465 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.939 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.5303 6.53ZM1 6.75H22V5.25H1V6.75Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </>
              ) : (
                <p className="kraftdetail__session__hint">
                  Next up: {items[index + 1]}
                </p>
              )}

              <button
                className="kraftdetail__session__stop"
                onClick={handleStop}
                aria-label="Stop"
                title="Stop"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
                </svg>
              </button>
            </div>
          )}

          {phase === "done" && (
            <div className="kraftdetail__session">
              <h2 className="kraftdetail__session__title">Done! 💪</h2>
              <p className="kraftdetail__session__hint">
                You finished all {items.length} exercises.
              </p>
              <button className="btn__primary kraftdetail__start" onClick={startKraft}>
                Start again
              </button>
              <button
                className="kraftdetail__session__stop"
                onClick={handleStop}
                aria-label="Stop"
                title="Back to overview"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default KraftDetail;
