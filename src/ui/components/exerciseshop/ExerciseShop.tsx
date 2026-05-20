import { useEffect, useRef, useState } from "react";
import { collection, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
// import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/authContext";
import { useGetUserData } from "../../../hooks/useGetUserData";
import db from "../../../firebase";
import Navigation from "../navigation/Navigation";
import type { SketchData } from "../../../types/Sketch";
import type { Exercise } from "../../../types/Exercise";

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
  const objects = (sketch as any)?.objects ? Object.entries((sketch as any).objects) : [];
  return (
    <svg width="100%" height="100%" viewBox="0 0 560 440" fill="none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="shop-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 Z" fill="#1E1E1E" />
        </marker>
      </defs>
      <path d="M560 0H0V440H560V0Z" fill="white" />
      <path d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z" fill="#F4EDE0" />
      <path d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203" stroke="black" strokeWidth="1" />
      {objects.map(([id, obj]: [string, any]) => (
        <g key={id} transform={`translate(${obj.x}, ${obj.y})`}>
          {obj.type === "pylon" && <polygon points="0,-13 11,8 -11,8" fill="#FF8C00" stroke="#1E1E1E" strokeWidth={1.5} />}
          {obj.type === "bench" && (
            <>
              <rect x={-15} y={-7} width={30} height={14} fill="#8B5E3C" stroke="#1E1E1E" strokeWidth={1.5} rx={2} />
              <line x1={-11} y1={7} x2={-11} y2={12} stroke="#1E1E1E" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={11}  y1={7} x2={11}  y2={12} stroke="#1E1E1E" strokeWidth={1.5} strokeLinecap="round" />
            </>
          )}
        </g>
      ))}
      {arrows.map(([id, arrow]: [string, any]) => (
        <line key={id} x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2}
          stroke="#1E1E1E" strokeWidth="2"
          strokeDasharray={arrow.style === "dashed" ? "6 4" : undefined}
          markerEnd="url(#shop-arrow)" />
      ))}
      {players.map(([id, player]: [string, any]) => (
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

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_TAGS = ["Warmup", "Defense", "Attack", "Block", "Reception", "Service"];
const DIFFICULTIES   = [1, 2, 3, 4, 5];

// ─── Component ────────────────────────────────────────────────────────────────

const ExerciseShop = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData   = useGetUserData(currentUser?.uid ?? "");
  // const currentUid = getAuth().currentUser?.uid;

  const [exercises,    setExercises]    = useState<Exercise[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [activeTags,   setActiveTags]   = useState<string[]>([]);
  const [activeDiffs,  setActiveDiffs]  = useState<number[]>([]);
  // IDs currently being added (to show loading state per card)
  const [addingIds,    setAddingIds]    = useState<Set<string>>(new Set());
  // IDs already added this session (to show success state)
  const [addedIds,     setAddedIds]     = useState<Set<string>>(new Set());

  const filterRef = useRef<HTMLDivElement>(null);

  const userTeam = (userData as any)?.team ?? "";

  // ── Fetch ALL exercises (no team filter) ─────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const snap = await getDocs(collection(db, "Excercises"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise);
        setExercises(data);

        // Pre-mark exercises already in user's team
        if (userTeam) {
          const alreadyOwned = new Set(
            data
              .filter((ex) => {
                const t = (ex as any).team;
                return Array.isArray(t) ? t.includes(userTeam) : t === userTeam;
              })
              .map((ex) => ex.id!)
          );
          setAddedIds(alreadyOwned);
        }
      } catch (e) {
        console.error("Error fetching exercises:", e);
      } finally {
        setLoading(false);
      }
    };
    if (userData !== undefined) fetchAll();
  }, [userData, userTeam]);

  // ── Close filter on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Add exercise to team ───────────────────────────────────────────────────
  const handleAdd = async (exerciseId: string) => {
    if (!userTeam || addingIds.has(exerciseId) || addedIds.has(exerciseId)) return;

    setAddingIds((prev) => new Set(prev).add(exerciseId));
    try {
      // Add this team to the exercise's team array — no duplication,
      // forking only happens if a non-owner edits in ExerciseDetail
      await updateDoc(doc(db, "Excercises", exerciseId), {
        team: arrayUnion(userTeam),
      });
      setAddedIds((prev) => new Set(prev).add(exerciseId));
    } catch (e) {
      console.error("Error adding exercise to team:", e);
    } finally {
      setAddingIds((prev) => { const s = new Set(prev); s.delete(exerciseId); return s; });
    }
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const toggleTag  = (tag: string) => setActiveTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]);
  const toggleDiff = (d: number)   => setActiveDiffs((p) => p.includes(d)  ? p.filter((x) => x !== d)  : [...p, d]);
  const clearFilters = () => { setActiveTags([]); setActiveDiffs([]); setSearch(""); };

  const hasActiveFilters  = activeTags.length > 0 || activeDiffs.length > 0 || search.trim() !== "";
  const activeFilterCount = activeTags.length + activeDiffs.length;

  const filtered = exercises.filter((ex) => {
    const q           = search.trim().toLowerCase();
    const matchSearch = q === "" || ex.title?.toLowerCase().includes(q) || ex.description?.toLowerCase().includes(q);
    const matchTags   = activeTags.length === 0 || activeTags.every((tag) => (ex.tags ?? []).includes(tag));
    const matchDiff   = activeDiffs.length === 0 || activeDiffs.includes(ex.difficulty);
    return matchSearch && matchTags && matchDiff;
  });

  // Separate: already in team / not yet added
  const ownedFiltered = filtered.filter((ex) => addedIds.has(ex.id!));
  const newFiltered   = filtered.filter((ex) => !addedIds.has(ex.id!));

  return (
    <>
      <Navigation />
      <div className="excerciseshop section">
        <div className="excerciseshop__inner">

          {/* ── Header ── */}
          <div className="excerciseshop__header">
            <div className="excerciseshop__header__text">
              <h1 className="excerciseshop__title">
                Exercise Shop
                <span className="excerciseshop__title__dot">.</span>
              </h1>
              <p className="excerciseshop__subtitle">
                Browse all exercises across every team. Add any to your team's library.
              </p>
            </div>
            {userTeam && (
              <div className="excerciseshop__team__badge">
                <span className="excerciseshop__team__badge__label">Adding to</span>
                <span className="excerciseshop__team__badge__name">{userTeam}</span>
              </div>
            )}
          </div>

          {/* ── Toolbar ── */}
          <div className="excerciseshop__toolbar">
            <div className="excerciseshop__search__wrapper">
              <input
                type="text"
                className="excerciseshop__search"
                placeholder="Search exercises..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="excerciseshop__search__clear" onClick={() => setSearch("")}>×</button>
              )}
            </div>

            <div className="excerciseshop__filter__wrapper" ref={filterRef}>
              <button
                className={`excerciseshop__filter__btn ${filterOpen ? "excerciseshop__filter__btn--open" : ""}`}
                onClick={() => setFilterOpen((p) => !p)}
              >
                Filter
                {activeFilterCount > 0 && (
                  <span className="excerciseshop__filter__badge">{activeFilterCount}</span>
                )}
              </button>

              {filterOpen && (
                <div className="excerciseshop__filter__dropdown">
                  <div className="excerciseshop__filter__section">
                    <p className="excerciseshop__filter__label">Tags</p>
                    <div className="excerciseshop__filter__tags">
                      {AVAILABLE_TAGS.map((tag) => (
                        <button key={tag} onClick={() => toggleTag(tag)}
                          className={`tags tags--${tag.toLowerCase()} ${activeTags.includes(tag) ? `tags--${tag.toLowerCase()}--active` : ""}`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="excerciseshop__filter__section">
                    <p className="excerciseshop__filter__label">Difficulty</p>
                    <div className="excerciseshop__filter__difficulties">
                      {DIFFICULTIES.map((d) => (
                        <button key={d} onClick={() => toggleDiff(d)}
                          className={`excerciseshop__filter__difficulty ${activeDiffs.includes(d) ? "excerciseshop__filter__difficulty--active" : ""}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="excerciseshop__filter__footer">
                    <button className="excerciseshop__filter__clear" onClick={clearFilters} disabled={!hasActiveFilters}>Clear all</button>
                    <button className="excerciseshop__filter__apply btn__primary" onClick={() => setFilterOpen(false)}>
                      Show {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="excerciseshop__counts">
              <span className="excerciseshop__counts__total">{exercises.length} exercises total</span>
              {userTeam && (
                <span className="excerciseshop__counts__owned">{addedIds.size} in your team</span>
              )}
            </div>
          </div>

          {/* Active chips */}
          {hasActiveFilters && (
            <div className="excerciseshop__chips">
              {search && (
                <span className="excerciseshop__chip">"{search}" <button onClick={() => setSearch("")}>×</button></span>
              )}
              {activeTags.map((tag) => (
                <span key={tag} className={`excerciseshop__chip tags tags--${tag.toLowerCase()} tags--${tag.toLowerCase()}--active`}>
                  {tag}<button onClick={() => toggleTag(tag)}>×</button>
                </span>
              ))}
              {activeDiffs.map((d) => (
                <span key={d} className="excerciseshop__chip">
                  Difficulty {d}<button onClick={() => toggleDiff(d)}>×</button>
                </span>
              ))}
              <button className="excerciseshop__chip__clear" onClick={clearFilters}>Clear all</button>
            </div>
          )}

          {loading && <p className="excerciseshop__status">Loading exercises...</p>}

          {!loading && (
            <>
              {/* ── New to your team ── */}
              {newFiltered.length > 0 && (
                <section className="excerciseshop__section">
                  {!hasActiveFilters && (
                    <div className="excerciseshop__section__header">
                      <h2 className="excerciseshop__section__title">Available to add</h2>
                      <span className="excerciseshop__section__count">{newFiltered.length}</span>
                    </div>
                  )}
                  <div className="excerciseshop__grid">
                    {newFiltered.map((exercise) => (
                      <ExerciseShopCard
                        key={exercise.id}
                        exercise={exercise}
                        isAdded={addedIds.has(exercise.id!)}
                        isAdding={addingIds.has(exercise.id!)}
                        userTeam={userTeam}
                        onAdd={() => handleAdd(exercise.id!)}
                        onView={() => navigate(`/exercise-detail/${exercise.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Already in your team ── */}
              {ownedFiltered.length > 0 && (
                <section className="excerciseshop__section excerciseshop__section--owned">
                  <div className="excerciseshop__section__header">
                    <h2 className="excerciseshop__section__title">Already in your library</h2>
                    <span className="excerciseshop__section__count excerciseshop__section__count--owned">{ownedFiltered.length}</span>
                  </div>
                  <div className="excerciseshop__grid">
                    {ownedFiltered.map((exercise) => (
                      <ExerciseShopCard
                        key={exercise.id}
                        exercise={exercise}
                        isAdded={true}
                        isAdding={false}
                        userTeam={userTeam}
                        onAdd={() => {}}
                        onView={() => navigate(`/exercise-detail/${exercise.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {filtered.length === 0 && exercises.length > 0 && (
                <div className="excerciseshop__empty">
                  <p>No exercises match your filters.</p>
                  <button className="btn__wired" onClick={clearFilters}>Clear filters</button>
                </div>
              )}

              {exercises.length === 0 && (
                <p className="excerciseshop__status">No exercises in the database yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Card component ────────────────────────────────────────────────────────────

interface CardProps {
  exercise: Exercise;
  isAdded: boolean;
  isAdding: boolean;
  userTeam: string;
  onAdd: () => void;
  onView: () => void;
}

const ExerciseShopCard = ({ exercise, isAdded, isAdding, userTeam, onAdd, onView }: CardProps) => {
  // Which team(s) own this exercise
  const teams: string[] = Array.isArray((exercise as any).team)
    ? (exercise as any).team
    : (exercise as any).team ? [(exercise as any).team] : [];

  return (
    <div className={`excerciseshop__card ${isAdded ? "excerciseshop__card--owned" : ""}`}>

      {/* Sketch */}
      <div className="excerciseshop__card__sketch" onClick={onView}>
        <SketchThumbnail sketch={exercise.sketch} />
        {isAdded && (
          <div className="excerciseshop__card__owned__badge">
            <svg width="12" height="10" viewBox="0 0 14 11" fill="none">
              <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            In library
          </div>
        )}
      </div>

      {/* Content */}
      <div className="excerciseshop__card__content">
        <div className="excerciseshop__card__meta">
          <span className="excerciseshop__card__author">{exercise.author}</span>
          <div className={`difficulty difficulty--${exercise.difficulty}`}>
            <svg width="14" height="16" viewBox="0 0 21 24" fill="none">
              <path className={`difficulty--${exercise.difficulty}__path1`} d="M0 17.5238H6V24H0V17.5238Z" fill="#1E1E1E" />
              <path className={`difficulty--${exercise.difficulty}__path2`} d="M7.5 8.7619H13.5V24H7.5V8.7619Z" fill="#1E1E1E" />
              <path className={`difficulty--${exercise.difficulty}__path3`} d="M15 0H21V24H15V0Z" fill="#1E1E1E" />
            </svg>
          </div>
        </div>

        <h3 className="excerciseshop__card__title" onClick={onView}>{exercise.title}</h3>

        {exercise.description && (
          <p className="excerciseshop__card__desc">
            {exercise.description.replace(/\n/g, " ").substring(0, 90)}
            {exercise.description.length > 90 ? "…" : ""}
          </p>
        )}

        <div className="excerciseshop__card__tags">
          {(exercise.tags ?? []).slice(0, 3).map((tag) => (
            <span key={tag} className={`tags tags--${tag.toLowerCase()}`}>{tag}</span>
          ))}
        </div>

        {/* Team chips */}
        {teams.length > 0 && (
          <div className="excerciseshop__card__teams">
            {teams.map((t) => (
              <span key={t} className={`excerciseshop__card__team ${t === userTeam ? "excerciseshop__card__team--yours" : ""}`}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="excerciseshop__card__actions">
          <button className="excerciseshop__card__view__btn" onClick={onView}>
            View
            <svg width="14" height="8" viewBox="0 0 23 12" fill="none">
              <path d="M1 5.25H0.25V6.75H1V5.25ZM22.53 6.53C22.82 6.24 22.82 5.76 22.53 5.47L17.76 0.697C17.46 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.94 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.53 6.53ZM1 6.75H22V5.25H1V6.75Z" fill="currentColor" />
            </svg>
          </button>

          {!isAdded ? (
            <button
              className="excerciseshop__card__add__btn btn__primary"
              onClick={onAdd}
              disabled={isAdding || !userTeam}
              title={!userTeam ? "Set your team in Profile first" : ""}
            >
              {isAdding ? (
                "Adding…"
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Add to team
                </>
              )}
            </button>
          ) : (
            <span className="excerciseshop__card__added__label">
              <svg width="12" height="10" viewBox="0 0 14 11" fill="none">
                <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Added
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseShop;