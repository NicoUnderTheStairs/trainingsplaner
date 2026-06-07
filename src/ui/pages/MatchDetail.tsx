import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import type { Match, Player } from "../../types/Match";
import db from "../../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type InspectionEntry =
  | { kind: "player"; name: string; number: number; position: string; idFileUrl?: string }
  | { kind: "coach"; name: string; role: string; idFileUrl?: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITION_COLOR: Record<string, string> = {
  "Outside Hitter": "#E63C2F",
  "Opposite Hitter": "#F5A623",
  "Middle Blocker": "#4DB87A",
  Setter: "#3EC6D4",
  Libero: "#624DB8",
};

const POSITION_ABBR: Record<string, string> = {
  "Outside Hitter": "OH",
  "Opposite Hitter": "OP",
  "Middle Blocker": "MB",
  Setter: "S",
  Libero: "L",
};

const POSITION_ORDER = [
  "Outside Hitter",
  "Opposite Hitter",
  "Middle Blocker",
  "Setter",
  "Libero",
];

const STARTING_SLOTS: Record<string, number> = {
  "Outside Hitter": 2,
  "Opposite Hitter": 1,
  "Middle Blocker": 2,
  Setter: 1,
  Libero: 0,
};

// ─── Court helpers ─────────────────────────────────────────────────────────

function getCourtPositions(
  starting: Player[],
): Array<{ player: Player; fx: number; fy: number }> {
  const oh = starting.filter((p) => p.playerPosition === "Outside Hitter");
  const mb = starting.filter((p) => p.playerPosition === "Middle Blocker");
  const setter = starting.find((p) => p.playerPosition === "Setter");
  const opposite = starting.find((p) => p.playerPosition === "Opposite Hitter");

  // Clockwise from top-left: OP | MB | OH → S | MB | OH
  const slots: Array<{ player: Player | undefined; fx: number; fy: number }> = [
    { player: opposite, fx: 0.17, fy: 0.27 }, // top-left
    { player: mb[0], fx: 0.5, fy: 0.27 }, // top-center
    { player: oh[0], fx: 0.83, fy: 0.27 }, // top-right
    { player: setter, fx: 0.83, fy: 0.73 }, // bottom-right
    { player: mb[1], fx: 0.5, fy: 0.73 }, // bottom-center
    { player: oh[1], fx: 0.17, fy: 0.73 }, // bottom-left
  ];

  return slots
    .filter(
      (s): s is { player: Player; fx: number; fy: number } =>
        s.player !== undefined,
    )
    .map(({ player, fx, fy }) => ({ player, fx, fy }));
}

// ─── SVG Field Sketch ─────────────────────────────────────────────────────────

function FieldSketch({ starting }: { starting: Player[] }) {
  const W = 400;
  const H = 340;
  const padX = 44;
  const padY = 38;
  const cw = W - padX * 2;
  const ch = H - padY * 2;
  const x0 = padX;
  const y0 = padY;
  const attackY = y0 + ch / 3;

  const positions = getCourtPositions(starting);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="matchdetail__field"
      aria-label="Starting lineup on court"
    >
      {/* Court surface */}
      <rect x={x0} y={y0} width={cw} height={ch} fill="#f4ede0" rx="6" />

      {/* Outer boundary lines */}
      <rect
        x={x0}
        y={y0}
        width={cw}
        height={ch}
        fill="none"
        stroke="#000"
        strokeWidth="2"
        rx="6"
      />

      {/* Attack line (3m from net) */}
      <line
        x1={x0}
        y1={attackY}
        x2={x0 + cw}
        y2={attackY}
        stroke="#000"
        strokeWidth="1.5"
        strokeDasharray="10 5"
      />

      {/* Center line / net */}
      <line
        x1={x0 - 8}
        y1={y0}
        x2={x0 + cw + 8}
        y2={y0}
        stroke="#000"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Net posts */}
      <line
        x1={x0 - 8}
        y1={y0 - 10}
        x2={x0 - 8}
        y2={y0 + 10}
        stroke="#000"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1={x0 + cw + 8}
        y1={y0 - 10}
        x2={x0 + cw + 8}
        y2={y0 + 10}
        stroke="#000"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* NET label */}
      <text
        x={x0 + cw / 2}
        y={y0 - 14}
        textAnchor="middle"
        fill="#000"
        fontSize="10"
        fontWeight="700"
        letterSpacing="2"
        fontFamily="system-ui, sans-serif"
      >
        NET
      </text>

      {/* Player dots */}
      {positions.map(({ player, fx, fy }) => {
        const px = x0 + fx * cw;
        const py = y0 + fy * ch;
        const color = POSITION_COLOR[player.playerPosition] ?? "#888";
        const num = String(player.playerNumber);
        const fontSize = num.length > 1 ? 11 : 13;
        return (
          <g key={`${player.playerNumber}-${player.playerName}`}>
            <circle
              cx={px}
              cy={py}
              r={20}
              fill={color}
              stroke="#fff"
              strokeWidth="2.5"
            />
            <text
              x={px}
              y={py + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={fontSize}
              fontWeight="800"
              fontFamily="system-ui, sans-serif"
            >
              {num}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchDetail() {
  const { ownerId: teamId, matchId } = useParams<{
    ownerId: string;
    matchId: string;
  }>();
  const navigate = useNavigate();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [startingDraft, setStartingDraft] = useState<Player[]>([]);
  const [pickingLineup, setPickingLineup] = useState(false);
  const [savingLineup, setSavingLineup] = useState(false);

  const [refInspectionOpen, setRefInspectionOpen] = useState(false);
  const [inspectionEntries, setInspectionEntries] = useState<InspectionEntry[]>([]);
  const [inspectionIndex, setInspectionIndex] = useState(0);
  const [inspectionLoading, setInspectionLoading] = useState(false);

  // Local ordering for the sketch (survives without re-picking)
  const [localStarting, setLocalStarting] = useState<Player[]>([]);

  useEffect(() => {
    if ((match?.starting?.length ?? 0) === 6)
      setLocalStarting(match!.starting!);
  }, [match]);

  const swapInLocal = (pos: string) => {
    setLocalStarting((prev) => {
      const arr = [...prev];
      const idx = arr.reduce<number[]>(
        (acc, p, i) => (p.playerPosition === pos ? [...acc, i] : acc),
        [],
      );
      if (idx.length === 2)
        [arr[idx[0]], arr[idx[1]]] = [arr[idx[1]], arr[idx[0]]];
      return arr;
    });
  };

  const saveLocalOrder = async () => {
    if (!teamId || !matchId) return;
    setSavingLineup(true);
    try {
      await updateDoc(doc(db, "teams", teamId, "matches", matchId), {
        starting: localStarting,
      });
      setMatch((prev) => (prev ? { ...prev, starting: localStarting } : prev));
    } finally {
      setSavingLineup(false);
    }
  };

  useEffect(() => {
    if (!teamId || !matchId) return;
    getDoc(doc(db, "teams", teamId, "matches", matchId))
      .then((snap) => {
        if (snap.exists()) {
          setMatch({ id: snap.id, ...snap.data() } as Match);
        }
      })
      .finally(() => setLoading(false));
  }, [teamId, matchId]);

  const handleDeleteMatch = async () => {
    if (!teamId || !matchId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "teams", teamId, "matches", matchId));
      navigate(-1);
    } catch {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const toggleStartingPlayer = (player: Player) => {
    const key = (p: Player) => `${p.playerName}-${p.playerNumber}`;
    const alreadyIn = startingDraft.some((p) => key(p) === key(player));
    if (alreadyIn) {
      setStartingDraft((prev) => prev.filter((p) => key(p) !== key(player)));
    } else {
      const posCount = startingDraft.filter(
        (p) => p.playerPosition === player.playerPosition,
      ).length;
      if (posCount >= (STARTING_SLOTS[player.playerPosition] ?? 0)) return;
      setStartingDraft((prev) => [...prev, player]);
    }
  };

  const startingComplete =
    startingDraft.filter((p) => p.playerPosition === "Outside Hitter")
      .length === 2 &&
    startingDraft.filter((p) => p.playerPosition === "Middle Blocker")
      .length === 2 &&
    startingDraft.filter((p) => p.playerPosition === "Setter").length === 1 &&
    startingDraft.filter((p) => p.playerPosition === "Opposite Hitter")
      .length === 1;

  const openRefInspection = async () => {
    if (!teamId) return;
    setRefInspectionOpen(true);
    setInspectionIndex(0);
    setInspectionLoading(true);
    try {
      const [rosterSnap, teamSnap] = await Promise.all([
        getDocs(collection(db, "teams", teamId, "players")),
        getDoc(doc(db, "teams", teamId)),
      ]);

      const rosterMap = new Map<string, string | undefined>();
      rosterSnap.docs.forEach((d) => {
        const data = d.data();
        rosterMap.set(`${data.playerName}|${data.playerNumber}`, data.idFileUrl);
      });

      const playerEntries: InspectionEntry[] = (match?.lineup ?? []).map((p) => ({
        kind: "player" as const,
        name: p.playerName,
        number: p.playerNumber,
        position: p.playerPosition,
        idFileUrl: rosterMap.get(`${p.playerName}|${p.playerNumber}`),
      }));

      const teamData = teamSnap.exists() ? teamSnap.data() : {};
      const coachEntries: InspectionEntry[] = [];
      if (teamData.firstCoach) coachEntries.push({ kind: "coach", name: teamData.firstCoach, role: "First Coach", idFileUrl: teamData.firstCoachIdUrl });
      if (teamData.secondCoach) coachEntries.push({ kind: "coach", name: teamData.secondCoach, role: "Second Coach", idFileUrl: teamData.secondCoachIdUrl });

      setInspectionEntries([...playerEntries, ...coachEntries]);
    } finally {
      setInspectionLoading(false);
    }
  };

  useEffect(() => {
    if (!refInspectionOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setInspectionIndex((i) => Math.min(inspectionEntries.length - 1, i + 1));
      if (e.key === "ArrowLeft")  setInspectionIndex((i) => Math.max(0, i - 1));
      if (e.key === "Escape")     setRefInspectionOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refInspectionOpen, inspectionEntries.length]);

  const handleSaveLineup = async () => {
    if (!teamId || !matchId || !startingComplete) return;
    setSavingLineup(true);
    try {
      await updateDoc(doc(db, "teams", teamId, "matches", matchId), {
        starting: startingDraft,
      });
      setMatch((prev) => (prev ? { ...prev, starting: startingDraft } : prev));
      setPickingLineup(false);
    } finally {
      setSavingLineup(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <div className="matchdetail">
          <p>Loading...</p>
        </div>
      </>
    );
  }

  if (!match) {
    return (
      <>
        <Navigation />
        <div className="matchdetail">
          <p>Match not found.</p>
        </div>
      </>
    );
  }

  const matchDate =
    match.date && "toDate" in match.date
      ? match.date.toDate().toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  // Group lineup by position
  const byPosition: Record<string, Player[]> = {};
  POSITION_ORDER.forEach((pos) => {
    byPosition[pos] = [];
  });
  (match.lineup ?? []).forEach((p) => {
    if (!byPosition[p.playerPosition]) byPosition[p.playerPosition] = [];
    byPosition[p.playerPosition].push(p);
  });

  const hasStarting = (match.starting?.length ?? 0) === 6;

  const localOrderChanged =
    hasStarting &&
    localStarting.length === 6 &&
    localStarting.some(
      (p, i) => p.playerName !== match.starting![i].playerName,
    );

  const playerKey = (p: Player) => `${p.playerName}-${p.playerNumber}`;

  return (
    <>
      <Navigation />
      <div className="matchdetail">
        {/* ── Top bar: back + delete ── */}
        <div className="matchdetail__topbar">
          <button className="btn__wired" onClick={() => navigate(-1)}>
            <svg width="23" height="12" viewBox="0 0 23 12" fill="none">
              <path
                d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                fill="black"
              />
            </svg>
            Back
          </button>

          <div className="matchdetail__topbar__right">
            <button className="btn__wired" onClick={openRefInspection}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="5.5" cy="7" r="2" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M3 12c0-1.4 1.1-2.5 2.5-2.5S8 10.6 8 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M10 6h3M10 9h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Ref Inspection
            </button>

            {!deleteConfirm ? (
              <button className="matchdetail__delete-btn" onClick={() => setDeleteConfirm(true)}>
                <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
                  <path d="M1 3.5H12M4.5 3.5V2H8.5V3.5M2 3.5L3 13H10L11 3.5H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Delete Match
              </button>
            ) : (
            <div className="matchdetail__delete-confirm">
              <span>Delete this match?</span>
              <button
                className="matchdetail__delete-confirm__cancel"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="matchdetail__delete-confirm__ok"
                onClick={handleDeleteMatch}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
            )}
          </div>
        </div>

        {/* ── Header ── */}
        <div className="matchdetail__header">
          <h1 className="matchdetail__opponent">
            Limmattal vs. {match.opponent}
          </h1>
          <div className="matchdetail__header__meta">
            <span className="matchdetail__date">{matchDate}</span>
            <span
              className={`matchlist__badge matchlist__badge--${match.isHomeGame ? "home" : "away"}`}
            >
              {match.isHomeGame ? "Home" : "Away"}
            </span>
          </div>
        </div>

        {/* ── Notes on opponent ── */}
        {match.noteOnOpponent && (
          <section className="matchdetail__section">
            <h2 className="matchdetail__section__title">Notes on Opponent</h2>
            <p className="matchdetail__section__text">{match.noteOnOpponent}</p>
          </section>
        )}

        {/* ── Strategy ── */}
        {match.strategy && (
          <section className="matchdetail__section">
            <h2 className="matchdetail__section__title">Strategy</h2>
            <p className="matchdetail__section__text">{match.strategy}</p>
          </section>
        )}

        {/* ── Starting Lineup ── */}
        {match.lineup && match.lineup.length >= 6 && (
          <section className="matchdetail__section">
            <div className="matchdetail__section__titlerow">
              <h2 className="matchdetail__section__title">Starting Lineup</h2>
              {hasStarting && !pickingLineup && (
                <div className="matchdetail__field__header-btns">
                  {localOrderChanged && (
                    <button
                      className="btn__primary matchdetail__field__save-btn"
                      onClick={saveLocalOrder}
                      disabled={savingLineup}
                    >
                      {savingLineup ? "Saving…" : "Save"}
                    </button>
                  )}
                  <button
                    className="matchdetail__edit-lineup-btn"
                    onClick={() => {
                      setStartingDraft(match.starting!);
                      setPickingLineup(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Field sketch */}
            {hasStarting && !pickingLineup && (
              <>
                <FieldSketch starting={localStarting} />
                <div className="matchdetail__field__swaps">
                  <button
                    className="btn__wired"
                    onClick={() => swapInLocal("Outside Hitter")}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 1V13M7 1L4 4M7 1L10 4M7 13L4 10M7 13L10 10"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Outside Hitters
                  </button>
                  <button
                    className="btn__wired"
                    onClick={() => swapInLocal("Middle Blocker")}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 1V13M7 1L4 4M7 1L10 4M7 13L4 10M7 13L10 10"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Middle Blockers
                  </button>
                </div>
                <div className="matchdetail__field__legend">
                  {localStarting.map((p, i) => (
                    <div key={i} className="matchdetail__field__legend__item">
                      <span
                        className="matchdetail__field__legend__dot"
                        style={{ background: POSITION_COLOR[p.playerPosition] }}
                      />
                      <span className="matchdetail__field__legend__num">
                        #{p.playerNumber}
                      </span>
                      <span className="matchdetail__field__legend__name">
                        {p.playerName}
                      </span>
                      <span className="matchdetail__field__legend__pos">
                        {POSITION_ABBR[p.playerPosition]}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Empty state */}
            {!hasStarting && !pickingLineup && (
              <div className="matchdetail__no-lineup">
                <p>No starting lineup defined yet.</p>
                <button
                  className="btn__primary"
                  onClick={() => {
                    setStartingDraft([]);
                    setPickingLineup(true);
                  }}
                >
                  Set Starting Lineup
                </button>
              </div>
            )}

            {/* Picker */}
            {pickingLineup && (
              <div className="matchdetail__picker">
                <p className="matchdetail__picker__hint">
                  Pick 2 Outside Hitters, 2 Middle Blockers, 1 Setter, 1
                  Opposite.
                </p>

                {POSITION_ORDER.filter(
                  (pos) =>
                    (STARTING_SLOTS[pos] ?? 0) > 0 &&
                    byPosition[pos]?.length > 0,
                ).map((pos) => {
                  const required = STARTING_SLOTS[pos];
                  const selected = startingDraft.filter(
                    (p) => p.playerPosition === pos,
                  ).length;
                  const full = selected >= required;

                  return (
                    <div key={pos} className="matchdetail__picker__group">
                      <div className="matchdetail__picker__group__header">
                        <span
                          className="matchdetail__group__dot"
                          style={{ background: POSITION_COLOR[pos] }}
                        />
                        <span className="matchdetail__picker__group__label">
                          {pos}
                        </span>
                        <span
                          className={`matchdetail__picker__slots${full ? " matchdetail__picker__slots--full" : ""}`}
                        >
                          {selected}/{required}
                        </span>
                      </div>

                      {byPosition[pos].map((player, i) => {
                        const isSelected = startingDraft.some(
                          (p) => playerKey(p) === playerKey(player),
                        );
                        const blocked = !isSelected && full;
                        return (
                          <button
                            key={i}
                            className={[
                              "matchdetail__picker__row",
                              isSelected
                                ? "matchdetail__picker__row--selected"
                                : "",
                              blocked
                                ? "matchdetail__picker__row--blocked"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => toggleStartingPlayer(player)}
                            disabled={blocked}
                          >
                            <div
                              className="matchdetail__lineup__abbr"
                              style={{
                                background:
                                  POSITION_COLOR[player.playerPosition] ??
                                  "#888",
                              }}
                            >
                              {POSITION_ABBR[player.playerPosition] ?? "?"}
                            </div>
                            <div className="matchdetail__lineup__info">
                              <span className="matchdetail__lineup__name">
                                {player.playerName}
                              </span>
                            </div>
                            <span className="matchdetail__lineup__number">
                              #{player.playerNumber}
                            </span>
                            <span className="matchdetail__picker__check">
                              {isSelected ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                <div className="matchdetail__picker__footer">
                  <button
                    className="btn__wired"
                    onClick={() => {
                      setPickingLineup(false);
                      setStartingDraft(match.starting ?? []);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn__primary"
                    onClick={handleSaveLineup}
                    disabled={!startingComplete || savingLineup}
                  >
                    {savingLineup
                      ? "Saving…"
                      : startingComplete
                        ? "Save Lineup"
                        : `Select ${6 - startingDraft.length} more`}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Squad grouped by position ── */}
        <section className="matchdetail__section">
          <h2 className="matchdetail__section__title">
            Squad ({match.lineup?.length ?? 0} players)
          </h2>

          {!match.lineup || match.lineup.length === 0 ? (
            <p className="matchdetail__empty">
              No players added to this match.
            </p>
          ) : (
            <div className="matchdetail__groups">
              {POSITION_ORDER.filter((pos) => byPosition[pos]?.length > 0).map(
                (pos) => (
                  <div key={pos} className="matchdetail__group">
                    <div className="matchdetail__group__header">
                      <span
                        className="matchdetail__group__dot"
                        style={{ background: POSITION_COLOR[pos] }}
                      />
                      <span className="matchdetail__group__label">{pos}</span>
                      <span className="matchdetail__group__count">
                        {byPosition[pos].length}
                      </span>
                    </div>
                    <div className="matchdetail__lineup">
                      {byPosition[pos].map((player, i) => (
                        <div key={i} className="matchdetail__lineup__row">
                          <div
                            className="matchdetail__lineup__abbr"
                            style={{
                              background:
                                POSITION_COLOR[player.playerPosition] ?? "#888",
                            }}
                          >
                            {POSITION_ABBR[player.playerPosition] ?? "?"}
                          </div>
                          <div className="matchdetail__lineup__info">
                            <span className="matchdetail__lineup__name">
                              {player.playerName}
                            </span>
                          </div>
                          <div className="matchdetail__lineup__number">
                            #{player.playerNumber}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Ref Inspection lightbox ── */}
      {refInspectionOpen && (
        <div
          className="matchdetail__inspection"
          onClick={() => setRefInspectionOpen(false)}
        >
          <div
            className="matchdetail__inspection__card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="matchdetail__inspection__close"
              onClick={() => setRefInspectionOpen(false)}
              aria-label="Close"
            >
              ×
            </button>

            {inspectionLoading ? (
              <div className="matchdetail__inspection__loading">Loading…</div>
            ) : inspectionEntries.length === 0 ? (
              <div className="matchdetail__inspection__empty">
                No players or coaches in this match.
              </div>
            ) : (() => {
              const entry = inspectionEntries[inspectionIndex];
              const isPdf = entry.idFileUrl?.toLowerCase().endsWith(".pdf");
              const totalPlayers = inspectionEntries.filter((e) => e.kind === "player").length;
              const isCoach = entry.kind === "coach";
              return (
                <>
                  <div className="matchdetail__inspection__progress">
                    <span className="matchdetail__inspection__progress__type">
                      {isCoach ? "Coach" : "Player"}
                    </span>
                    <span>{isCoach ? inspectionIndex - totalPlayers + 1 : inspectionIndex + 1}</span>
                    <span className="matchdetail__inspection__progress__sep">/</span>
                    <span>{isCoach ? inspectionEntries.length - totalPlayers : totalPlayers}</span>
                  </div>

                  {entry.idFileUrl ? (
                    isPdf ? (
                      <a
                        href={entry.idFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="matchdetail__inspection__pdf-link"
                      >
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                          <path d="M6 4h13l7 7v17H6V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                          <path d="M19 4v7h7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                          <path d="M10 17h12M10 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Open ID Document (PDF)
                      </a>
                    ) : (
                      <img
                        src={entry.idFileUrl}
                        className="matchdetail__inspection__photo"
                        alt="ID document"
                      />
                    )
                  ) : (
                    <div className="matchdetail__inspection__no-photo">
                      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <rect x="3" y="8" width="34" height="24" rx="3" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="14" cy="19" r="5" stroke="currentColor" strokeWidth="2"/>
                        <path d="M7 32c0-4 3.1-7 7-7s7 3 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M26 16h7M26 21h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>No ID uploaded</span>
                    </div>
                  )}

                  {entry.kind === "player" ? (
                    <div
                      className="matchdetail__inspection__jersey"
                      style={{ background: POSITION_COLOR[entry.position] ?? "#888" }}
                    >
                      #{entry.number}
                    </div>
                  ) : (
                    <div className="matchdetail__inspection__coach-badge">
                      {entry.role}
                    </div>
                  )}

                  <div className="matchdetail__inspection__name">{entry.name}</div>

                  {entry.kind === "player" && (
                    <div className="matchdetail__inspection__position">
                      {entry.position}
                    </div>
                  )}

                  <div className="matchdetail__inspection__nav">
                    <button
                      className="btn__wired matchdetail__inspection__nav__btn"
                      onClick={() => setInspectionIndex((i) => Math.max(0, i - 1))}
                      disabled={inspectionIndex === 0}
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                        <path d="M8.5 1L1.5 8L8.5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Prev
                    </button>
                    <button
                      className="btn__wired matchdetail__inspection__nav__btn"
                      onClick={() => setInspectionIndex((i) => Math.min(inspectionEntries.length - 1, i + 1))}
                      disabled={inspectionIndex === inspectionEntries.length - 1}
                    >
                      Next
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                        <path d="M1.5 1L8.5 8L1.5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
