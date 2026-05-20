import React, { useEffect, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../../../auth/authContext";
import { useGetUserData } from "../../../hooks/useGetUserData";
import db from "../../../firebase";
import SketchThumbnail from "../sketch/Sketchthumbnail";
import withTrainingNavigation from "../../../hoc/withTrainingNavigation";
import type { SketchData } from "../../../types/Sketch";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Exercise {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
  sketch: SketchData;
}

export interface SelectedExercise {
  exerciseId: string;
  title: string;
  duration: number;
}

interface Props {
  totalDuration: number;
  selectedExercises?: SelectedExercise[];
  onChange: (data: { selectedExercises: SelectedExercise[] }) => void;
}

type LightboxStep = "grid" | "duration";

// ─── Drag handle icon ─────────────────────────────────────────────────────────

const DragHandleIcon = () => (
  <svg
    width="16"
    height="14"
    viewBox="0 0 16 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M1 2H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M1 7H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M1 12H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

const ExerciseSelection: React.FC<Props> = ({
  totalDuration = 0,
  selectedExercises = [],
  onChange,
}) => {
  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxStep, setLightboxStep] = useState<LightboxStep>("grid");
  const [pendingExercise, setPendingExercise] = useState<Exercise | null>(null);
  const [pendingDuration, setPendingDuration] = useState<string>("");

  // Search & filter
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const plannedMinutes = selectedExercises.reduce(
    (sum, e) => sum + (e.duration || 0),
    0,
  );

  // ── Fetch exercises (scoped to user's team) ──────────────────────────────
  useEffect(() => {
    if (userData === undefined) return; // wait for profile

    const fetch = async () => {
      try {
        const userTeam = userData?.team ?? "";
        const q = userTeam
          ? query(collection(db, "Excercises"), where("team", "array-contains", userTeam))
          : collection(db, "Excercises");
        const snapshot = await getDocs(q);
        const data: Exercise[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Exercise, "id">),
        }));
        setExercises(data);
      } catch (e) {
        console.error("Error fetching exercises:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userData]);

  const allTags = Array.from(
    new Set(exercises.flatMap((e) => e.tags ?? [])),
  ).sort();

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch =
      search.trim() === "" ||
      ex.title.toLowerCase().includes(search.toLowerCase()) ||
      ex.description?.toLowerCase().includes(search.toLowerCase());
    const matchesTag =
      activeTag === null || (ex.tags ?? []).includes(activeTag);
    return matchesSearch && matchesTag;
  });

  // ── Drag handlers ────────────────────────────────────────────────────────
  const handleDragStart = (index: number) => {
    dragIndex.current = index;
    setDraggingIndex(index);
  };

  const handleDragEnter = (index: number) => {
    dragOverIndex.current = index;
    setDragOverIdx(index);
  };

  const handleDragEnd = () => {
    const from = dragIndex.current;
    const to = dragOverIndex.current;

    if (from !== null && to !== null && from !== to) {
      const reordered = [...selectedExercises];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      onChange({ selectedExercises: reordered });
    }

    dragIndex.current = null;
    dragOverIndex.current = null;
    setDraggingIndex(null);
    setDragOverIdx(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // required to allow drop
  };

  // ── Lightbox handlers ────────────────────────────────────────────────────
  const openLightbox = () => {
    setLightboxStep("grid");
    setPendingExercise(null);
    setPendingDuration("");
    setSearch("");
    setActiveTag(null);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setPendingExercise(null);
    setPendingDuration("");
  };

  const handleSelectExercise = (exercise: Exercise) => {
    setPendingExercise(exercise);
    setPendingDuration("");
    setLightboxStep("duration");
  };

  const handleConfirmDuration = () => {
    if (!pendingExercise) return;
    const duration = Math.max(0, parseInt(pendingDuration) || 0);
    const alreadySelected = selectedExercises.some(
      (e) => e.exerciseId === pendingExercise.id,
    );
    const updated: SelectedExercise[] = alreadySelected
      ? selectedExercises.map((e) =>
          e.exerciseId === pendingExercise.id ? { ...e, duration } : e,
        )
      : [
          ...selectedExercises,
          {
            exerciseId: pendingExercise.id,
            title: pendingExercise.title,
            duration,
          },
        ];
    onChange({ selectedExercises: updated });
    closeLightbox();
  };

  const handleRemove = (exerciseId: string) => {
    onChange({
      selectedExercises: selectedExercises.filter(
        (e) => e.exerciseId !== exerciseId,
      ),
    });
  };

  const handleDurationChange = (exerciseId: string, value: string) => {
    const duration = Math.max(0, parseInt(value) || 0);
    onChange({
      selectedExercises: selectedExercises.map((e) =>
        e.exerciseId === exerciseId ? { ...e, duration } : e,
      ),
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="excercisewizard">
      <h2>Select exercises and set their duration</h2>

      <p
        className={`exerciseSelection__hint ${
          plannedMinutes > totalDuration
            ? "exerciseSelection__hint--over"
            : plannedMinutes === totalDuration && totalDuration > 0
              ? "exerciseSelection__hint--done"
              : ""
        }`}
      >
        Duration planned:{" "}
        <strong>
          {plannedMinutes}/{totalDuration} min
        </strong>
        {plannedMinutes > totalDuration && (
          <span className="exerciseSelection__hint__warning">
            {" "}
            — exceeds by {plannedMinutes - totalDuration} min
          </span>
        )}
      </p>

      {/* ── Selected exercises list ── */}
      <div className="exerciseSelection__selected">
        {selectedExercises.map((sel, index) => (
          <div
            key={sel.exerciseId}
            className={`exerciseSelection__selected__item ${
              draggingIndex === index
                ? "exerciseSelection__selected__item--dragging"
                : ""
            } ${
              dragOverIdx === index && draggingIndex !== index
                ? "exerciseSelection__selected__item--dragover"
                : ""
            }`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
          >
            {/* Drag handle — only this triggers the grab cursor */}
            <div
              className="exerciseSelection__selected__item__handle"
              title="Drag to reorder"
            >
              <DragHandleIcon />
            </div>

            <h3 className="exerciseSelection__selected__item__name">
              {sel.title}
            </h3>

            <div className="exerciseSelection__selected__item__duration">
              <input
                type="number"
                min={0}
                value={sel.duration || ""}
                placeholder="0"
                className="exerciseSelection__selected__item__input"
                onChange={(e) =>
                  handleDurationChange(sel.exerciseId, e.target.value)
                }
                onClick={(e) => e.stopPropagation()}
              />
              <span>min</span>
            </div>

            <button
              className="exerciseSelection__selected__item__remove btn__primary"
              onClick={() => handleRemove(sel.exerciseId)}
              aria-label="Remove exercise"
            >
              ×
            </button>
          </div>
        ))}

        <button
          className="exerciseSelection__add__btn btn__wired"
          onClick={openLightbox}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 1V13M1 7H13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Add exercise
        </button>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div
          className="exerciseSelection__lightbox__overlay"
          onClick={closeLightbox}
        >
          <div
            className="exerciseSelection__lightbox"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="exerciseSelection__lightbox__header">
              <h3>
                {lightboxStep === "grid"
                  ? "Select an exercise"
                  : `Set duration — ${pendingExercise?.title}`}
              </h3>
              <button
                className="exerciseSelection__lightbox__header__close btn__primary"
                onClick={closeLightbox}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Step 1: grid */}
            {lightboxStep === "grid" && (
              <>
                <div className="exerciseSelection__lightbox__toolbar">
                  <div className="exerciseSelection__lightbox__toolbar__search">
                    <input
                      type="text"
                      placeholder="Search exercises..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="exerciseSelection__lightbox__toolbar__search__input"
                      autoFocus
                    />
                  </div>
                  <div className="exerciseSelection__lightbox__toolbar__filter">
                    <button
                      className={`exerciseSelection__lightbox__toolbar__filter__btn exerciseSelection__lightbox__toolbar__filter__btn--all ${
                        activeTag === null
                          ? "exerciseSelection__lightbox__toolbar__filter__btn--active"
                          : ""
                      }`}
                      onClick={() => setActiveTag(null)}
                    >
                      All
                    </button>
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        className={`exerciseSelection__lightbox__toolbar__filter__btn tags--${tag.toLowerCase()} ${
                          activeTag === tag
                            ? "exerciseSelection__lightbox__toolbar__filter__btn--active"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveTag(activeTag === tag ? null : tag)
                        }
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <p className="exerciseSelection__status">Loading...</p>
                ) : filteredExercises.length === 0 ? (
                  <p className="exerciseSelection__status">No exercises found.</p>
                ) : (
                  <div className="exerciseSelection__lightbox__grid">
                    {filteredExercises.map((exercise) => {
                      const alreadyAdded = selectedExercises.some(
                        (e) => e.exerciseId === exercise.id,
                      );
                      return (
                        <div
                          key={exercise.id}
                          className={`exerciseSelection__lightbox__card ${
                            alreadyAdded
                              ? "exerciseSelection__lightbox__card--added"
                              : ""
                          }`}
                          onClick={() =>
                            !alreadyAdded && handleSelectExercise(exercise)
                          }
                        >
                          <div className="exerciseSelection__lightbox__card__sketch">
                            <SketchThumbnail sketch={exercise.sketch} />
                          </div>
                          <div className="exerciseSelection__lightbox__card__info">
                            <h4>{exercise.title}</h4>
                            <p>{exercise.description}</p>
                            <div className="exerciseSelection__lightbox__card__tags">
                              {(exercise.tags ?? []).map((tag) => (
                                <span
                                  key={tag}
                                  className={`tags tags--${tag.toLowerCase()}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          {alreadyAdded && (
                            <div className="exerciseSelection__lightbox__card__added">
                              Added
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Step 2: duration */}
            {lightboxStep === "duration" && pendingExercise && (
              <div className="exerciseSelection__lightbox__duration">
                <div className="exerciseSelection__lightbox__duration__sketch">
                  <SketchThumbnail sketch={pendingExercise.sketch} />
                </div>

                <div className="exerciseSelection__lightbox__duration__form">
                  <div className="exerciseSelection__lightbox__duration__form__title">
                    <label
                      htmlFor="exercise-duration"
                      className="exerciseSelection__lightbox__duration__label"
                    >
                      How many minutes for this exercise?
                    </label>
                    <p className="exerciseSelection__lightbox__duration__remaining">
                      Remaining budget: {totalDuration - plannedMinutes} min
                    </p>
                  </div>
                  <div className="exerciseSelection__lightbox__duration__input__wrapper">
                    <input
                      id="exercise-duration"
                      type="number"
                      min={1}
                      max={totalDuration}
                      value={pendingDuration}
                      placeholder="e.g. 15"
                      className="exerciseSelection__lightbox__duration__input"
                      onChange={(e) => setPendingDuration(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleConfirmDuration()
                      }
                      autoFocus
                    />
                    <span className="exerciseSelection__lightbox__duration__unit">
                      min
                    </span>
                  </div>
                </div>

                <div className="exerciseSelection__lightbox__duration__actions">
                  <button
                    className="excercisewizard__btn excercisewizard__btn--secondary"
                    onClick={() => setLightboxStep("grid")}
                  >
                    ← Back
                  </button>
                  <button
                    className="excercisewizard__btn"
                    onClick={handleConfirmDuration}
                    disabled={
                      !pendingDuration || parseInt(pendingDuration) <= 0
                    }
                  >
                    Add to training
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default withTrainingNavigation(ExerciseSelection);