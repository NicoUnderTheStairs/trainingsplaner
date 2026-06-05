import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import db from "../../../firebase";
import type { Training } from "../../../types/Training";

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

  // ── Data ─────────────────────────────────────────────────────────────────
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Calendar ──────────────────────────────────────────────────────────────
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ── Search & filter ───────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [minPlayers, setMinPlayers] = useState<number>(0); // 0 = any
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
    setMinPlayers(0);
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

    return matchesSearch && matchesTags && matchesPlayers;
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
                  <section className="traininglist__calendar">
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
                  </section>
                </aside>

                {/* ── Content: training list ─────────────────────────────── */}
                <div className="traininglist__content">
                  {filtered.length === 0 ? (
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
                          id={`training-card-${training.id}`}
                          className={`traininglist__card${toDateKey(training.date) === selectedDay ? " traininglist__card--selected" : ""}`}
                          onClick={() => navigate(`/training-detail/${currentUserId}/${training.id}`)}
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
    </div>
  );
};

export default TrainingList;
