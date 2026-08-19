import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import db from "../../../firebase";
import type { LineupPlayer } from "../../../services/matchwizard/createMatch";

const POSITIONS = [
  "Outside Hitter",
  "Opposite Hitter",
  "Middle Blocker",
  "Setter",
  "Libero",
];

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

interface RosterPlayer {
  id: string;
  playerNumber: number;
  playerName: string;
  playerPosition: string;
}

interface Props {
  teamId: string | null | undefined;
  lineup: LineupPlayer[];
  onChange: (data: { lineup: LineupPlayer[] }) => void;
  // Pre-select the whole roster once it loads (used when creating a match; not for editing one)
  autoSelectAll?: boolean;
}

const emptyDraft = () => ({
  playerName: "",
  playerNumber: 0,
  playerPosition: POSITIONS[0],
});

const PlayerLineup: React.FC<Props> = ({ teamId, lineup, onChange, autoSelectAll }) => {
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [draft, setDraft] = useState(emptyDraft());
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState("");

  // Load existing team roster once teamId resolves
  useEffect(() => {
    if (teamId === undefined) return; // still loading
    if (!teamId) { setLoadingRoster(false); return; }
    getDocs(collection(db, "teams", teamId, "players"))
      .then((snap) => {
        const fetchedRoster = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RosterPlayer, "id">) }));
        setRoster(fetchedRoster);
        if (autoSelectAll && lineup.length === 0 && fetchedRoster.length > 0) {
          onChange({
            lineup: fetchedRoster.map((player) => ({
              playerNumber: player.playerNumber,
              playerName: player.playerName,
              playerPosition: player.playerPosition,
              rosterId: player.id,
            })),
          });
        }
      })
      .finally(() => setLoadingRoster(false));
    // Only re-run when the team changes — this is a one-time load + prefill, not a live sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const playerKey = (p: { playerName: string; playerNumber: number }) =>
    `${p.playerName}-${p.playerNumber}`;

  // Prefer matching by roster id (reliable even after a rename); fall back to name+number
  // for lineup entries saved before rosterId existed.
  const isRosterEntrySelected = (player: RosterPlayer) =>
    lineup.some((p) =>
      !p._new && (p.rosterId ? p.rosterId === player.id : playerKey(p) === playerKey(player)),
    );

  const toggleRosterPlayer = (player: RosterPlayer) => {
    const isSelected = isRosterEntrySelected(player);
    if (isSelected) {
      onChange({
        lineup: lineup.filter(
          (p) =>
            p._new ||
            (p.rosterId ? p.rosterId !== player.id : playerKey(p) !== playerKey(player)),
        ),
      });
    } else {
      onChange({
        lineup: [
          ...lineup,
          {
            playerNumber: player.playerNumber,
            playerName: player.playerName,
            playerPosition: player.playerPosition,
            rosterId: player.id,
          },
        ],
      });
    }
  };

  const removeNewPlayer = (index: number) => {
    const newPlayers = lineup.filter((p) => p._new);
    const removed = newPlayers[index];
    onChange({ lineup: lineup.filter((p) => p !== removed) });
  };

  const updateDraft = (field: keyof typeof draft, value: string | number) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const addNewPlayer = () => {
    if (!draft.playerName.trim()) { setError("Player name is required."); return; }
    if (draft.playerNumber <= 0) { setError("Jersey number must be greater than 0."); return; }
    const allNumbers = [
      ...roster.map((p) => p.playerNumber),
      ...lineup.filter((p) => p._new).map((p) => p.playerNumber),
    ];
    if (allNumbers.includes(draft.playerNumber)) {
      setError(`Number ${draft.playerNumber} is already taken.`);
      return;
    }
    onChange({
      lineup: [
        ...lineup,
        { ...draft, _new: true } as LineupPlayer,
      ],
    });
    setDraft(emptyDraft());
    setAddOpen(false);
    setError("");
  };

  const newPlayers = lineup.filter((p) => p._new);

  return (
    <div className="trainingwizard">
      <h2>Team Lineup</h2>
      <p className="playerselection__subtitle">
        Select players from your roster for this match, or add new ones.
      </p>

      {/* Existing roster */}
      {loadingRoster ? (
        <p className="matchwizard__loading">Loading roster…</p>
      ) : roster.length > 0 ? (
        <div className="matchwizard__roster">
          <h3 className="matchwizard__roster__title">Roster</h3>
          {roster.map((player) => {
            const selected = isRosterEntrySelected(player);
            return (
              <button
                key={player.id}
                type="button"
                className={`matchwizard__roster__row${selected ? " matchwizard__roster__row--selected" : ""}`}
                onClick={() => toggleRosterPlayer(player)}
              >
                <div
                  className="matchwizard__lineup__abbr"
                  style={{ background: POSITION_COLOR[player.playerPosition] ?? "#888" }}
                >
                  {POSITION_ABBR[player.playerPosition] ?? "?"}
                </div>
                <div className="matchwizard__lineup__info">
                  <span className="matchwizard__lineup__name">{player.playerName}</span>
                  <span className="matchwizard__lineup__position">{player.playerPosition}</span>
                </div>
                <span className="matchwizard__lineup__number">#{player.playerNumber}</span>
                <span className="matchwizard__roster__check">
                  {selected ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* New players added this session */}
      {newPlayers.length > 0 && (
        <div className="matchwizard__roster">
          <h3 className="matchwizard__roster__title">New Players</h3>
          {newPlayers.map((p, i) => (
            <div key={i} className="matchwizard__roster__row matchwizard__roster__row--selected">
              <div
                className="matchwizard__lineup__abbr"
                style={{ background: POSITION_COLOR[p.playerPosition] ?? "#888" }}
              >
                {POSITION_ABBR[p.playerPosition] ?? "?"}
              </div>
              <div className="matchwizard__lineup__info">
                <span className="matchwizard__lineup__name">{p.playerName}</span>
                <span className="matchwizard__lineup__position">{p.playerPosition}</span>
              </div>
              <span className="matchwizard__lineup__number">#{p.playerNumber}</span>
              <button
                type="button"
                className="matchwizard__lineup__remove"
                onClick={() => removeNewPlayer(i)}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new player form */}
      {addOpen ? (
        <div className="matchwizard__add">
          <div className="trainingwizard__input__field">
            <input
              id="PlayerName"
              className="trainingwizard__input"
              type="text"
              placeholder=" "
              value={draft.playerName}
              onChange={(e) => updateDraft("playerName", e.target.value)}
            />
            <label className="trainingwizard__label" htmlFor="PlayerName">
              Player Name
            </label>
          </div>

          <div className="trainingwizard__input__field">
            <input
              id="PlayerNumber"
              className="trainingwizard__input"
              type="number"
              placeholder=" "
              min={1}
              max={99}
              value={draft.playerNumber === 0 ? "" : draft.playerNumber}
              onChange={(e) => updateDraft("playerNumber", parseInt(e.target.value) || 0)}
            />
            <label className="trainingwizard__label" htmlFor="PlayerNumber">
              Jersey Number
            </label>
          </div>

          <div className="trainingwizard__select__field">
            <label className="trainingwizard__select__label" htmlFor="PlayerPosition">
              Position
            </label>
            <select
              id="PlayerPosition"
              className="trainingwizard__select__input"
              value={draft.playerPosition}
              onChange={(e) => updateDraft("playerPosition", e.target.value)}
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>

          {error && <p className="matchwizard__error">{error}</p>}

          <div className="matchwizard__add__actions">
            <button
              type="button"
              className="btn__wired"
              onClick={() => { setAddOpen(false); setError(""); setDraft(emptyDraft()); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn__primary"
              onClick={addNewPlayer}
            >
              Add to Lineup
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="matchwizard__add__trigger"
          onClick={() => setAddOpen(true)}
        >
          + Add new player
        </button>
      )}

      <p className="matchwizard__lineup__count">
        {lineup.length} player{lineup.length !== 1 ? "s" : ""} selected
      </p>
    </div>
  );
};

export default PlayerLineup;
