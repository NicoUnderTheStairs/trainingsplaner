import { useEffect, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import db from "../../../firebase";
import type { Training } from "../../../types/Training";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_TAGS = [
  "Warmup",
  "Defense",
  "Attack",
  "Block",
  "Reception",
  "Service",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date: any): string => {
  if (!date) return "—";
  const d = typeof date.toDate === "function" ? date.toDate() : new Date(date);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const dayMonth = d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${weekday}, ${dayMonth}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

const TrainingList = () => {
  const navigate = useNavigate();

  // ── Data ─────────────────────────────────────────────────────────────────
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Search & filter ───────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        const userId = getAuth().currentUser?.uid;
        if (!userId) throw new Error("Not authenticated");

        const snapshot = await getDocs(
          collection(db, "users", userId, "trainings"),
        );
        const data: Training[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Training, "id">),
        }));

        data.sort((a, b) => {
          const dateA = (a.date as any)?.toDate?.() ?? new Date(a.date);
          const dateB = (b.date as any)?.toDate?.() ?? new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });

        setTrainings(data);
      } catch (e) {
        console.error("Error fetching trainings:", e);
        setError("Failed to load trainings.");
      } finally {
        setLoading(false);
      }
    };
    fetchTrainings();
  }, []);

  // ── Close filter on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Filter helpers ────────────────────────────────────────────────────────
  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const clearFilters = () => {
    setActiveTags([]);
    setSearch("");
  };

  const hasActiveFilters = activeTags.length > 0 || search.trim() !== "";
  const activeFilterCount = activeTags.length;

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = trainings.filter((tr) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      tr.title?.toLowerCase().includes(q) ||
      tr.description?.toLowerCase().includes(q) ||
      tr.author?.toLowerCase().includes(q);

    const matchesTags =
      activeTags.length === 0 ||
      activeTags.every((tag) => (tr.tags ?? []).includes(tag));

    return matchesSearch && matchesTags;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="traininglist section">
      <div className="traininglist__inner">
        {/* Back */}
        <div className="btn__back">
          <button className="btn__wired" onClick={() => navigate(-1)}>
            <svg
              width="23"
              height="12"
              viewBox="0 0 23 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                fill="black"
              />
            </svg>
            Back
          </button>
        </div>

        {/* Header */}
        <div className="traininglist__menu">
          <h2>
            My Trainings{" "}
            <span>
              ({hasActiveFilters ? `${filtered.length}/` : ""}
              {trainings.length})
            </span>
          </h2>

          <div className="traininglist__menu__buttons">
            {/* Search */}
            <div className="traininglist__search__wrapper">
              <input
                type="text"
                className="traininglist__menu__buttons--search"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="traininglist__search__clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filter */}
            <div className="traininglist__filter__wrapper" ref={filterRef}>
              <button
                className={`traininglist__menu__buttons--filter ${filterOpen ? "traininglist__menu__buttons--filter--open" : ""}`}
                onClick={() => setFilterOpen((p) => !p)}
              >
                Filter
                {activeFilterCount > 0 && (
                  <span className="traininglist__filter__badge">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {filterOpen && (
                <div className="traininglist__filter__dropdown">
                  <div className="traininglist__filter__section">
                    <p className="traininglist__filter__label">Tags</p>
                    <div className="traininglist__filter__tags">
                      {AVAILABLE_TAGS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`tags tags--${tag.toLowerCase()} ${activeTags.includes(tag) ? `tags--${tag.toLowerCase()}--active` : ""}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="traininglist__filter__footer">
                    <button
                      className="traininglist__filter__clear"
                      onClick={clearFilters}
                      disabled={!hasActiveFilters}
                    >
                      Clear all
                    </button>
                    <button
                      className="btn__primary traininglist__filter__apply"
                      onClick={() => setFilterOpen(false)}
                    >
                      Show {filtered.length} result
                      {filtered.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              className="btn__primary"
              onClick={() => navigate("/create-training")}
            >
              + Create Training
            </button>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="traininglist__filter__chips">
            {search && (
              <span className="traininglist__filter__chip">
                "{search}"<button onClick={() => setSearch("")}>×</button>
              </span>
            )}
            {activeTags.map((tag) => (
              <span
                key={tag}
                className={`traininglist__filter__chip tags tags--${tag.toLowerCase()} tags--${tag.toLowerCase()}--active`}
              >
                {tag}
                <button onClick={() => toggleTag(tag)}>×</button>
              </span>
            ))}
            <button
              className="traininglist__filter__chip__clear"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>
        )}

        {/* States */}
        {loading && <p className="traininglist__status">Loading...</p>}
        {error && (
          <p className="traininglist__status traininglist__status--error">
            {error}
          </p>
        )}

        {/* Training cards */}
        {!loading && !error && (
          <>
            {trainings.length === 0 ? (
              <div className="traininglist__empty">
                <p>No trainings yet.</p>
                <button
                  className="btn__primary"
                  onClick={() => navigate("/create-training")}
                >
                  + Create your first training
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="traininglist__empty">
                <p>No trainings match your filters.</p>
                <button className="btn__wired" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="traininglist__cards">
                {filtered.map((training) => (
                  <div
                    key={training.id}
                    className="traininglist__card"
                    onClick={() => navigate(`/training-detail/${training.id}`)}
                  >
                    <div className="traininglist__card__accent" />

                    <div className="traininglist__card__body">
                      <div className="traininglist__card__top">
                        <div className="traininglist__card__meta">
                          <span className="traininglist__card__author">
                            {training.author || "—"}
                          </span>
                          <span className="traininglist__card__date">
                            {formatDate(training.date)}
                          </span>
                        </div>
                        <span className="traininglist__card__duration">
                          {training.duration ? `${training.duration} min` : "—"}
                        </span>
                      </div>

                      <h3 className="traininglist__card__title">
                        {training.title || "Untitled"}
                      </h3>

                      {training.description && (
                        <p className="traininglist__card__desc">
                          {training.description.length > 80
                            ? training.description.substring(0, 80) + "..."
                            : training.description}
                        </p>
                      )}

                      <div className="traininglist__card__footer">
                        <div className="traininglist__card__tags">
                          {(training.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className={`tags tags--${tag.toLowerCase()}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="traininglist__card__exercises">
                          <span>
                            {(training.exercises ?? []).length} exercise
                            {(training.exercises ?? []).length !== 1 ? "s" : ""}
                          </span>
                          <svg
                            width="16"
                            height="10"
                            viewBox="0 0 23 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M1 5.25004H0.25V6.75004H1V5.25004ZM22.5303 6.53037C22.8232 6.23748 22.8232 5.7626 22.5303 5.46971L17.7574 0.696739C17.4645 0.403839 16.9896 0.403839 16.6967 0.696739C16.4038 0.989639 16.4038 1.46454 16.6967 1.75744L20.9393 6.00004L16.6967 10.2427C16.4038 10.5356 16.4038 11.0104 16.6967 11.3033C16.9896 11.5962 17.4645 11.5962 17.7574 11.3033L22.5303 6.53037ZM1 6.75004L22 6.75004V5.25004L1 5.25004V6.75004Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TrainingList;
