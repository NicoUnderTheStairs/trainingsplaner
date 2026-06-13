import { useEffect, useRef, useState } from "react";
import { collection, getDocs, query, where, deleteDoc, addDoc, doc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/authContext";
import { useGetUserData } from "../../../hooks/useGetUserData";
import db from "../../../firebase";
import type { SketchData } from "../../../types/Sketch";
import type { Exercise } from "../../../types/Exercise";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_TAGS = [
  "Warmup",
  "Defense",
  "Attack",
  "Block",
  "Reception",
  "Service",
];
const DIFFICULTIES = [1, 2, 3, 4, 5];

// ─── Sketch thumbnail ─────────────────────────────────────────────────────────

const PLAYER_COLORS: Record<string, string> = {
  outside: "#E63C2F",
  opposite: "#F5A623",
  middleBlocker: "#4DB87A",
  setter: "#3EC6D4",
  libero: "#624DB8",
  coach: "#FFEE52",
  // Legacy backward compat
  attacker: "#E63C2F",
  defender: "#3EC6D4",
};
const PLAYER_LABELS: Record<string, string> = {
  outside: "OH",
  opposite: "OP",
  middleBlocker: "MB",
  setter: "S",
  libero: "L",
  coach: "C",
  // Legacy
  attacker: "OH",
  defender: "S",
};

const SketchThumbnail = ({ sketch }: { sketch: SketchData }) => {
  const players = sketch?.players ? Object.entries(sketch.players) : [];
  const arrows = sketch?.arrows ? Object.entries(sketch.arrows) : [];
  const objects = (sketch as any)?.objects
    ? Object.entries((sketch as any).objects)
    : [];
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 560 440"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="thumb-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 Z" fill="#1E1E1E" />
        </marker>
      </defs>
      <path d="M560 0H0V440H560V0Z" fill="white" />
      <path
        d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z"
        fill="#F4EDE0"
      />
      <path
        d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203"
        stroke="black"
        strokeWidth="1"
      />
      {/* Objects beneath players */}
      {objects.map(([id, obj]: [string, any]) => (
        <g key={id} transform={`translate(${obj.x}, ${obj.y})`}>
          {obj.type === "pylon" && (
            <polygon
              points="0,-13 11,8 -11,8"
              fill="#FF8C00"
              stroke="#1E1E1E"
              strokeWidth={1.5}
            />
          )}
          {obj.type === "bench" && (
            <>
              <rect
                x={-15}
                y={-7}
                width={30}
                height={14}
                fill="#8B5E3C"
                stroke="#1E1E1E"
                strokeWidth={1.5}
                rx={2}
              />
              <line
                x1={-11}
                y1={7}
                x2={-11}
                y2={12}
                stroke="#1E1E1E"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              <line
                x1={11}
                y1={7}
                x2={11}
                y2={12}
                stroke="#1E1E1E"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </>
          )}
          {obj.type === "matt" && (
            <rect
              x={-22}
              y={-10}
              width={44}
              height={20}
              fill="#4A90D9"
              stroke="#1E1E1E"
              strokeWidth={1.5}
              rx={3}
            />
          )}
          {obj.type === "ball" && (
            <circle r={8} fill="#FFEE52" stroke="#1E1E1E" strokeWidth={1.5} />
          )}
        </g>
      ))}
      {arrows.map(([id, arrow]: [string, any]) => (
        <line
          key={id}
          x1={arrow.x1}
          y1={arrow.y1}
          x2={arrow.x2}
          y2={arrow.y2}
          stroke="#1E1E1E"
          strokeWidth="2"
          strokeDasharray={arrow.style === "dashed" ? "6 4" : undefined}
          markerEnd="url(#thumb-arrow)"
        />
      ))}
      {players.map(([id, player]: [string, any]) => (
        <g key={id} transform={`translate(${player.x}, ${player.y})`}>
          <circle r={11} fill={PLAYER_COLORS[player.type] ?? "#999"} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill={player.type === "coach" ? "#1E1E1E" : "white"}
            fontSize={11}
            fontWeight="bold"
            fontFamily="Roboto, sans-serif"
          >
            {PLAYER_LABELS[player.type] ?? "?"}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const ExerciseListSkeleton = () => (
  <div className="excerciselist__exercise__wrapper">
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        style={{
          minWidth: "28rem",
          maxWidth: "28rem",
          border: "0.5rem solid rgba(30,30,30,0.1)",
          borderRadius: "2rem",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span className="sk sk--rect" style={{ height: "22rem", width: "100%", borderRadius: 0 }} />
        <div className="sk-stack" style={{ padding: "1.6rem 1.8rem", gap: "0.8rem" }}>
          <span className="sk sk--line-xl sk--w75" />
          <span className="sk sk--line sk--w100" />
          <span className="sk sk--line sk--w65" />
          <div className="sk-row" style={{ marginTop: "0.4rem" }}>
            <span className="sk sk--rect" style={{ width: "7rem", height: "2rem" }} />
            <span className="sk sk--rect" style={{ width: "2.4rem", height: "2.4rem" }} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const ExcerciseList = () => {
  const navigate = useNavigate();
  const uid = getAuth().currentUser?.uid;
  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>(
    {},
  );

  // Favourite IDs for the current user
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [loadingFavourites, setLoadingFavourites] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeDifficulties, setActiveDifficulties] = useState<number[]>([]);
  const [showFavourites, setShowFavourites] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActioning, setIsActioning] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justEnteredSelectMode = useRef(false);

  // ── Fetch exercises + variant counts ───────────────────────────────────────
  useEffect(() => {
    if (userData === null) return; // wait for profile to resolve before querying

    const fetchExercises = async () => {
      try {
        const userTeam = (userData as any)?.team ?? "";
        const snapshot = userTeam
          ? await getDocs(
              query(
                collection(db, "Excercises"),
                where("team", "array-contains", userTeam),
              ),
            )
          : await getDocs(collection(db, "Excercises"));
        const data: Exercise[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Exercise, "id">),
        }));
        setExercises(data);

        // Batch-fetch variant counts
        const groupIds = [
          ...new Set(
            data
              .map((ex) => (ex as any).variantGroupId as string | undefined)
              .filter(Boolean) as string[],
          ),
        ];

        if (groupIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < groupIds.length; i += 30)
            chunks.push(groupIds.slice(i, i + 30));
          const counts: Record<string, number> = {};
          await Promise.all(
            chunks.map(async (chunk) => {
              const q = query(
                collection(db, "ExerciseVariants"),
                where("__name__", "in", chunk),
              );
              const snap = await getDocs(q);
              snap.docs.forEach((d) => {
                const ids: string[] = d.data().exerciseIds ?? [];
                ids.forEach((eid) => {
                  counts[eid] = ids.length - 1;
                });
              });
            }),
          );
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
  }, [userData]);

  // ── Fetch user's favourite exercise IDs ───────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setLoadingFavourites(false);
      return;
    }
    const fetchFavourites = async () => {
      try {
        const snap = await getDocs(
          collection(db, "users", uid, "favouriteExercises"),
        );
        setFavouriteIds(new Set(snap.docs.map((d) => d.id)));
      } catch (e) {
        console.error("Error fetching favourites:", e);
      } finally {
        setLoadingFavourites(false);
      }
    };
    fetchFavourites();
  }, [uid]);

  // ── Close filter on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const toggleTag = (tag: string) =>
    setActiveTags((p) =>
      p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag],
    );
  const toggleDifficulty = (d: number) =>
    setActiveDifficulties((p) =>
      p.includes(d) ? p.filter((x) => x !== d) : [...p, d],
    );
  const clearFilters = () => {
    setActiveTags([]);
    setActiveDifficulties([]);
    setSearch("");
    setShowFavourites(false);
  };

  // ── Select mode handlers ───────────────────────────────────────────────────
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePointerDown = (id: string) => (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    longPressTimer.current = setTimeout(() => {
      justEnteredSelectMode.current = true;
      setIsSelectMode(true);
      setSelectedIds(new Set([id]));
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    setIsActioning(true);
    try {
      await Promise.all([...selectedIds].map((id) => deleteDoc(doc(db, "Excercises", id))));
      setExercises((prev) => prev.filter((ex) => !selectedIds.has(ex.id!)));
      setDeleteConfirmOpen(false);
      exitSelectMode();
    } finally {
      setIsActioning(false);
    }
  };

  const handleDuplicate = async () => {
    if (selectedIds.size === 0) return;
    setIsActioning(true);
    try {
      const toDup = exercises.filter((ex) => selectedIds.has(ex.id!));
      const added = await Promise.all(
        toDup.map(async (ex) => {
          const { id, ...data } = ex;
          const ref = await addDoc(collection(db, "Excercises"), {
            ...data,
            title: `Copy of ${data.title ?? "Untitled"}`,
          });
          return { ...data, id: ref.id } as Exercise;
        }),
      );
      setExercises((prev) => [...added, ...prev]);
      exitSelectMode();
    } finally {
      setIsActioning(false);
    }
  };

  const handleShare = async () => {
    const toShare = exercises.filter((ex) => selectedIds.has(ex.id!));
    const text = toShare.map((ex) => ex.title ?? "Untitled").join("\n");
    if (navigator.share) {
      try { await navigator.share({ title: "Exercises", text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
    }
    exitSelectMode();
  };

  const hasActiveFilters =
    activeTags.length > 0 ||
    activeDifficulties.length > 0 ||
    search.trim() !== "" ||
    showFavourites;

  const filtered = exercises.filter((ex) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      ex.title.toLowerCase().includes(q) ||
      ex.description?.toLowerCase().includes(q);
    const matchesTags =
      activeTags.length === 0 ||
      activeTags.every((tag) => (ex.tags ?? []).includes(tag));
    const matchesDiff =
      activeDifficulties.length === 0 ||
      activeDifficulties.includes(ex.difficulty);
    const matchesFav = !showFavourites || favouriteIds.has(ex.id!);
    return matchesSearch && matchesTags && matchesDiff && matchesFav;
  });

  const favouriteCount = exercises.filter((ex) =>
    favouriteIds.has(ex.id!),
  ).length;

  return (
    <>
      <div className="excerciselist section">
        <div className="excerciselist__inner">
          {/* Header */}
          <div className="excerciselist__menu">
            <h2>
              All Exercises{" "}
              <span>
                ({hasActiveFilters ? `${filtered.length}/` : ""}
                {exercises.length})
              </span>
            </h2>

            <div className="excerciselist__menu__buttons">
              {/* Search */}
              <div className="excerciselist__search__wrapper">
                <input
                  type="text"
                  className="excerciselist__menu__buttons--search"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    className="excerciselist__search__clear"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Favourites toggle */}
              <button
                className={`excerciselist__menu__buttons--favourites ${showFavourites ? "excerciselist__menu__buttons--favourites--active" : ""}`}
                onClick={() => setShowFavourites((p) => !p)}
                title={
                  showFavourites ? "Show all exercises" : "Show favourites only"
                }
                disabled={loadingFavourites}
              >
                <svg width="16" height="15" viewBox="0 0 26 24" fill="none">
                  <path
                    d="M19.2754 1.5C22.2429 1.5 24.4998 3.75726 24.5 6.79199C24.5 8.52207 24.2672 9.79464 23.8379 10.8643C23.4088 11.9333 22.7465 12.892 21.7627 13.9512C20.7617 15.0288 19.4807 16.1562 17.8262 17.6025C16.4436 18.8112 14.8339 20.216 13 21.9346C11.1661 20.216 9.55644 18.8112 8.17383 17.6025C6.51934 16.1562 5.2383 15.0288 4.2373 13.9512C3.25348 12.892 2.59124 11.9333 2.16211 10.8643C1.73284 9.79464 1.5 8.52207 1.5 6.79199C1.50023 3.75726 3.7571 1.5 6.72461 1.5C8.77382 1.50018 10.5736 2.70206 11.71 4.61523L13 6.78613L14.29 4.61523C15.4264 2.70206 17.2262 1.50018 19.2754 1.5Z"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill={showFavourites ? "currentColor" : "none"}
                  />
                </svg>
                Favourites
                {!loadingFavourites && favouriteCount > 0 && (
                  <span className="excerciselist__filter__badge">
                    {favouriteCount}
                  </span>
                )}
              </button>

              {/* Filter dropdown */}
              <div className="excerciselist__filter__wrapper" ref={filterRef}>
                <button
                  className={`excerciselist__menu__buttons--filter ${filterOpen ? "excerciselist__menu__buttons--filter--open" : ""}`}
                  onClick={() => setFilterOpen((p) => !p)}
                >
                  Filter
                  {/* Only count tags + difficulty in the filter badge — favourites has its own button */}
                  {activeTags.length + activeDifficulties.length > 0 && (
                    <span className="excerciselist__filter__badge">
                      {activeTags.length + activeDifficulties.length}
                    </span>
                  )}
                </button>

                {filterOpen && (
                  <div className="excerciselist__filter__dropdown">
                    <div className="excerciselist__filter__section">
                      <p className="excerciselist__filter__label">Tags</p>
                      <div className="excerciselist__filter__tags">
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
                    <div className="excerciselist__filter__section">
                      <p className="excerciselist__filter__label">Difficulty</p>
                      <div className="excerciselist__filter__difficulties">
                        {DIFFICULTIES.map((d) => (
                          <button
                            key={d}
                            onClick={() => toggleDifficulty(d)}
                            className={`excerciselist__filter__difficulty ${activeDifficulties.includes(d) ? "excerciselist__filter__difficulty--active" : ""}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="excerciselist__filter__footer">
                      <button
                        className="excerciselist__filter__clear"
                        onClick={clearFilters}
                        disabled={!hasActiveFilters}
                      >
                        Clear all
                      </button>
                      <button
                        className="excerciselist__filter__apply btn__primary"
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
                onClick={() => navigate("/create-exercise")}
                className="btn__primary"
              >
                + New Exercise
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="excerciselist__filter__chips">
              {showFavourites && (
                <span className="excerciselist__filter__chip excerciselist__filter__chip--favourite">
                  <svg width="12" height="11" viewBox="0 0 26 24" fill="none">
                    <path
                      d="M19.2754 1.5C22.2429 1.5 24.4998 3.75726 24.5 6.79199C24.5 8.52207 24.2672 9.79464 23.8379 10.8643C23.4088 11.9333 22.7465 12.892 21.7627 13.9512C20.7617 15.0288 19.4807 16.1562 17.8262 17.6025C16.4436 18.8112 14.8339 20.216 13 21.9346C11.1661 20.216 9.55644 18.8112 8.17383 17.6025C6.51934 16.1562 5.2383 15.0288 4.2373 13.9512C3.25348 12.892 2.59124 11.9333 2.16211 10.8643C1.73284 9.79464 1.5 8.52207 1.5 6.79199C1.50023 3.75726 3.7571 1.5 6.72461 1.5C8.77382 1.50018 10.5736 2.70206 11.71 4.61523L13 6.78613L14.29 4.61523C15.4264 2.70206 17.2262 1.50018 19.2754 1.5Z"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="currentColor"
                    />
                  </svg>
                  Favourites
                  <button
                    onClick={() => setShowFavourites(false)}
                    aria-label="Remove favourites filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {search && (
                <span className="excerciselist__filter__chip">
                  "{search}"<button onClick={() => setSearch("")}>×</button>
                </span>
              )}
              {activeTags.map((tag) => (
                <span
                  key={tag}
                  className={`excerciselist__filter__chip tags tags--${tag.toLowerCase()} tags--${tag.toLowerCase()}--active`}
                >
                  {tag}
                  <button onClick={() => toggleTag(tag)}>×</button>
                </span>
              ))}
              {activeDifficulties.map((d) => (
                <span
                  key={d}
                  className="excerciselist__filter__chip excerciselist__filter__chip--difficulty"
                >
                  Difficulty {d}
                  <button onClick={() => toggleDifficulty(d)}>×</button>
                </span>
              ))}
              <button
                className="excerciselist__filter__chip__clear"
                onClick={clearFilters}
              >
                Clear all
              </button>
            </div>
          )}

          {loading && <ExerciseListSkeleton />}
          {error && (
            <p className="excerciselist__status excerciselist__status--error">
              {error}
            </p>
          )}

          {!loading && !error && (
            <div className="excerciselist__exercise__wrapper">
              {filtered.map((exercise) => {
                const variantCount = variantCounts[exercise.id!] ?? 0;
                const isFav = favouriteIds.has(exercise.id!);
                return (
                  <div
                    key={exercise.id}
                    className={[
                      "excerciselist__exercise",
                      isSelectMode && selectedIds.has(exercise.id!) ? "excerciselist__exercise--multi-selected" : "",
                      isSelectMode ? "excerciselist__exercise--selectable" : "",
                    ].filter(Boolean).join(" ")}
                    onPointerDown={handlePointerDown(exercise.id!)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={() => {
                      if (justEnteredSelectMode.current) {
                        justEnteredSelectMode.current = false;
                        return;
                      }
                      if (isSelectMode) {
                        toggleSelect(exercise.id!);
                      } else {
                        navigate(`/exercise-detail/${exercise.id}`);
                      }
                    }}
                  >
                    {/* Select mode checkbox */}
                    {isSelectMode && (
                      <div className={`excerciselist__exercise__checkbox${selectedIds.has(exercise.id!) ? " excerciselist__exercise__checkbox--checked" : ""}`}>
                        {selectedIds.has(exercise.id!) && (
                          <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                            <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    )}

                    {/* Variant badge */}
                    {variantCount > 0 && (
                      <div
                        className="excerciselist__exercise__variants"
                        title={`${variantCount} variant${variantCount !== 1 ? "s" : ""}`}
                      >
                        {variantCount}
                      </div>
                    )}

                    {/* Favourite heart badge */}
                    {isFav && (
                      <div
                        className="excerciselist__exercise__favourite"
                        title="Favourited"
                      >
                        <svg
                          width="12"
                          height="11"
                          viewBox="0 0 26 24"
                          fill="none"
                        >
                          <path
                            d="M19.2754 1.5C22.2429 1.5 24.4998 3.75726 24.5 6.79199C24.5 8.52207 24.2672 9.79464 23.8379 10.8643C23.4088 11.9333 22.7465 12.892 21.7627 13.9512C20.7617 15.0288 19.4807 16.1562 17.8262 17.6025C16.4436 18.8112 14.8339 20.216 13 21.9346C11.1661 20.216 9.55644 18.8112 8.17383 17.6025C6.51934 16.1562 5.2383 15.0288 4.2373 13.9512C3.25348 12.892 2.59124 11.9333 2.16211 10.8643C1.73284 9.79464 1.5 8.52207 1.5 6.79199C1.50023 3.75726 3.7571 1.5 6.72461 1.5C8.77382 1.50018 10.5736 2.70206 11.71 4.61523L13 6.78613L14.29 4.61523C15.4264 2.70206 17.2262 1.50018 19.2754 1.5Z"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="currentColor"
                          />
                        </svg>
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
                        <div className="excerciselist__exercise__content__tags">
                          {(exercise.tags ?? []).slice(0, 2).map((tag) => (
                            <div
                              key={tag}
                              className={`tags tags--${tag.toLowerCase()}`}
                            >
                              <span className="excerciselist__exercise__content__tags--tag">
                                {tag}
                              </span>
                            </div>
                          ))}
                          {(exercise.tags ?? []).length > 2 && (
                            <span className="excerciselist__exercise__content__tags--more">
                              +{(exercise.tags ?? []).length - 2}
                            </span>
                          )}
                        </div>
                        <div
                          className={`difficulty difficulty--${exercise.difficulty}`}
                        >
                          <svg
                            width="21"
                            height="24"
                            viewBox="0 0 21 24"
                            fill="none"
                          >
                            <path
                              className={`difficulty__path1 difficulty--${exercise.difficulty}__path1`}
                              d="M0 17.5238H6V24H0V17.5238Z"
                              fill="#1E1E1E"
                            />
                            <path
                              className={`difficulty__path2 difficulty--${exercise.difficulty}__path2`}
                              d="M7.5 8.7619H13.5V24H7.5V8.7619Z"
                              fill="#1E1E1E"
                            />
                            <path
                              className={`difficulty__path3 difficulty--${exercise.difficulty}__path3`}
                              d="M15 0H21V24H15V0Z"
                              fill="#1E1E1E"
                            />
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
                  <p>
                    {showFavourites && favouriteCount === 0
                      ? "You haven't favourited any exercises yet."
                      : "No exercises match your filters."}
                  </p>
                  <button className="btn__wired" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              )}

              {exercises.length === 0 && (
                <p className="excerciselist__status">No exercises yet.</p>
              )}
            </div>
          )}

          {/* ── Shop teaser — outside inner to prevent any overlap with cards ── */}
          <div className="excerciselist__shopteaser__wrapper">
            <div
              className="excerciselist__shopteaser"
              onClick={() => navigate("/exercise-shop")}
            >
              <div className="excerciselist__shopteaser__icon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 2L3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6L18 2H6Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 6H21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="excerciselist__shopteaser__text">
                <span className="excerciselist__shopteaser__headline">
                  Need fresh inspiration?
                </span>
                <span className="excerciselist__shopteaser__sub">
                  Snoop around the Exercise Shop and discover drills from other
                  teams.
                </span>
              </div>
              <div className="excerciselist__shopteaser__cta">
                Browse Shop
                <svg width="16" height="10" viewBox="0 0 23 12" fill="none">
                  <path
                    d="M1 5.25H0.25V6.75H1V5.25ZM22.53 6.53C22.82 6.24 22.82 5.76 22.53 5.47L17.76 0.697C17.46 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.94 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.53 6.53ZM1 6.75H22V5.25H1V6.75Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Select mode toolbar ──────────────────────────────────────────── */}
      {isSelectMode && (
        <div className="excerciselist__select-toolbar">
          <span className="excerciselist__select-toolbar__count">
            {selectedIds.size} selected
          </span>
          <div className="excerciselist__select-toolbar__actions">
            <button
              className="excerciselist__select-toolbar__btn"
              onClick={handleDuplicate}
              disabled={selectedIds.size === 0 || isActioning}
            >
              Duplicate
            </button>
            <button
              className="excerciselist__select-toolbar__btn"
              onClick={handleShare}
              disabled={selectedIds.size === 0 || isActioning}
            >
              Share
            </button>
            <button
              className="excerciselist__select-toolbar__btn excerciselist__select-toolbar__btn--delete"
              onClick={handleDelete}
              disabled={selectedIds.size === 0 || isActioning}
            >
              Delete
            </button>
          </div>
          <button className="excerciselist__select-toolbar__cancel" onClick={exitSelectMode}>
            ✕
          </button>
        </div>
      )}

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      {deleteConfirmOpen && (
        <div
          className="dialog__overlay"
          onClick={() => !isActioning && setDeleteConfirmOpen(false)}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog__title">
              Delete {selectedIds.size} exercise{selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p className="dialog__body">
              This will permanently delete the selected exercise{selectedIds.size !== 1 ? "s" : ""}. This cannot be undone.
            </p>
            <div className="dialog__actions">
              <button
                className="btn__wired"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isActioning}
              >
                Cancel
              </button>
              <button
                className="btn__danger"
                onClick={executeDelete}
                disabled={isActioning}
              >
                {isActioning ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExcerciseList;
