import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, getDoc, doc, deleteDoc, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import db from "../../../firebase";
import type { Training } from "../../../types/Training";
import type { SharedTrainingRef } from "../../../services/upload/registerUser";
import { useAuth } from "../../../auth/authContext";
import { useGetUserData } from "../../../hooks/useGetUserData";
import ShareDialog from "../shareDialog/ShareDialog";

interface ListTraining extends Training {
  ownerId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const AVAILABLE_TAGS = [
  "Warmup",
  "Defense",
  "Attack",
  "Block",
  "Reception",
  "Service",
  "Setting",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateKey = (date: any): string => {
  if (!date) return "";
  const d = typeof date.toDate === "function" ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getWeekDays = (monday: Date): Date[] =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

const getCalendarDays = (monthDate: Date): { date: Date; currentMonth: boolean }[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Convert Sunday-based (0=Sun) to Monday-based (0=Mon)
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const days: { date: Date; currentMonth: boolean }[] = [];

  for (let i = startDow - 1; i >= 0; i--)
    days.push({ date: new Date(year, month, -i), currentMonth: false });

  for (let d = 1; d <= lastDay.getDate(); d++)
    days.push({ date: new Date(year, month, d), currentMonth: true });

  const remaining = 7 - (days.length % 7);
  if (remaining < 7)
    for (let d = 1; d <= remaining; d++)
      days.push({ date: new Date(year, month + 1, d), currentMonth: false });

  return days;
};

const formatDate = (date: any): string => {
  if (!date) return "—";
  const d = typeof date.toDate === "function" ? date.toDate() : new Date(date);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const dayMonth = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${weekday}, ${dayMonth}`;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const TrainingListSkeleton = () => (
  <div className="traininglist__layout">
    <aside className="traininglist__sidebar">
      <section className="traininglist__calendar">
        {/* calendar header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.6rem" }}>
          <span className="sk sk--circle" style={{ width: "2.4rem", height: "2.4rem" }} />
          <span className="sk sk--line-lg sk--w40" />
          <span className="sk sk--circle" style={{ width: "2.4rem", height: "2.4rem" }} />
        </div>
        {/* weekday row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.4rem", marginBottom: "0.4rem" }}>
          {["M","T","W","T","F","S","S"].map((d, i) => (
            <span key={i} style={{ textAlign: "center", fontSize: "1.2rem", color: "rgba(30,30,30,0.3)" }}>{d}</span>
          ))}
        </div>
        {/* day cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.4rem" }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <span key={i} className="sk sk--rect" style={{ height: "3.6rem" }} />
          ))}
        </div>
      </section>
    </aside>

    <div className="traininglist__content">
      <div className="sk-stack" style={{ gap: "1.6rem" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sk-card">
            <div className="sk-row">
              <span className="sk sk--line sk--w30" style={{ flex: 1 }} />
              <span className="sk sk--rect" style={{ width: "5rem", height: "1.6rem" }} />
            </div>
            <span className="sk sk--line-xl sk--w65" />
            <span className="sk sk--line sk--w40" />
            <div className="sk-row" style={{ marginTop: "0.4rem" }}>
              <span className="sk sk--rect" style={{ width: "6rem", height: "2rem" }} />
              <span className="sk sk--rect" style={{ width: "6rem", height: "2rem" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const TrainingList = () => {
  const navigate = useNavigate();
  const currentUserId = getAuth().currentUser?.uid ?? "";
  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");

  // ── Data ─────────────────────────────────────────────────────────────────
  const [trainings, setTrainings] = useState<ListTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Calendar ──────────────────────────────────────────────────────────────
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(today);
    mon.setDate(today.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  // ── Search & filter ───────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [minPlayers, setMinPlayers] = useState<number>(0); // 0 = any
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Select mode ───────────────────────────────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActioning, setIsActioning] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogTrainings, setShareDialogTrainings] = useState<ListTraining[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justEnteredSelectMode = useRef(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        const userId = getAuth().currentUser?.uid;
        if (!userId) throw new Error("Not authenticated");

        const snapshot = await getDocs(
          collection(db, "users", userId, "trainings"),
        );
        const ownTrainings: ListTraining[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Training, "id">),
        }));

        // Fetch shared trainings from sharedWithMe refs
        const userSnap = await getDoc(doc(db, "users", userId));
        const sharedRefs: SharedTrainingRef[] = userSnap.exists()
          ? (userSnap.data().sharedWithMe ?? [])
          : [];

        const sharedResults = await Promise.all(
          sharedRefs.map(async (ref) => {
            try {
              const snap = await getDoc(
                doc(db, "users", ref.ownerId, "trainings", ref.trainingId),
              );
              if (!snap.exists()) return null;
              return {
                id: snap.id,
                ...(snap.data() as Omit<Training, "id">),
                ownerId: ref.ownerId,
              } as ListTraining;
            } catch {
              return null;
            }
          }),
        );

        const all: ListTraining[] = [
          ...ownTrainings,
          ...(sharedResults.filter(Boolean) as ListTraining[]),
        ];

        all.sort((a, b) => {
          const dateA = (a.date as any)?.toDate?.() ?? new Date(a.date);
          const dateB = (b.date as any)?.toDate?.() ?? new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });

        setTrainings(all);
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
    setMinPlayers(0);
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
    const userId = getAuth().currentUser?.uid;
    if (!userId) return;
    setIsActioning(true);
    try {
      const ownIds = [...selectedIds].filter((id) => !trainings.find((t) => t.id === id)?.ownerId);
      await Promise.all(ownIds.map((id) => deleteDoc(doc(db, "users", userId, "trainings", id))));
      setTrainings((prev) => prev.filter((t) => !new Set(ownIds).has(t.id!)));
      setDeleteConfirmOpen(false);
      exitSelectMode();
    } finally {
      setIsActioning(false);
    }
  };

  const handleDuplicate = async () => {
    if (selectedIds.size === 0) return;
    const userId = getAuth().currentUser?.uid;
    if (!userId) return;
    setIsActioning(true);
    try {
      const toDup = trainings.filter((t) => selectedIds.has(t.id!) && !t.ownerId);
      const added = await Promise.all(
        toDup.map(async (t) => {
          const { id, ownerId, ...data } = t;
          const ref = await addDoc(collection(db, "users", userId, "trainings"), {
            ...data,
            title: `Copy of ${data.title ?? "Untitled"}`,
          });
          return { ...data, id: ref.id } as ListTraining;
        }),
      );
      setTrainings((prev) => [...added, ...prev]);
      exitSelectMode();
    } finally {
      setIsActioning(false);
    }
  };

  const handleShare = () => {
    const toShare = trainings.filter((t) => selectedIds.has(t.id!) && !t.ownerId);
    if (toShare.length === 0) return;
    setShareDialogTrainings(toShare);
    setShareDialogOpen(true);
  };

  const hasActiveFilters =
    activeTags.length > 0 || search.trim() !== "" || minPlayers > 0;
  const activeFilterCount = activeTags.length + (minPlayers > 0 ? 1 : 0);

  // ── Calendar derived data ─────────────────────────────────────────────────
  const trainingDays = useMemo(() => {
    const keys = new Set<string>();
    trainings.forEach((tr) => {
      const key = toDateKey(tr.date);
      if (key) keys.add(key);
    });
    return keys;
  }, [trainings]);

  const trainingMonths = useMemo(() => {
    const months = new Set<string>();
    trainings.forEach((tr) => {
      const key = toDateKey(tr.date);
      if (key) months.add(key.slice(0, 7));
    });
    return months;
  }, [trainings]);

  const todayKey = toDateKey(new Date());
  const calendarDays = getCalendarDays(calendarMonth);

  const handleCalendarDayClick = (dateKey: string) => {
    if (trainingDays.has(dateKey)) {
      // Toggle selection and scroll to the card
      const next = selectedDay === dateKey ? null : dateKey;
      setSelectedDay(next);
      if (next) {
        const match = trainings.find((tr) => toDateKey(tr.date) === next);
        if (match) {
          setTimeout(() => {
            document
              .getElementById(`training-card-${match.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 50);
        }
      }
    } else {
      navigate("/create-training", { state: { date: dateKey } });
    }
  };

  // Restricts the list to whatever range the calendar is currently showing
  // (the selected week/month/year), so the list on the right stays in sync
  // with the calendar on the left instead of showing every training ever made.
  const isWithinCalendarRange = (tr: ListTraining): boolean => {
    const key = toDateKey(tr.date);
    if (!key) return false;
    if (calendarView === "yearly") {
      return key.slice(0, 4) === String(calendarMonth.getFullYear());
    }
    if (calendarView === "monthly") {
      const monthKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
      return key.slice(0, 7) === monthKey;
    }
    // weekly
    const weekKeys = new Set(getWeekDays(weekStart).map((d) => toDateKey(d)));
    return weekKeys.has(key);
  };

  const calendarRangeLabel =
    calendarView === "yearly"
      ? "year"
      : calendarView === "monthly"
        ? "month"
        : "week";

  const calendarRangeCaption =
    calendarView === "yearly"
      ? String(calendarMonth.getFullYear())
      : calendarView === "monthly"
        ? calendarMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        : (() => {
            const weekDays = getWeekDays(weekStart);
            return `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
          })();

  // Prefill "create training" with a sensible date inside the currently viewed range
  const calendarRangeStart =
    calendarView === "yearly"
      ? new Date(calendarMonth.getFullYear(), 0, 1)
      : calendarView === "monthly"
        ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
        : weekStart;

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = trainings.filter((tr) => {
    const q = search.trim().toLowerCase();

    // Search: title, description, author, tags, exercise titles
    const matchesSearch =
      q === "" ||
      tr.title?.toLowerCase().includes(q) ||
      tr.description?.toLowerCase().includes(q) ||
      tr.author?.toLowerCase().includes(q) ||
      (tr.tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
      (tr.exercises ?? []).some((ex) => ex.title?.toLowerCase().includes(q));

    const matchesTags =
      activeTags.length === 0 ||
      activeTags.every((tag) => (tr.tags ?? []).includes(tag));

    // Player count filter
    const totalPlayers = tr.players
      ? Object.values(tr.players).reduce((s, v) => s + v, 0)
      : 0;
    const matchesPlayers = minPlayers === 0 || totalPlayers >= minPlayers;

    // While actively searching/filtering, search the whole list; otherwise
    // stay scoped to whatever the calendar is currently showing.
    const matchesCalendar = hasActiveFilters || isWithinCalendarRange(tr);

    return matchesSearch && matchesTags && matchesPlayers && matchesCalendar;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="traininglist section">
      <div className="traininglist__inner">
        {/* Back */}
        <div className="exercisedetail__back">
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

                  <div className="traininglist__filter__section">
                    <p className="traininglist__filter__label">Min. players</p>
                    <div className="traininglist__filter__players">
                      {[0, 6, 8, 10, 12, 14].map((n) => (
                        <button
                          key={n}
                          onClick={() => setMinPlayers(n)}
                          className={`traininglist__filter__player__btn ${minPlayers === n ? "traininglist__filter__player__btn--active" : ""}`}
                        >
                          {n === 0 ? "Any" : `${n}+`}
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
            {minPlayers > 0 && (
              <span className="traininglist__filter__chip traininglist__filter__chip--players">
                {minPlayers}+ players
                <button onClick={() => setMinPlayers(0)}>×</button>
              </span>
            )}
            <button
              className="traininglist__filter__chip__clear"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Loading / error */}
        {loading && <TrainingListSkeleton />}
        {error && (
          <p className="traininglist__status traininglist__status--error">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            {/* No trainings at all — full-width empty state */}
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
            ) : (
              /* Two-column layout: sticky calendar left, scrollable list right */
              <div className="traininglist__layout">

                {/* ── Sidebar: calendar ──────────────────────────────────── */}
                <aside className="traininglist__sidebar">

                  {/* View selector */}
                  <div className="traininglist__view-selector">
                    {(["weekly", "monthly", "yearly"] as const).map((v) => (
                      <button
                        key={v}
                        className={`traininglist__view-selector__btn${calendarView === v ? " traininglist__view-selector__btn--active" : ""}`}
                        onClick={() => setCalendarView(v)}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>

                  <section className="traininglist__calendar">

                    {/* ── Weekly ── */}
                    {calendarView === "weekly" && (() => {
                      const weekDays = getWeekDays(weekStart);
                      const weekEnd = weekDays[6];
                      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
                      const weekLabel = sameMonth
                        ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${weekStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
                        : `${weekStart.getDate()} ${weekStart.toLocaleDateString("en-GB", { month: "short" })} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
                      return (
                        <>
                          <div className="traininglist__calendar__header">
                            <button
                              className="traininglist__calendar__nav"
                              onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}
                              aria-label="Previous week"
                            >
                              <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                                <path d="M8.5 1L1.5 8L8.5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <span className="traininglist__calendar__title">{weekLabel}</span>
                            <button
                              className="traininglist__calendar__nav"
                              onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}
                              aria-label="Next week"
                            >
                              <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                                <path d="M1.5 1L8.5 8L1.5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                          <div className="traininglist__calendar__grid">
                            {WEEKDAYS.map((d) => (
                              <div key={d} className="traininglist__calendar__weekday">{d}</div>
                            ))}
                            {weekDays.map((date, i) => {
                              const key = toDateKey(date);
                              const hasTraining = trainingDays.has(key);
                              const isToday = key === todayKey;
                              return (
                                <button
                                  key={i}
                                  className={[
                                    "traininglist__calendar__day",
                                    "traininglist__calendar__day--current",
                                    isToday ? "traininglist__calendar__day--today" : "",
                                    hasTraining ? "traininglist__calendar__day--has-training" : "",
                                    key === selectedDay ? "traininglist__calendar__day--selected" : "",
                                  ].filter(Boolean).join(" ")}
                                  onClick={() => handleCalendarDayClick(key)}
                                  aria-label={`${date.getDate()}${hasTraining ? " – training planned" : ""}`}
                                >
                                  <span>{date.getDate()}</span>
                                  {hasTraining && <i className="traininglist__calendar__day__dot" />}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}

                    {/* ── Monthly ── */}
                    {calendarView === "monthly" && (
                      <>
                        <div className="traininglist__calendar__header">
                          <button
                            className="traininglist__calendar__nav"
                            onClick={() =>
                              setCalendarMonth(
                                (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                              )
                            }
                            aria-label="Previous month"
                          >
                            <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                              <path d="M8.5 1L1.5 8L8.5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <span className="traininglist__calendar__title">
                            {calendarMonth.toLocaleDateString("en-GB", {
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          <button
                            className="traininglist__calendar__nav"
                            onClick={() =>
                              setCalendarMonth(
                                (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                              )
                            }
                            aria-label="Next month"
                          >
                            <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                              <path d="M1.5 1L8.5 8L1.5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>

                        <div className="traininglist__calendar__grid">
                          {WEEKDAYS.map((d) => (
                            <div key={d} className="traininglist__calendar__weekday">
                              {d}
                            </div>
                          ))}
                          {calendarDays.map(({ date, currentMonth }, i) => {
                            const key = toDateKey(date);
                            const hasTraining = trainingDays.has(key);
                            const isToday = key === todayKey;
                            return (
                              <button
                                key={i}
                                className={[
                                  "traininglist__calendar__day",
                                  currentMonth
                                    ? "traininglist__calendar__day--current"
                                    : "traininglist__calendar__day--other",
                                  isToday ? "traininglist__calendar__day--today" : "",
                                  hasTraining
                                    ? "traininglist__calendar__day--has-training"
                                    : "",
                                  key === selectedDay
                                    ? "traininglist__calendar__day--selected"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => currentMonth && handleCalendarDayClick(key)}
                                disabled={!currentMonth}
                                aria-label={`${date.getDate()}${hasTraining ? " – training planned" : ""}`}
                              >
                                <span>{date.getDate()}</span>
                                {hasTraining && (
                                  <i className="traininglist__calendar__day__dot" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* ── Yearly ── */}
                    {calendarView === "yearly" && (
                      <>
                        <div className="traininglist__calendar__header">
                          <button
                            className="traininglist__calendar__nav"
                            onClick={() =>
                              setCalendarMonth(
                                (m) => new Date(m.getFullYear() - 1, m.getMonth(), 1),
                              )
                            }
                            aria-label="Previous year"
                          >
                            <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                              <path d="M8.5 1L1.5 8L8.5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <span className="traininglist__calendar__title">
                            {calendarMonth.getFullYear()}
                          </span>
                          <button
                            className="traininglist__calendar__nav"
                            onClick={() =>
                              setCalendarMonth(
                                (m) => new Date(m.getFullYear() + 1, m.getMonth(), 1),
                              )
                            }
                            aria-label="Next year"
                          >
                            <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                              <path d="M1.5 1L8.5 8L1.5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                        <div className="traininglist__calendar__year-grid">
                          {Array.from({ length: 12 }, (_, i) => {
                            const monthKey = `${calendarMonth.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
                            const hasTrainings = trainingMonths.has(monthKey);
                            const monthDate = new Date(calendarMonth.getFullYear(), i, 1);
                            const now = new Date();
                            const isCurrentMonth =
                              now.getFullYear() === calendarMonth.getFullYear() &&
                              now.getMonth() === i;
                            return (
                              <button
                                key={i}
                                className={[
                                  "traininglist__calendar__month-btn",
                                  hasTrainings ? "traininglist__calendar__month-btn--has-training" : "",
                                  isCurrentMonth ? "traininglist__calendar__month-btn--current" : "",
                                ].filter(Boolean).join(" ")}
                                onClick={() => {
                                  setCalendarMonth(monthDate);
                                  setCalendarView("monthly");
                                }}
                              >
                                <span>
                                  {monthDate.toLocaleDateString("en-GB", { month: "short" })}
                                </span>
                                {hasTrainings && (
                                  <i className="traininglist__calendar__day__dot" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                  </section>
                </aside>

                {/* ── Content: training list ─────────────────────────────── */}
                <div className="traininglist__content">
                  {filtered.length === 0 ? (
                    <div className="traininglist__empty">
                      {hasActiveFilters ? (
                        <>
                          <div className="traininglist__empty__icon">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                              <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="2.4" />
                              <path d="M20.5 20.5L27 27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                            </svg>
                          </div>
                          <p>No trainings match your filters.</p>
                          <span className="traininglist__empty__hint">
                            Try a different search term, or clear your filters to see everything.
                          </span>
                          <button className="btn__wired" onClick={clearFilters}>
                            Clear filters
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="traininglist__empty__icon">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                              <rect x="3" y="6" width="26" height="22" rx="3" stroke="currentColor" strokeWidth="2.4" />
                              <path d="M3 12.5H29" stroke="currentColor" strokeWidth="2.4" />
                              <path d="M9.5 3V8.5M22.5 3V8.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                            </svg>
                          </div>
                          <p>No trainings this {calendarRangeLabel}.</p>
                          <span className="traininglist__empty__hint">
                            Nothing planned for {calendarRangeCaption} yet.
                          </span>
                          <button
                            className="btn__primary"
                            onClick={() =>
                              navigate("/create-training", {
                                state: { date: toDateKey(calendarRangeStart) },
                              })
                            }
                          >
                            + Plan a training
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="traininglist__cards">
                      {filtered.map((training) => (
                        <div
                          key={training.id}
                          id={`training-card-${training.id}`}
                          className={[
                            "traininglist__card",
                            toDateKey(training.date) === selectedDay ? "traininglist__card--selected" : "",
                            isSelectMode && selectedIds.has(training.id!) ? "traininglist__card--multi-selected" : "",
                            isSelectMode ? "traininglist__card--selectable" : "",
                          ].filter(Boolean).join(" ")}
                          onPointerDown={handlePointerDown(training.id!)}
                          onPointerUp={handlePointerUp}
                          onPointerLeave={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                          onClick={() => {
                            if (justEnteredSelectMode.current) {
                              justEnteredSelectMode.current = false;
                              return;
                            }
                            if (isSelectMode) {
                              toggleSelect(training.id!);
                            } else {
                              navigate(`/training-detail/${training.ownerId ?? currentUserId}/${training.id}`);
                            }
                          }}
                        >
                    {isSelectMode && (
                      <div className={`traininglist__card__checkbox${selectedIds.has(training.id!) ? " traininglist__card__checkbox--checked" : ""}`}>
                        {selectedIds.has(training.id!) && (
                          <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                            <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    )}
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
                        {training.ownerId && (
                          <span className="traininglist__card__shared-badge">Shared</span>
                        )}
                        {!!training.rating && (
                          <span className="traininglist__card__rating-badge">
                            {training.rating}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 .587l3.668 7.431 8.332 1.21-6.001 5.847 1.417 8.279L12 19.771l-7.416 3.583 1.417-8.279-6.001-5.847 8.332-1.21z" />
                            </svg>
                          </span>
                        )}
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
                          {training.players &&
                            (() => {
                              const total = Object.values(
                                training.players,
                              ).reduce((s: number, v) => s + (v as number), 0);
                              return total > 0 ? (
                                <>
                                  <span className="traininglist__card__dot">
                                    ·
                                  </span>
                                  <span>
                                    {total} player{total !== 1 ? "s" : ""}
                                  </span>
                                </>
                              ) : null;
                            })()}
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
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Select mode toolbar ─────────────────────────────────────────── */}
      {isSelectMode && (
        <div className="traininglist__select-toolbar">
          <span className="traininglist__select-toolbar__count">
            {selectedIds.size} selected
          </span>
          <div className="traininglist__select-toolbar__actions">
            <button
              className="traininglist__select-toolbar__btn"
              onClick={handleDuplicate}
              disabled={selectedIds.size === 0 || isActioning}
            >
              Duplicate
            </button>
            <button
              className="traininglist__select-toolbar__btn"
              onClick={handleShare}
              disabled={selectedIds.size === 0 || isActioning}
            >
              Share
            </button>
            <button
              className="traininglist__select-toolbar__btn traininglist__select-toolbar__btn--delete"
              onClick={handleDelete}
              disabled={selectedIds.size === 0 || isActioning}
            >
              Delete
            </button>
          </div>
          <button className="traininglist__select-toolbar__cancel" onClick={exitSelectMode}>
            ✕
          </button>
        </div>
      )}

      {/* ── Share dialog ─────────────────────────────────────────────────── */}
      {shareDialogOpen && shareDialogTrainings.length > 0 && (
        <ShareDialog
          trainings={shareDialogTrainings}
          currentUserId={currentUserId}
          currentUserTeam={(userData as any)?.team ?? ""}
          senderName={(userData as any)?.userName ?? ""}
          onClose={() => {
            setShareDialogOpen(false);
            exitSelectMode();
          }}
        />
      )}

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      {deleteConfirmOpen && (
        <div
          className="dialog__overlay"
          onClick={() => !isActioning && setDeleteConfirmOpen(false)}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog__title">
              Delete {selectedIds.size} training{selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p className="dialog__body">
              This will permanently delete the selected training{selectedIds.size !== 1 ? "s" : ""}. This cannot be undone.
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
    </div>
  );
};

export default TrainingList;
