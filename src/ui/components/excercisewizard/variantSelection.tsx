import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import withNavigation from "../../../hoc/withNavigation";
import db from "../../../firebase";
import type { Exercise } from "../../../types/Exercise";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  // The ID of the newly created exercise (passed in after Step 2 submits)
  newExerciseId: string;
  // Currently selected variant group exercise IDs (if user picked one)
  variantOfId?: string;
  onChange: (data: { variantOfId?: string }) => void;
  onNext: () => void;
  onPrev: () => void;
  isLastStep?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const VariantSelection: React.FC<Props> = ({
  variantOfId,
  onChange,
  onNext,
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | undefined>(variantOfId);

  // Fetch all existing exercises to pick a variant parent from
  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, "Excercises"));
      setExercises(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise),
      );
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSelect = (id: string) => {
    const next = selected === id ? undefined : id;
    setSelected(next);
    onChange({ variantOfId: next });
  };

  const handleSkip = () => {
    setSelected(undefined);
    onChange({ variantOfId: undefined });
    onNext();
  };

  const filtered = exercises.filter((ex) =>
    ex.title?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="excercisewizard">
      <h2>Is this a variant?</h2>
      <p className="excercisewizard__variant__desc">
        If this exercise is a variation of an existing one, select it below.
        Both will be linked together and shown as variants on each other's
        detail page. Skip if this is a standalone exercise.
      </p>

      {/* Search */}
      <div className="excercisewizard__variant__search__wrapper">
        <input
          type="text"
          className="excercisewizard__input excercisewizard__variant__search"
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Exercise list */}
      {loading ? (
        <p className="excercisewizard__variant__loading">
          Loading exercises...
        </p>
      ) : filtered.length === 0 ? (
        <p className="excercisewizard__variant__empty">No exercises found.</p>
      ) : (
        <div className="excercisewizard__variant__list">
          {filtered.map((ex) => {
            const isSelected = selected === ex.id;
            return (
              <button
                key={ex.id}
                className={`excercisewizard__variant__item ${isSelected ? "excercisewizard__variant__item--selected" : ""}`}
                onClick={() => handleSelect(ex.id!)}
                type="button"
              >
                <div className="excercisewizard__variant__item__info">
                  <span className="excercisewizard__variant__item__title">
                    {ex.title}
                  </span>
                  <div className="excercisewizard__variant__item__tags">
                    {(ex.tags ?? []).slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className={`tags tags--${tag.toLowerCase()}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className={`excercisewizard__variant__item__check ${isSelected ? "excercisewizard__variant__item__check--active" : ""}`}
                >
                  {isSelected && (
                    <svg width="12" height="10" viewBox="0 0 14 11" fill="none">
                      <path
                        d="M1 5L5 9L13 1"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Skip hint */}
      <p className="excercisewizard__variant__skip__hint">
        Not a variant?{" "}
        <button
          className="excercisewizard__variant__skip__btn"
          onClick={handleSkip}
          type="button"
        >
          Skip this step →
        </button>
      </p>
    </div>
  );
};

export default withNavigation(VariantSelection);
