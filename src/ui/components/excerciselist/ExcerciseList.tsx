import { useEffect, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import db from "../../../firebase";
import type { SketchData } from "../../../types/Sketch";
import type { Exercise } from "../../../types/Exercise";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_TAGS = [
  "Warmup", "Defense", "Attack", "Block", "Reception", "Service",
];
const DIFFICULTIES = [1, 2, 3, 4, 5];

// ─── Sketch thumbnail ─────────────────────────────────────────────────────────

const PLAYER_COLORS: Record<string, string> = {
  attacker: "#E63C2F", defender: "#3EC6D4", setter: "#F5A623", libero: "#4DB87A",
};
const PLAYER_LABELS: Record<string, string> = {
  attacker: "A", defender: "D", setter: "S", libero: "L",
};

const SketchThumbnail = ({ sketch }: { sketch: SketchData }) => {
  const players = sketch?.players ? Object.entries(sketch.players) : [];
  const arrows  = sketch?.arrows  ? Object.entries(sketch.arrows)  : [];
  return (
    <svg width="100%" height="100%" viewBox="0 0 560 440" fill="none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="thumb-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 Z" fill="#1E1E1E" />
        </marker>
      </defs>
      <path d="M560 0H0V440H560V0Z" fill="white" />
      <path d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z" fill="#F4EDE0" />
      <path d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203" stroke="black" strokeWidth="1" />
      {arrows.map(([id, arrow]) => (
        <line key={id} x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} stroke="#1E1E1E" strokeWidth="2" strokeDasharray={arrow.style === "dashed" ? "6 4" : undefined} markerEnd="url(#thumb-arrow)" />
      ))}
      {players.map(([id, player]) => (
        <g key={id} transform={`translate(${player.x}, ${player.y})`}>
          <circle r={11} fill={PLAYER_COLORS[player.type] ?? "#999"} />
          <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize={11} fontWeight="bold" fontFamily="Roboto, sans-serif">
            {PLAYER_LABELS[player.type] ?? "?"}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ExcerciseList = () => {
  const navigate = useNavigate();

  const [exercises,    setExercises]    = useState<Exercise[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  // Map of exerciseId → variant count (number of siblings in its group)
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>({});

  const [search,             setSearch]             = useState("");
  const [filterOpen,         setFilterOpen]         = useState(false);
  const [activeTags,         setActiveTags]         = useState<string[]>([]);
  const [activeDifficulties, setActiveDifficulties] = useState<number[]>([]);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Fetch exercises ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const snapshot = await getDocs(collection(db, "Excercises"));
        const data: Exercise[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Exercise, "id">),
        }));
        setExercises(data);

        // ── Fetch variant counts in one batch ─────────────────────────────
        // Collect all unique variantGroupIds from the exercises
        const groupIds = [...new Set(
          data
            .map((ex) => (ex as any).variantGroupId as string | undefined)
            .filter(Boolean) as string[]
        )];

        if (groupIds.length > 0) {
          // Firestore "in" queries support max 30 items; chunk if needed
          const chunks: string[][] = [];
          for (let i = 0; i < groupIds.length; i += 30) chunks.push(groupIds.slice(i, i + 30));

          const counts: Record<string, number> = {};

          await Promise.all(chunks.map(async (chunk) => {
            const q = query(
              collection(db, "ExerciseVariants"),
              where("__name__", "in", chunk),
            );
            const snap = await getDocs(q);
            snap.docs.forEach((d) => {
              const exerciseIds: string[] = d.data().exerciseIds ?? [];
              // For each exercise in this group, its variant count = group size - 1 (exclude itself)
              exerciseIds.forEach((eid) => {
                counts[eid] = exerciseIds.length - 1;
              });
            });
          }));

          setVariantCounts(counts);
        }
      } catch (e) {
        console.error("Error fetching exercises:", e);
        setError("Failed to load exercises.");
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, []);

  // ── Close filter on outside click ───────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Filter helpers ──────────────────────────────────────────────────────────
  const toggleTag        = (tag: string) => setActiveTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]);
  const toggleDifficulty = (d: number)   => setActiveDifficulties((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  const clearFilters     = () => { setActiveTags([]); setActiveDifficulties([]); setSearch(""); };

  const hasActiveFilters  = activeTags.length > 0 || activeDifficulties.length > 0 || search.trim() !== "";
  const activeFilterCount = activeTags.length + activeDifficulties.length;

  const filtered = exercises.filter((ex) => {
    const q             = search.trim().toLowerCase();
    const matchesSearch = q === "" || ex.title.toLowerCase().includes(q) || ex.description?.toLowerCase().includes(q);
    const matchesTags   = activeTags.length === 0 || activeTags.every((tag) => (ex.tags ?? []).includes(tag));
    const matchesDiff   = activeDifficulties.length === 0 || activeDifficulties.includes(ex.difficulty);
    return matchesSearch && matchesTags && matchesDiff;
  });

  return (
    <div className="excerciselist section">
      <div className="excerciselist__inner">

        {/* Header */}
        <div className="excerciselist__menu">
          <h2>
            All Exercises{" "}
            <span>({hasActiveFilters ? `${filtered.length}/` : ""}{exercises.length})</span>
          </h2>

          <div className="excerciselist__menu__buttons">
            <div className="excerciselist__search__wrapper">
              <input
                type="text"
                className="excerciselist__menu__buttons--search"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="excerciselist__search__clear" onClick={() => setSearch("")} aria-label="Clear search">×</button>
              )}
            </div>

            <div className="excerciselist__filter__wrapper" ref={filterRef}>
              <button
                className={`excerciselist__menu__buttons--filter ${filterOpen ? "excerciselist__menu__buttons--filter--open" : ""}`}
                onClick={() => setFilterOpen((p) => !p)}
              >
                Filter
                {activeFilterCount > 0 && <span className="excerciselist__filter__badge">{activeFilterCount}</span>}
              </button>

              {filterOpen && (
                <div className="excerciselist__filter__dropdown">
                  <div className="excerciselist__filter__section">
                    <p className="excerciselist__filter__label">Tags</p>
                    <div className="excerciselist__filter__tags">
                      {AVAILABLE_TAGS.map((tag) => (
                        <button key={tag} onClick={() => toggleTag(tag)}
                          className={`tags tags--${tag.toLowerCase()} ${activeTags.includes(tag) ? `tags--${tag.toLowerCase()}--active` : ""}`}
                        >{tag}</button>
                      ))}
                    </div>
                  </div>
                  <div className="excerciselist__filter__section">
                    <p className="excerciselist__filter__label">Difficulty</p>
                    <div className="excerciselist__filter__difficulties">
                      {DIFFICULTIES.map((d) => (
                        <button key={d} onClick={() => toggleDifficulty(d)}
                          className={`excerciselist__filter__difficulty ${activeDifficulties.includes(d) ? "excerciselist__filter__difficulty--active" : ""}`}
                        >{d}</button>
                      ))}
                    </div>
                  </div>
                  <div className="excerciselist__filter__footer">
                    <button className="excerciselist__filter__clear" onClick={clearFilters} disabled={!hasActiveFilters}>Clear all</button>
                    <button className="excerciselist__filter__apply btn__primary" onClick={() => setFilterOpen(false)}>
                      Show {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => navigate("/create-exercise")} className="btn__primary">
              + New Exercise
            </button>
          </div>
        </div>

        {/* Active chips */}
        {hasActiveFilters && (
          <div className="excerciselist__filter__chips">
            {search && (
              <span className="excerciselist__filter__chip">
                "{search}"
                <button onClick={() => setSearch("")}>×</button>
              </span>
            )}
            {activeTags.map((tag) => (
              <span key={tag} className={`excerciselist__filter__chip tags tags--${tag.toLowerCase()} tags--${tag.toLowerCase()}--active`}>
                {tag}<button onClick={() => toggleTag(tag)}>×</button>
              </span>
            ))}
            {activeDifficulties.map((d) => (
              <span key={d} className="excerciselist__filter__chip excerciselist__filter__chip--difficulty">
                Difficulty {d}<button onClick={() => toggleDifficulty(d)}>×</button>
              </span>
            ))}
            <button className="excerciselist__filter__chip__clear" onClick={clearFilters}>Clear all</button>
          </div>
        )}

        {loading && <p className="excerciselist__status">Loading...</p>}
        {error   && <p className="excerciselist__status excerciselist__status--error">{error}</p>}

        {!loading && !error && (
          <div className="excerciselist__exercise__wrapper">
            {filtered.map((exercise) => {
              const variantCount = variantCounts[exercise.id!] ?? 0;
              return (
                <div
                  key={exercise.id}
                  className="excerciselist__exercise"
                  onClick={() => navigate(`/exercise-detail/${exercise.id}`)}
                >
                  {/* ── Variant badge ── */}
                  {variantCount > 0 && (
                    <div className="excerciselist__exercise__variants" title={`${variantCount} variant${variantCount !== 1 ? "s" : ""}`}>
                      {variantCount}
                    </div>
                  )}

                  <div className="excerciselist__exercise__img">
                    <SketchThumbnail sketch={exercise.sketch} />
                  </div>

                  <div className="excerciselist__exercise__content">
                    <h3>{exercise.title}</h3>
                    <p>
                      {exercise.description?.length > 100
                        ? exercise.description.substring(0, 100) + "..."
                        : exercise.description}
                    </p>

                    <div className="excerciselist__exercise__content--detail">
                      <div>
                        {(exercise.tags ?? []).map((tag) => (
                          <div key={tag} className={`excerciselist__exercise__content__tags tags tags--${tag.toLowerCase()}`}>
                            <span className="excerciselist__exercise__content__tags--tag">{tag}</span>
                          </div>
                        ))}
                      </div>
                      <div className={`difficulty difficulty--${exercise.difficulty}`}>
                        <svg width="21" height="24" viewBox="0 0 21 24" fill="none">
                          <path className={`difficulty__path1 difficulty--${exercise.difficulty}__path1`} d="M0 17.5238H6V24H0V17.5238Z" fill="#1E1E1E" />
                          <path className={`difficulty__path2 difficulty--${exercise.difficulty}__path2`} d="M7.5 8.7619H13.5V24H7.5V8.7619Z" fill="#1E1E1E" />
                          <path className={`difficulty__path3 difficulty--${exercise.difficulty}__path3`} d="M15 0H21V24H15V0Z" fill="#1E1E1E" />
                        </svg>
                        <h4>{exercise.difficulty}</h4>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && exercises.length > 0 && (
              <div className="excerciselist__no__results">
                <p>No exercises match your filters.</p>
                <button className="btn__wired" onClick={clearFilters}>Clear filters</button>
              </div>
            )}

            {exercises.length === 0 && <p className="excerciselist__status">No exercises yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcerciseList;