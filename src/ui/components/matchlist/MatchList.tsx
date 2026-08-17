import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import db from "../../../firebase";
import type { Match } from "../../../types/Match";
import { useTeamId } from "../../../hooks/useTeamId";
import { useSecureFile } from "../../../hooks/useSecureFile";

const POSITIONS = [
  "Outside Hitter",
  "Opposite Hitter",
  "Middle Blocker",
  "Setter",
  "Libero",
];

const POSITION_COLORS: Record<string, string> = {
  "Outside Hitter": "#3EC6D4",
  "Opposite Hitter": "#F5A623",
  "Middle Blocker": "#4A90D9",
  Setter: "#7ED321",
  Libero: "#9B59B6",
};

const POSITION_ABBR: Record<string, string> = {
  "Outside Hitter": "OH",
  "Opposite Hitter": "OP",
  "Middle Blocker": "MB",
  Setter: "S",
  Libero: "L",
};

type Player = {
  id: string;
  playerName: string;
  playerNumber: number;
  playerPosition: string;
  idFileKey?: string;
};

// Renders the "View ID" badge + remove button for an uploaded ID file.
// The file is fetched securely (token-gated, not a public URL) and exposed
// as a blob: object URL so the link can open it in a new tab.
const IdFileLink = ({
  fileKey,
  onRemove,
  title,
}: {
  fileKey: string;
  onRemove: () => void;
  title: string;
}) => {
  const { url, loading } = useSecureFile(fileKey);
  return (
    <div className="matchlist__players__id-wrap">
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={`matchlist__players__id-badge matchlist__players__id-badge--uploaded${loading ? " matchlist__players__id-badge--uploading" : ""}`}
        title={title}
        onClick={(e) => {
          if (!url) e.preventDefault();
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 1h5.5L10 3.5V11H2V1Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M7 1v3h3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M4 6.5h4M4 8.5h2.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        ID
      </a>
      <button
        className="matchlist__players__id-remove"
        onClick={onRemove}
        aria-label="Remove ID document"
        title="Remove ID"
      >
        ×
      </button>
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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

const getCalendarDays = (
  monthDate: Date,
): { date: Date; currentMonth: boolean }[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

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

const MatchListSkeleton = () => (
  <div className="matchlist__layout">
    <aside className="matchlist__sidebar">
      <section className="matchlist__calendar">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.6rem",
          }}
        >
          <span
            className="sk sk--circle"
            style={{ width: "2.4rem", height: "2.4rem" }}
          />
          <span className="sk sk--line-lg sk--w40" />
          <span
            className="sk sk--circle"
            style={{ width: "2.4rem", height: "2.4rem" }}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "0.4rem",
            marginBottom: "0.4rem",
          }}
        >
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span
              key={i}
              style={{
                textAlign: "center",
                fontSize: "1.2rem",
                color: "rgba(30,30,30,0.3)",
              }}
            >
              {d}
            </span>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "0.4rem",
          }}
        >
          {Array.from({ length: 35 }).map((_, i) => (
            <span
              key={i}
              className="sk sk--rect"
              style={{ height: "3.6rem" }}
            />
          ))}
        </div>
      </section>
    </aside>
    <div className="matchlist__content">
      <div className="sk-stack" style={{ gap: "1.6rem" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk-card">
            <div className="sk-row">
              <span className="sk sk--line sk--w30" style={{ flex: 1 }} />
              <span
                className="sk sk--rect"
                style={{ width: "5rem", height: "1.6rem" }}
              />
            </div>
            <span className="sk sk--line-xl sk--w65" />
            <span className="sk sk--line sk--w40" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const MatchList = () => {
  const navigate = useNavigate();
  const teamId = useTeamId();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<
    "weekly" | "monthly" | "yearly"
  >("monthly");
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(today);
    mon.setDate(today.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState<"all" | "home" | "away">(
    "all",
  );
  const filterRef = useRef<HTMLDivElement>(null);

  const [playersOpen, setPlayersOpen] = useState(false);
  const [playerMode, setPlayerMode] = useState<"list" | "add" | "edit">("list");
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [playerDraft, setPlayerDraft] = useState({
    playerName: "",
    playerNumber: 0,
    playerPosition: POSITIONS[0],
  });
  const [playerError, setPlayerError] = useState("");
  const [playerSaving, setPlayerSaving] = useState(false);

  const [coaches, setCoaches] = useState<{
    firstCoach: string;
    secondCoach: string;
    firstCoachIdKey?: string;
    secondCoachIdKey?: string;
  }>({ firstCoach: "", secondCoach: "" });
  const [editingCoach, setEditingCoach] = useState<
    "firstCoach" | "secondCoach" | null
  >(null);
  const [coachDraft, setCoachDraft] = useState("");
  const [coachSaving, setCoachSaving] = useState(false);

  const [uploadingPlayerId, setUploadingPlayerId] = useState<string | null>(
    null,
  );
  const [uploadingCoachRole, setUploadingCoachRole] = useState<
    "firstCoach" | "secondCoach" | null
  >(null);
  const [uploadError, setUploadError] = useState("");
  const [pendingUploadPlayer, setPendingUploadPlayer] = useState<Player | null>(
    null,
  );
  const [pendingCoachRole, setPendingCoachRole] = useState<
    "firstCoach" | "secondCoach" | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerIdUpload = (player: Player) => {
    setPendingUploadPlayer(player);
    setPendingCoachRole(null);
    setUploadError("");
    fileInputRef.current?.click();
  };

  const triggerCoachIdUpload = (role: "firstCoach" | "secondCoach") => {
    setPendingCoachRole(role);
    setPendingUploadPlayer(null);
    setUploadError("");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (pendingUploadPlayer) await uploadIdFile(pendingUploadPlayer, file);
      else if (pendingCoachRole) await uploadCoachId(pendingCoachRole, file);
    }
    e.target.value = "";
  };

  const uploadCoachId = async (
    role: "firstCoach" | "secondCoach",
    file: File,
  ) => {
    if (!teamId) return;
    setUploadingCoachRole(role);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("teamId", teamId);
      form.append("playerName", role);
      const res = await fetch(import.meta.env.VITE_UPLOAD_URL as string, {
        method: "POST",
        headers: {
          "X-Upload-Token": import.meta.env.VITE_UPLOAD_TOKEN as string,
        },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Upload failed.");
        return;
      }
      const keyField =
        role === "firstCoach" ? "firstCoachIdKey" : "secondCoachIdKey";
      await setDoc(doc(db, "teams", teamId), { [keyField]: json.key }, { merge: true });
      setCoaches((prev) => ({ ...prev, [keyField]: json.key }));
    } catch {
      setUploadError("Upload failed. Check your connection.");
    } finally {
      setUploadingCoachRole(null);
    }
  };

  const removeCoachId = async (role: "firstCoach" | "secondCoach") => {
    if (!teamId) return;
    const keyField =
      role === "firstCoach" ? "firstCoachIdKey" : "secondCoachIdKey";
    try {
      await updateDoc(doc(db, "teams", teamId), { [keyField]: deleteField() });
      setCoaches((prev) => ({ ...prev, [keyField]: undefined }));
    } catch {
      setUploadError("Failed to remove ID. Please try again.");
    }
  };

  const removeIdFile = async (player: Player) => {
    if (!teamId) return;
    try {
      await updateDoc(doc(db, "teams", teamId, "players", player.id), {
        idFileKey: deleteField(),
      });
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === player.id ? { ...p, idFileKey: undefined } : p,
        ),
      );
    } catch {
      setUploadError("Failed to remove ID. Please try again.");
    }
  };

  const uploadIdFile = async (player: Player, file: File) => {
    if (!teamId) return;
    setUploadingPlayerId(player.id);
    setUploadError("");
    try {
      const safeName = player.playerName
        .replace(/[^a-zA-Z0-9 _-]/g, "")
        .replace(/\s+/g, "_");
      const form = new FormData();
      form.append("file", file);
      form.append("teamId", teamId);
      form.append("playerName", safeName);

      const res = await fetch(import.meta.env.VITE_UPLOAD_URL as string, {
        method: "POST",
        headers: {
          "X-Upload-Token": import.meta.env.VITE_UPLOAD_TOKEN as string,
        },
        body: form,
      });

      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Upload failed.");
        return;
      }

      await updateDoc(doc(db, "teams", teamId, "players", player.id), {
        idFileKey: json.key,
      });
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === player.id ? { ...p, idFileKey: json.key } : p,
        ),
      );
    } catch {
      setUploadError("Upload failed. Check your connection.");
    } finally {
      setUploadingPlayerId(null);
    }
  };

  const loadPlayers = async () => {
    if (!teamId) return;
    setPlayersLoading(true);
    try {
      const snap = await getDocs(collection(db, "teams", teamId, "players"));
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Player, "id">),
      }));
      data.sort((a, b) => a.playerNumber - b.playerNumber);
      setPlayers(data);
    } finally {
      setPlayersLoading(false);
    }
  };

  const loadCoaches = async () => {
    if (!teamId) return;
    try {
      const snap = await getDoc(doc(db, "teams", teamId));
      if (snap.exists()) {
        const data = snap.data();
        setCoaches({
          firstCoach: data.firstCoach ?? "",
          secondCoach: data.secondCoach ?? "",
          firstCoachIdKey: data.firstCoachIdKey,
          secondCoachIdKey: data.secondCoachIdKey,
        });
      }
    } catch {
      // silently ignore — coaches stay as empty strings
    }
  };

  const openPlayersModal = () => {
    setPlayersOpen(true);
    setPlayerMode("list");
    setEditingCoach(null);
    loadPlayers();
    loadCoaches();
  };

  const saveCoach = async () => {
    if (!teamId || !editingCoach) return;
    setCoachSaving(true);
    try {
      await setDoc(doc(db, "teams", teamId), { [editingCoach]: coachDraft.trim() }, { merge: true });
      setCoaches((prev) => ({ ...prev, [editingCoach]: coachDraft.trim() }));
      setEditingCoach(null);
    } finally {
      setCoachSaving(false);
    }
  };

  const savePlayer = async () => {
    if (!teamId) return;
    if (!playerDraft.playerName.trim()) {
      setPlayerError("Player name is required.");
      return;
    }
    if (playerDraft.playerNumber <= 0) {
      setPlayerError("Jersey number must be greater than 0.");
      return;
    }
    setPlayerSaving(true);
    try {
      await addDoc(collection(db, "teams", teamId, "players"), {
        playerName: playerDraft.playerName.trim(),
        playerNumber: playerDraft.playerNumber,
        playerPosition: playerDraft.playerPosition,
      });
      setPlayerDraft({
        playerName: "",
        playerNumber: 0,
        playerPosition: POSITIONS[0],
      });
      setPlayerError("");
      setPlayerMode("list");
      await loadPlayers();
    } catch {
      setPlayerError("Failed to save player. Please try again.");
    } finally {
      setPlayerSaving(false);
    }
  };

  const updatePlayer = async () => {
    if (!teamId || !editingPlayer) return;
    if (!playerDraft.playerName.trim()) {
      setPlayerError("Player name is required.");
      return;
    }
    if (playerDraft.playerNumber <= 0) {
      setPlayerError("Jersey number must be greater than 0.");
      return;
    }
    setPlayerSaving(true);
    try {
      await updateDoc(doc(db, "teams", teamId, "players", editingPlayer.id), {
        playerName: playerDraft.playerName.trim(),
        playerNumber: playerDraft.playerNumber,
        playerPosition: playerDraft.playerPosition,
      });
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === editingPlayer.id
            ? {
                ...p,
                playerName: playerDraft.playerName.trim(),
                playerNumber: playerDraft.playerNumber,
                playerPosition: playerDraft.playerPosition,
              }
            : p,
        ),
      );
      setPlayerMode("list");
      setEditingPlayer(null);
      setPlayerDraft({
        playerName: "",
        playerNumber: 0,
        playerPosition: POSITIONS[0],
      });
      setPlayerError("");
    } catch {
      setPlayerError("Failed to update player. Please try again.");
    } finally {
      setPlayerSaving(false);
    }
  };

  const deletePlayer = async (playerId: string) => {
    if (!teamId) return;
    try {
      await deleteDoc(doc(db, "teams", teamId, "players", playerId));
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      setDeletingPlayerId(null);
    } catch {
      // silently ignore — player row stays visible
    }
  };

  useEffect(() => {
    if (teamId === undefined) return; // still loading user profile
    if (!teamId) {
      setLoading(false);
      return;
    } // no team assigned
    getDocs(collection(db, "teams", teamId, "matches"))
      .then((snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Match, "id">),
        }));
        data.sort((a, b) => {
          const da = (a.date as any)?.toDate?.() ?? new Date(a.date as any);
          const db_ = (b.date as any)?.toDate?.() ?? new Date(b.date as any);
          return da.getTime() - db_.getTime(); // oldest first
        });
        setMatches(data);
      })
      .catch(() => setError("Failed to load matches."))
      .finally(() => setLoading(false));
  }, [teamId]);

  // Scroll to the next upcoming match once matches have loaded
  const hasScrolledToNextRef = useRef(false);
  useEffect(() => {
    if (hasScrolledToNextRef.current || matches.length === 0) return;
    const todayKey = toDateKey(new Date());
    const nextMatch = matches.find((m) => toDateKey(m.date) >= todayKey);
    hasScrolledToNextRef.current = true;
    if (nextMatch) {
      setTimeout(() => {
        document
          .getElementById(`match-card-${nextMatch.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [matches]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearFilters = () => {
    setSearch("");
    setLocationFilter("all");
  };
  const hasActiveFilters = search.trim() !== "" || locationFilter !== "all";
  const activeFilterCount = locationFilter !== "all" ? 1 : 0;

  const matchDays = useMemo(() => {
    const keys = new Set<string>();
    matches.forEach((m) => {
      const k = toDateKey(m.date);
      if (k) keys.add(k);
    });
    return keys;
  }, [matches]);

  const matchMonths = useMemo(() => {
    const months = new Set<string>();
    matches.forEach((m) => {
      const k = toDateKey(m.date);
      if (k) months.add(k.slice(0, 7));
    });
    return months;
  }, [matches]);

  const todayKey = toDateKey(new Date());
  const calendarDays = getCalendarDays(calendarMonth);

  const handleCalendarDayClick = (dateKey: string) => {
    if (matchDays.has(dateKey)) {
      const next = selectedDay === dateKey ? null : dateKey;
      setSelectedDay(next);
      if (next) {
        const found = matches.find((m) => toDateKey(m.date) === next);
        if (found) {
          setTimeout(() => {
            document
              .getElementById(`match-card-${found.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 50);
        }
      }
    } else {
      navigate("/create-match", { state: { date: dateKey } });
    }
  };

  const filtered = matches.filter((m) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = q === "" || m.opponent?.toLowerCase().includes(q);
    const matchesLocation =
      locationFilter === "all" ||
      (locationFilter === "home" && m.isHomeGame) ||
      (locationFilter === "away" && !m.isHomeGame);
    return matchesSearch && matchesLocation;
  });

  const firstUpcomingIndex = filtered.findIndex(
    (m) => toDateKey(m.date) >= todayKey,
  );

  return (
    <div className="matchlist section">
      <div className="matchlist__inner">
        <div className="exercisedetail__back">
          <button className="btn__wired" onClick={() => navigate(-1)}>
            <svg width="23" height="12" viewBox="0 0 23 12" fill="none">
              <path
                d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                fill="black"
              />
            </svg>
            Back
          </button>
        </div>

        <div className="matchlist__menu">
          <h2>
            My Matches{" "}
            <span>
              ({hasActiveFilters ? `${filtered.length}/` : ""}
              {matches.length})
            </span>
          </h2>

          <div className="matchlist__menu__buttons">
            <div className="matchlist__search__wrapper">
              <input
                type="text"
                className="matchlist__menu__buttons--search"
                placeholder="Search opponent…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="matchlist__search__clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="matchlist__filter__wrapper" ref={filterRef}>
              <button
                className={`matchlist__menu__buttons--filter ${filterOpen ? "matchlist__menu__buttons--filter--open" : ""}`}
                onClick={() => setFilterOpen((p) => !p)}
              >
                Filter
                {activeFilterCount > 0 && (
                  <span className="matchlist__filter__badge">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {filterOpen && (
                <div className="matchlist__filter__dropdown">
                  <div className="matchlist__filter__section">
                    <p className="matchlist__filter__label">Location</p>
                    <div className="matchlist__filter__players">
                      {(["all", "home", "away"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setLocationFilter(opt)}
                          className={`matchlist__filter__player__btn ${locationFilter === opt ? "matchlist__filter__player__btn--active" : ""}`}
                        >
                          {opt === "all"
                            ? "All"
                            : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="matchlist__filter__footer">
                    <button
                      className="matchlist__filter__clear"
                      onClick={clearFilters}
                      disabled={!hasActiveFilters}
                    >
                      Clear all
                    </button>
                    <button
                      className="btn__primary matchlist__filter__apply"
                      onClick={() => setFilterOpen(false)}
                    >
                      Show {filtered.length} result
                      {filtered.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button className="btn__wired" onClick={openPlayersModal}>
              Players
            </button>
            <button
              className="btn__primary"
              onClick={() => navigate("/create-match")}
            >
              + Create Match
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="matchlist__filter__chips">
            {search && (
              <span className="matchlist__filter__chip">
                "{search}"<button onClick={() => setSearch("")}>×</button>
              </span>
            )}
            {locationFilter !== "all" && (
              <span className="matchlist__filter__chip">
                {locationFilter === "home" ? "Home" : "Away"}
                <button onClick={() => setLocationFilter("all")}>×</button>
              </span>
            )}
            <button
              className="matchlist__filter__chip__clear"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>
        )}

        {teamId === null && !loading && (
          <div className="matchlist__empty">
            <p>
              You are not assigned to a team yet. Ask your admin to add you to a
              team.
            </p>
          </div>
        )}

        {loading && <MatchListSkeleton />}
        {error && (
          <p className="matchlist__status matchlist__status--error">{error}</p>
        )}

        {!loading && !error && teamId && (
          <>
            {matches.length === 0 ? (
              <div className="matchlist__empty">
                <p>No matches yet.</p>
                <button
                  className="btn__primary"
                  onClick={() => navigate("/create-match")}
                >
                  + Create your first match
                </button>
              </div>
            ) : (
              <div className="matchlist__layout">
                {/* ── Sidebar: calendar ───────────────────────────────── */}
                <aside className="matchlist__sidebar">
                  <div className="matchlist__view-selector">
                    {(["weekly", "monthly", "yearly"] as const).map((v) => (
                      <button
                        key={v}
                        className={`matchlist__view-selector__btn${calendarView === v ? " matchlist__view-selector__btn--active" : ""}`}
                        onClick={() => setCalendarView(v)}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>

                  <section className="matchlist__calendar">
                    {/* Weekly */}
                    {calendarView === "weekly" &&
                      (() => {
                        const weekDays = getWeekDays(weekStart);
                        const weekEnd = weekDays[6];
                        const sameMonth =
                          weekStart.getMonth() === weekEnd.getMonth();
                        const weekLabel = sameMonth
                          ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${weekStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
                          : `${weekStart.getDate()} ${weekStart.toLocaleDateString("en-GB", { month: "short" })} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
                        return (
                          <>
                            <div className="matchlist__calendar__header">
                              <button
                                className="matchlist__calendar__nav"
                                onClick={() =>
                                  setWeekStart((w) => {
                                    const d = new Date(w);
                                    d.setDate(d.getDate() - 7);
                                    return d;
                                  })
                                }
                                aria-label="Previous week"
                              >
                                <svg
                                  width="10"
                                  height="16"
                                  viewBox="0 0 10 16"
                                  fill="none"
                                >
                                  <path
                                    d="M8.5 1L1.5 8L8.5 15"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                              <span className="matchlist__calendar__title">
                                {weekLabel}
                              </span>
                              <button
                                className="matchlist__calendar__nav"
                                onClick={() =>
                                  setWeekStart((w) => {
                                    const d = new Date(w);
                                    d.setDate(d.getDate() + 7);
                                    return d;
                                  })
                                }
                                aria-label="Next week"
                              >
                                <svg
                                  width="10"
                                  height="16"
                                  viewBox="0 0 10 16"
                                  fill="none"
                                >
                                  <path
                                    d="M1.5 1L8.5 8L1.5 15"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                            <div className="matchlist__calendar__grid">
                              {WEEKDAYS.map((d) => (
                                <div
                                  key={d}
                                  className="matchlist__calendar__weekday"
                                >
                                  {d}
                                </div>
                              ))}
                              {weekDays.map((date, i) => {
                                const key = toDateKey(date);
                                const hasMatch = matchDays.has(key);
                                const isToday = key === todayKey;
                                return (
                                  <button
                                    key={i}
                                    className={[
                                      "matchlist__calendar__day",
                                      "matchlist__calendar__day--current",
                                      isToday
                                        ? "matchlist__calendar__day--today"
                                        : "",
                                      hasMatch
                                        ? "matchlist__calendar__day--has-training"
                                        : "",
                                      key === selectedDay
                                        ? "matchlist__calendar__day--selected"
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                    onClick={() => handleCalendarDayClick(key)}
                                    aria-label={`${date.getDate()}${hasMatch ? " – match" : ""}`}
                                  >
                                    <span>{date.getDate()}</span>
                                    {hasMatch && (
                                      <i className="matchlist__calendar__day__dot" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}

                    {/* Monthly */}
                    {calendarView === "monthly" && (
                      <>
                        <div className="matchlist__calendar__header">
                          <button
                            className="matchlist__calendar__nav"
                            onClick={() =>
                              setCalendarMonth(
                                (m) =>
                                  new Date(
                                    m.getFullYear(),
                                    m.getMonth() - 1,
                                    1,
                                  ),
                              )
                            }
                            aria-label="Previous month"
                          >
                            <svg
                              width="10"
                              height="16"
                              viewBox="0 0 10 16"
                              fill="none"
                            >
                              <path
                                d="M8.5 1L1.5 8L8.5 15"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <span className="matchlist__calendar__title">
                            {calendarMonth.toLocaleDateString("en-GB", {
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                          <button
                            className="matchlist__calendar__nav"
                            onClick={() =>
                              setCalendarMonth(
                                (m) =>
                                  new Date(
                                    m.getFullYear(),
                                    m.getMonth() + 1,
                                    1,
                                  ),
                              )
                            }
                            aria-label="Next month"
                          >
                            <svg
                              width="10"
                              height="16"
                              viewBox="0 0 10 16"
                              fill="none"
                            >
                              <path
                                d="M1.5 1L8.5 8L1.5 15"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                        <div className="matchlist__calendar__grid">
                          {WEEKDAYS.map((d) => (
                            <div
                              key={d}
                              className="matchlist__calendar__weekday"
                            >
                              {d}
                            </div>
                          ))}
                          {calendarDays.map(({ date, currentMonth }, i) => {
                            const key = toDateKey(date);
                            const hasMatch = matchDays.has(key);
                            const isToday = key === todayKey;
                            return (
                              <button
                                key={i}
                                className={[
                                  "matchlist__calendar__day",
                                  currentMonth
                                    ? "matchlist__calendar__day--current"
                                    : "matchlist__calendar__day--other",
                                  isToday
                                    ? "matchlist__calendar__day--today"
                                    : "",
                                  hasMatch
                                    ? "matchlist__calendar__day--has-training"
                                    : "",
                                  key === selectedDay
                                    ? "matchlist__calendar__day--selected"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() =>
                                  currentMonth && handleCalendarDayClick(key)
                                }
                                disabled={!currentMonth}
                                aria-label={`${date.getDate()}${hasMatch ? " – match" : ""}`}
                              >
                                <span>{date.getDate()}</span>
                                {hasMatch && (
                                  <i className="matchlist__calendar__day__dot" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Yearly */}
                    {calendarView === "yearly" && (
                      <>
                        <div className="matchlist__calendar__header">
                          <button
                            className="matchlist__calendar__nav"
                            onClick={() =>
                              setCalendarMonth(
                                (m) =>
                                  new Date(
                                    m.getFullYear() - 1,
                                    m.getMonth(),
                                    1,
                                  ),
                              )
                            }
                            aria-label="Previous year"
                          >
                            <svg
                              width="10"
                              height="16"
                              viewBox="0 0 10 16"
                              fill="none"
                            >
                              <path
                                d="M8.5 1L1.5 8L8.5 15"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <span className="matchlist__calendar__title">
                            {calendarMonth.getFullYear()}
                          </span>
                          <button
                            className="matchlist__calendar__nav"
                            onClick={() =>
                              setCalendarMonth(
                                (m) =>
                                  new Date(
                                    m.getFullYear() + 1,
                                    m.getMonth(),
                                    1,
                                  ),
                              )
                            }
                            aria-label="Next year"
                          >
                            <svg
                              width="10"
                              height="16"
                              viewBox="0 0 10 16"
                              fill="none"
                            >
                              <path
                                d="M1.5 1L8.5 8L1.5 15"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                        <div className="matchlist__calendar__year-grid">
                          {Array.from({ length: 12 }, (_, i) => {
                            const monthKey = `${calendarMonth.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
                            const hasMatches = matchMonths.has(monthKey);
                            const monthDate = new Date(
                              calendarMonth.getFullYear(),
                              i,
                              1,
                            );
                            const now = new Date();
                            const isCurrentMonth =
                              now.getFullYear() ===
                                calendarMonth.getFullYear() &&
                              now.getMonth() === i;
                            return (
                              <button
                                key={i}
                                className={[
                                  "matchlist__calendar__month-btn",
                                  hasMatches
                                    ? "matchlist__calendar__month-btn--has-training"
                                    : "",
                                  isCurrentMonth
                                    ? "matchlist__calendar__month-btn--current"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => {
                                  setCalendarMonth(monthDate);
                                  setCalendarView("monthly");
                                }}
                              >
                                <span>
                                  {monthDate.toLocaleDateString("en-GB", {
                                    month: "short",
                                  })}
                                </span>
                                {hasMatches && (
                                  <i className="matchlist__calendar__day__dot" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </section>
                </aside>

                {/* ── Content: match list ──────────────────────────────── */}
                <div className="matchlist__content">
                  {filtered.length === 0 ? (
                    <div className="matchlist__empty">
                      <p>No matches match your filters.</p>
                      <button className="btn__wired" onClick={clearFilters}>
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="matchlist__cards">
                      {filtered.map((match, index) => {
                        const isPast = toDateKey(match.date) < todayKey;
                        const showDivider =
                          firstUpcomingIndex > 0 && index === firstUpcomingIndex;
                        return (
                          <Fragment key={match.id}>
                            {showDivider && (
                              <div className="matchlist__divider">
                                <span>Upcoming</span>
                              </div>
                            )}
                            <div
                              id={`match-card-${match.id}`}
                              className={[
                                "matchlist__card",
                                toDateKey(match.date) === selectedDay
                                  ? "matchlist__card--selected"
                                  : "",
                                isPast ? "matchlist__card--past" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() =>
                                navigate(`/match-detail/${teamId}/${match.id}`)
                              }
                            >
                              <div className="matchlist__card__accent matchlist__card__accent" />

                              <div className="matchlist__card__body">
                                <div className="matchlist__card__top">
                                  <span className="matchlist__card__date">
                                    {formatDate(match.date)}
                                  </span>
                                  <span
                                    className={`matchlist__badge matchlist__badge--${match.isHomeGame ? "home" : "away"}`}
                                  >
                                    {match.isHomeGame ? "Home" : "Away"}
                                  </span>
                                </div>

                                <h3 className="matchlist__card__title">
                                  Limmattal vs. {match.opponent}
                                </h3>

                                <div className="matchlist__card__footer">
                                  <div className="matchlist__card__exercises">
                                    <span>
                                      {(match.lineup ?? []).length} player
                                      {(match.lineup ?? []).length !== 1 ? "s" : ""}
                                    </span>
                                    <svg
                                      width="16"
                                      height="10"
                                      viewBox="0 0 23 12"
                                      fill="none"
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
                          </Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Players modal ────────────────────────────────────────────────── */}
      {playersOpen && (
        <div
          className="matchlist__modal__backdrop"
          onClick={() => setPlayersOpen(false)}
        >
          <div
            className="matchlist__modal matchlist__modal--players"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── List mode ── */}
            {playerMode === "list" && (
              <>
                <div className="matchlist__modal__header">
                  <div>
                    <h2>Players</h2>
                    <p className="matchlist__players__count">
                      {players.length} player{players.length !== 1 ? "s" : ""}{" "}
                      in roster
                    </p>
                  </div>
                  <div className="matchlist__players__header-actions">
                    <button
                      className="btn__primary matchlist__players__add-btn"
                      onClick={() => {
                        setPlayerDraft({
                          playerName: "",
                          playerNumber: 0,
                          playerPosition: POSITIONS[0],
                        });
                        setPlayerError("");
                        setPlayerMode("add");
                      }}
                    >
                      + Add Player
                    </button>
                    <button
                      className="matchlist__modal__close"
                      onClick={() => setPlayersOpen(false)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* ── Coaches ── */}
                <div className="matchlist__players__coaches">
                  <p className="matchlist__players__coaches__title">
                    Coaching Staff
                  </p>
                  <div className="matchlist__players__coaches__cards">
                    {(["firstCoach", "secondCoach"] as const).map((role) => {
                      const label =
                        role === "firstCoach" ? "First Coach" : "Second Coach";
                      const isEditing = editingCoach === role;
                      const idKey =
                        role === "firstCoach"
                          ? coaches.firstCoachIdKey
                          : coaches.secondCoachIdKey;
                      const isUploading = uploadingCoachRole === role;
                      return (
                        <div
                          key={role}
                          className={`matchlist__players__coaches__card${isEditing ? " matchlist__players__coaches__card--editing" : ""}`}
                        >
                          <div className="matchlist__players__coaches__card__top">
                            <span className="matchlist__players__coaches__role">
                              {label}
                            </span>
                            <div className="matchlist__players__coaches__card__actions">
                              {idKey ? (
                                <IdFileLink
                                  fileKey={idKey}
                                  onRemove={() => removeCoachId(role)}
                                  title="View ID"
                                />
                              ) : (
                                <button
                                  className={`matchlist__players__id-badge${isUploading ? " matchlist__players__id-badge--uploading" : ""}`}
                                  onClick={() => triggerCoachIdUpload(role)}
                                  disabled={isUploading}
                                  title="Upload ID"
                                >
                                  {isUploading ? (
                                    "…"
                                  ) : (
                                    <>
                                      <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 11 11"
                                        fill="none"
                                      >
                                        <path
                                          d="M5.5 7.5V1M5.5 1L3 3.5M5.5 1L8 3.5"
                                          stroke="currentColor"
                                          strokeWidth="1.4"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                        <path
                                          d="M1 8.5v1a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1"
                                          stroke="currentColor"
                                          strokeWidth="1.3"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                      ID
                                    </>
                                  )}
                                </button>
                              )}
                              {!isEditing && (
                                <button
                                  className="matchlist__players__action"
                                  aria-label={`Edit ${label}`}
                                  onClick={() => {
                                    setEditingCoach(role);
                                    setCoachDraft(coaches[role]);
                                  }}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 14 14"
                                    fill="none"
                                  >
                                    <path
                                      d="M9.5 1.5L12.5 4.5L4.5 12.5H1.5V9.5L9.5 1.5Z"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="matchlist__players__coaches__edit">
                              <input
                                className="matchlist__players__coaches__input"
                                value={coachDraft}
                                onChange={(e) => setCoachDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveCoach();
                                  if (e.key === "Escape") setEditingCoach(null);
                                }}
                                placeholder="Full name…"
                                autoFocus
                              />
                              <div className="matchlist__players__coaches__edit-actions">
                                <button
                                  className="matchlist__players__coaches__btn"
                                  onClick={() => setEditingCoach(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="matchlist__players__coaches__btn matchlist__players__coaches__btn--save"
                                  onClick={saveCoach}
                                  disabled={coachSaving}
                                >
                                  {coachSaving ? "…" : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="matchlist__players__coaches__name">
                              {coaches[role] || <em>Not set</em>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {playersLoading ? (
                  <div className="matchlist__players__loading">Loading…</div>
                ) : players.length === 0 ? (
                  <div className="matchlist__players__empty">
                    <p>No players yet.</p>
                    <button
                      className="btn__primary"
                      onClick={() => {
                        setPlayerDraft({
                          playerName: "",
                          playerNumber: 0,
                          playerPosition: POSITIONS[0],
                        });
                        setPlayerError("");
                        setPlayerMode("add");
                      }}
                    >
                      + Add your first player
                    </button>
                  </div>
                ) : (
                  <>
                    {uploadError && (
                      <p className="matchlist__players__upload-error">
                        {uploadError}
                      </p>
                    )}
                    <div className="matchlist__players__list">
                      {players.map((player) => {
                        const posColor =
                          POSITION_COLORS[player.playerPosition] ?? "#888";
                        const isUploading = uploadingPlayerId === player.id;

                        if (deletingPlayerId === player.id) {
                          return (
                            <div
                              key={player.id}
                              className="matchlist__players__item matchlist__players__item--confirming"
                            >
                              <span className="matchlist__players__confirm-text">
                                Delete <strong>{player.playerName}</strong>?
                              </span>
                              <div className="matchlist__players__confirm-btns">
                                <button
                                  className="btn__wired matchlist__players__confirm-cancel"
                                  onClick={() => setDeletingPlayerId(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="matchlist__players__confirm-delete"
                                  onClick={() => deletePlayer(player.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={player.id}
                            className="matchlist__players__item"
                          >
                            <div
                              className="matchlist__players__jersey"
                              style={{ background: posColor }}
                            >
                              {player.playerNumber}
                            </div>
                            <div className="matchlist__players__info">
                              <span className="matchlist__players__name">
                                {player.playerName}
                              </span>
                              <span className="matchlist__players__meta">
                                <span
                                  className="matchlist__players__pos-tag"
                                  style={{ color: posColor }}
                                >
                                  {POSITION_ABBR[player.playerPosition] ??
                                    player.playerPosition}
                                </span>
                              </span>
                            </div>

                            {/* ID file */}
                            {player.idFileKey ? (
                              <IdFileLink
                                fileKey={player.idFileKey}
                                onRemove={() => removeIdFile(player)}
                                title="View ID document"
                              />
                            ) : (
                              <button
                                className={`matchlist__players__id-badge${isUploading ? " matchlist__players__id-badge--uploading" : ""}`}
                                onClick={() => triggerIdUpload(player)}
                                disabled={isUploading}
                                title="Upload ID document"
                              >
                                {isUploading ? (
                                  "…"
                                ) : (
                                  <>
                                    <svg
                                      width="11"
                                      height="11"
                                      viewBox="0 0 11 11"
                                      fill="none"
                                    >
                                      <path
                                        d="M5.5 7.5V1M5.5 1L3 3.5M5.5 1L8 3.5"
                                        stroke="currentColor"
                                        strokeWidth="1.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M1 8.5v1a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1"
                                        stroke="currentColor"
                                        strokeWidth="1.3"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                    ID
                                  </>
                                )}
                              </button>
                            )}

                            <div className="matchlist__players__actions">
                              <button
                                className="matchlist__players__action"
                                aria-label="Edit player"
                                onClick={() => {
                                  setEditingPlayer(player);
                                  setPlayerDraft({
                                    playerName: player.playerName,
                                    playerNumber: player.playerNumber,
                                    playerPosition: player.playerPosition,
                                  });
                                  setPlayerError("");
                                  setPlayerMode("edit");
                                }}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 14 14"
                                  fill="none"
                                >
                                  <path
                                    d="M9.5 1.5L12.5 4.5L4.5 12.5H1.5V9.5L9.5 1.5Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                              <button
                                className="matchlist__players__action matchlist__players__action--delete"
                                aria-label="Delete player"
                                onClick={() => setDeletingPlayerId(player.id)}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 14 14"
                                  fill="none"
                                >
                                  <path
                                    d="M1 3.5H13M5.5 3.5V2H8.5V3.5M2.5 3.5L3.5 12H10.5L11.5 3.5H2.5Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Add / Edit mode ── */}
            {(playerMode === "add" || playerMode === "edit") && (
              <>
                <div className="matchlist__modal__header">
                  <div className="matchlist__players__back-header">
                    <button
                      className="matchlist__players__back"
                      onClick={() => {
                        setPlayerMode("list");
                        setPlayerError("");
                      }}
                      aria-label="Back to players list"
                    >
                      <svg
                        width="10"
                        height="16"
                        viewBox="0 0 10 16"
                        fill="none"
                      >
                        <path
                          d="M8.5 1L1.5 8L8.5 15"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <h2>
                      {playerMode === "add" ? "Add Player" : "Edit Player"}
                    </h2>
                  </div>
                  <button
                    className="matchlist__modal__close"
                    onClick={() => setPlayersOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="trainingwizard__input__field">
                  <input
                    id="mpPlayerName"
                    className="trainingwizard__input"
                    type="text"
                    placeholder=" "
                    value={playerDraft.playerName}
                    onChange={(e) => {
                      setPlayerDraft((p) => ({
                        ...p,
                        playerName: e.target.value,
                      }));
                      setPlayerError("");
                    }}
                  />
                  <label
                    className="trainingwizard__label"
                    htmlFor="mpPlayerName"
                  >
                    Player Name
                  </label>
                </div>

                <div className="trainingwizard__input__field">
                  <input
                    id="mpPlayerNumber"
                    className="trainingwizard__input"
                    type="number"
                    placeholder=" "
                    min={1}
                    max={99}
                    value={
                      playerDraft.playerNumber === 0
                        ? ""
                        : playerDraft.playerNumber
                    }
                    onChange={(e) => {
                      setPlayerDraft((p) => ({
                        ...p,
                        playerNumber: parseInt(e.target.value) || 0,
                      }));
                      setPlayerError("");
                    }}
                  />
                  <label
                    className="trainingwizard__label"
                    htmlFor="mpPlayerNumber"
                  >
                    Jersey Number
                  </label>
                </div>

                <div className="trainingwizard__select__field">
                  <label
                    className="trainingwizard__select__label"
                    htmlFor="mpPlayerPosition"
                  >
                    Position
                  </label>
                  <select
                    id="mpPlayerPosition"
                    className="trainingwizard__select__input"
                    value={playerDraft.playerPosition}
                    onChange={(e) =>
                      setPlayerDraft((p) => ({
                        ...p,
                        playerPosition: e.target.value,
                      }))
                    }
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                {playerError && (
                  <p className="matchwizard__error">{playerError}</p>
                )}

                <div className="matchlist__modal__footer">
                  <button
                    className="btn__wired"
                    onClick={() => {
                      setPlayerMode("list");
                      setPlayerError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn__primary"
                    onClick={playerMode === "add" ? savePlayer : updatePlayer}
                    disabled={playerSaving}
                  >
                    {playerSaving
                      ? "Saving…"
                      : playerMode === "add"
                        ? "Save Player"
                        : "Update Player"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input — always mounted so the ref is stable */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,application/pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default MatchList;
