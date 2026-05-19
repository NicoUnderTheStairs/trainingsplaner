import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../../../auth/authContext";
import { useGetUserData } from "../../../hooks/useGetUserData";
import db from "../../../firebase";
import type { Exercise } from "../../../types/Exercise";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  newExerciseId?: string;
  variantIds?: string[];
  onChange: (data: { variantIds: string[] }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const VariantSelection: React.FC<Props> = ({
  newExerciseId,
  variantIds = [],
  onChange,
}) => {
  const { currentUser } = useAuth() || { currentUser: null };

  const userData = useGetUserData(currentUser?.uid ?? "");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(variantIds);

  // Fetch only exercises from the same team, excluding the one just created
  useEffect(() => {
    if (userData === undefined) return; // wait for profile to load

    const fetch = async () => {
      const userTeam = userData?.team ?? "";

      const q = userTeam
        ? query(collection(db, "Excercises"), where("team", "==", userTeam))
        : collection(db, "Excercises");

      const snap = await getDocs(q);
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Exercise)
        .filter((ex) => ex.id !== newExerciseId);

      setExercises(all);
      setLoading(false);
    };

    fetch();
  }, [newExerciseId, userData]);

  const handleSelect = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((v) => v !== id)
      : [...selected, id];

    setSelected(next);
    onChange({ variantIds: next });
  };

  const filtered = exercises.filter((ex) =>
    ex.title?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="excercisewizard">
      <h2>Select variants</h2>

      <p className="excercisewizard__variant__desc">
        Select one or multiple exercises that are variants of this exercise.
        Leave empty if this is a standalone exercise.
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

      {/* List */}
      {loading ? (
        <p className="excercisewizard__variant__loading">
          Loading exercises...
        </p>
      ) : filtered.length === 0 ? (
        <p className="excercisewizard__variant__empty">
          {exercises.length === 0
            ? "No other exercises found."
            : "No exercises match your search."}
        </p>
      ) : (
        <div className="excercisewizard__variant__list">
          {filtered.map((ex) => {
            const isSelected = selected.includes(ex.id!);
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
    </div>
  );
};

export default VariantSelection;
