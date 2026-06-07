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
    <path
      d="M1 2H15"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M1 7H15"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M1 12H15"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
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
  const [pendingExerciseIds, setPendingExerciseIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingExerciseMap, setPendingExerciseMap] = useState<
    Record<string, Exercise>
  >({});
  const [pendingDurations, setPendingDurations] = useState<
    Record<string, string>
  >({});

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

  // Budget computed values for duration step
  const pendingTotal = Array.from(pendingExerciseIds).reduce(
    (sum, id) => sum + (parseInt(pendingDurations[id] || "0") || 0),
    0,
  );
  const totalPlanned = plannedMinutes + pendingTotal;
  const budgetRemaining = totalDuration - totalPlanned;
  const fillPercent =
    totalDuration > 0 ? Math.min(100, (totalPlanned / totalDuration) * 100) : 0;

  // ── Fetch exercises ──────────────────────────────────────────────────────
  useEffect(() => {
    if (userData === undefined) return;

    const fetch = async () => {
      try {
        const userTeam = userData?.team ?? "";
        const q = userTeam
          ? query(
              collection(db, "Excercises"),
              where("team", "array-contains", userTeam),
            )
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

  // ── User preferences ────────────────────────────────────────────────────
  const isSimpleMobile =
    (userData as any)?.mobileMode === "simple" &&
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  const isBackwardPlanning =
    (userData as any)?.planningDirection === "backward";

  // ── Simple reorder ───────────────────────────────────────────────────────
  const moveUp = (index: number) => {
    if (index === 0) return;
    const arr = [...selectedExercises];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    onChange({ selectedExercises: arr });
  };
  const moveDown = (index: number) => {
    if (index === selectedExercises.length - 1) return;
    const arr = [...selectedExercises];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    onChange({ selectedExercises: arr });
  };

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
    e.preventDefault();
  };

  // ── Lightbox handlers ────────────────────────────────────────────────────
  const openLightbox = () => {
    setLightboxStep("grid");
    setPendingExerciseIds(new Set());
    setPendingExerciseMap({});
    setPendingDurations({});
    setSearch("");
    setActiveTag(null);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setPendingExerciseIds(new Set());
    setPendingExerciseMap({});
    setPendingDurations({});
    setLightboxStep("grid");
  };

  const handleToggleExercise = (exercise: Exercise) => {
    const alreadyAdded = selectedExercises.some(
      (e) => e.exerciseId === exercise.id,
    );
    if (alreadyAdded) return;

    setPendingExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(exercise.id)) {
        next.delete(exercise.id);
      } else {
        next.add(exercise.id);
      }
      return next;
    });
    setPendingExerciseMap((prev) => ({ ...prev, [exercise.id]: exercise }));
  };

  const handleContinueToDuration = () => {
    if (pendingExerciseIds.size === 0) return;
    setPendingDurations((prev) => {
      const next = { ...prev };
      pendingExerciseIds.forEach((id) => {
        if (!(id in next)) next[id] = "";
      });
      return next;
    });
    setLightboxStep("duration");
  };

  const handleConfirmAll = () => {
    const newEntries: SelectedExercise[] = Array.from(pendingExerciseIds).map(
      (id) => {
        const exercise = pendingExerciseMap[id];
        const duration = Math.max(
          0,
          parseInt(pendingDurations[id] || "0") || 0,
        );
        return { exerciseId: id, title: exercise.title, duration };
      },
    );

    let updated = [...selectedExercises];
    if (isBackwardPlanning) {
      updated = [...newEntries, ...updated];
    } else {
      updated = [...updated, ...newEntries];
    }

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

      {isBackwardPlanning && (
        <p className="exerciseSelection__direction">
          Planning backwards — add the <strong>last</strong> exercise first. The
          order flips automatically.
        </p>
      )}

      {/* ── Selected exercises list ── */}
      <div className="exerciseSelection__selected">
        {selectedExercises.map((sel, index) => (
          <div
            key={sel.exerciseId}
            className={[
              "exerciseSelection__selected__item",
              !isSimpleMobile && draggingIndex === index
                ? "exerciseSelection__selected__item--dragging"
                : "",
              !isSimpleMobile &&
              dragOverIdx === index &&
              draggingIndex !== index
                ? "exerciseSelection__selected__item--dragover"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            draggable={!isSimpleMobile}
            onDragStart={
              !isSimpleMobile ? () => handleDragStart(index) : undefined
            }
            onDragEnter={
              !isSimpleMobile ? () => handleDragEnter(index) : undefined
            }
            onDragEnd={!isSimpleMobile ? handleDragEnd : undefined}
            onDragOver={!isSimpleMobile ? handleDragOver : undefined}
          >
            {isSimpleMobile ? (
              <div className="exerciseSelection__selected__item__reorder">
                <button
                  className="exerciseSelection__selected__item__reorder__btn"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  className="exerciseSelection__selected__item__reorder__btn"
                  onClick={() => moveDown(index)}
                  disabled={index === selectedExercises.length - 1}
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
            ) : (
              <div
                className="exerciseSelection__selected__item__handle"
                title="Drag to reorder"
              >
                <DragHandleIcon />
              </div>
            )}

            <span className="exerciseSelection__selected__item__index">
              {index + 1}
            </span>

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
            {/* Header */}
            <div className="exerciseSelection__lightbox__header">
              <h3>
                {lightboxStep === "grid"
                  ? "Select exercises"
                  : `Set duration — ${pendingExerciseIds.size} exercise${pendingExerciseIds.size !== 1 ? "s" : ""}`}
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
              <div className="exerciseSelection__lightbox__step">
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
                  <p className="exerciseSelection__status">
                    No exercises found.
                  </p>
                ) : (
                  <div className="exerciseSelection__lightbox__grid">
                    {filteredExercises.map((exercise) => {
                      const alreadyAdded = selectedExercises.some(
                        (e) => e.exerciseId === exercise.id,
                      );
                      const isPending = pendingExerciseIds.has(exercise.id);
                      return (
                        <div
                          key={exercise.id}
                          className={[
                            "exerciseSelection__lightbox__card",
                            alreadyAdded
                              ? "exerciseSelection__lightbox__card--added"
                              : "",
                            isPending
                              ? "exerciseSelection__lightbox__card--selected"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() =>
                            !alreadyAdded && handleToggleExercise(exercise)
                          }
                        >
                          <div className="exerciseSelection__lightbox__card__sketch">
                            <SketchThumbnail sketch={exercise.sketch} />
                          </div>
                          <div className="exerciseSelection__lightbox__card__info">
                            <h4>{exercise.title}</h4>
                            <p>
                              {exercise.description?.length > 100
                                ? exercise.description.substring(0, 100) + "..."
                                : exercise.description}
                            </p>
                            <div className="exerciseSelection__lightbox__card__tags">
                              {(exercise.tags ?? []).slice(0, 2).map((tag) => (
                                <div
                                  key={tag}
                                  className={`tags tags--${tag.toLowerCase()}`}
                                >
                                  <span className="exerciseSelection__lightbox__card__tags--tag">
                                    {tag}
                                  </span>
                                </div>
                              ))}
                              {(exercise.tags ?? []).length > 2 && (
                                <span className="exerciseSelection__lightbox__card__tags--more">
                                  +{(exercise.tags ?? []).length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                          {alreadyAdded && (
                            <div className="exerciseSelection__lightbox__card__added">
                              Added
                            </div>
                          )}
                          {isPending && (
                            <div className="exerciseSelection__lightbox__card__check">
                              ✓
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer: selection count + continue CTA */}
                {pendingExerciseIds.size > 0 && (
                  <div className="exerciseSelection__lightbox__footer">
                    <span>
                      {pendingExerciseIds.size} exercise
                      {pendingExerciseIds.size !== 1 ? "s" : ""} selected
                    </span>
                    <button
                      className="excercisewizard__btn"
                      onClick={handleContinueToDuration}
                    >
                      Set duration →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: duration list */}
            {lightboxStep === "duration" && (
              <div className="exerciseSelection__lightbox__step">
                {/* Budget bar */}
                <div className="exerciseSelection__lightbox__duration__budget">
                  <div className="exerciseSelection__lightbox__duration__budget__bar">
                    <div
                      className={`exerciseSelection__lightbox__duration__budget__bar__fill${
                        budgetRemaining < 0
                          ? " exerciseSelection__lightbox__duration__budget__bar__fill--over"
                          : ""
                      }`}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                  <div className="exerciseSelection__lightbox__duration__budget__info">
                    <span>{totalPlanned} min planned</span>
                    <span>{totalDuration} min total</span>
                    <span
                      className={
                        budgetRemaining < 0
                          ? "exerciseSelection__lightbox__duration__budget__info__remaining--over"
                          : ""
                      }
                    >
                      {budgetRemaining < 0
                        ? `${-budgetRemaining} min over budget`
                        : `${budgetRemaining} min remaining`}
                    </span>
                  </div>
                </div>

                {/* Exercise duration rows */}
                <div className="exerciseSelection__lightbox__duration__list">
                  {Array.from(pendingExerciseIds).map((id, idx) => {
                    const exercise = pendingExerciseMap[id];
                    if (!exercise) return null;
                    return (
                      <div
                        key={id}
                        className="exerciseSelection__lightbox__duration__row"
                      >
                        <div className="exerciseSelection__lightbox__duration__row__thumb">
                          <SketchThumbnail sketch={exercise.sketch} />
                        </div>
                        <span className="exerciseSelection__lightbox__duration__row__title">
                          {exercise.title}
                        </span>
                        <div className="exerciseSelection__lightbox__duration__row__input">
                          <input
                            type="number"
                            min={0}
                            value={pendingDurations[id] ?? ""}
                            placeholder="0"
                            autoFocus={idx === 0}
                            onChange={(e) =>
                              setPendingDurations((prev) => ({
                                ...prev,
                                [id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleConfirmAll()
                            }
                          />
                          <span>min</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="exerciseSelection__lightbox__duration__actions">
                  <button
                    className="excercisewizard__btn excercisewizard__btn--secondary"
                    onClick={() => setLightboxStep("grid")}
                  >
                    ← Back
                  </button>
                  <button
                    className="excercisewizard__btn"
                    onClick={handleConfirmAll}
                  >
                    Add {pendingExerciseIds.size} to training
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
