import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Players {
  outside: number; // Outside Hitter
  opposite: number; // Opposite Hitter
  middleBlocker: number; // Middle Blocker
  setter: number; // Setter
  libero: number; // Libero
  coach: number; // Coach
}

export const EMPTY_PLAYERS: Players = {
  outside: 0,
  opposite: 0,
  middleBlocker: 0,
  setter: 0,
  libero: 0,
  coach: 0,
};

interface Props {
  players: Players;
  onChange: (data: { players: Players }) => void;
}

// ─── Position definitions ─────────────────────────────────────────────────────

const POSITIONS: {
  key: keyof Players;
  label: string;
  abbr: string;
  color: string;
}[] = [
  {
    key: "outside",
    label: "Outside Hitter",
    abbr: "OH",
    color: "#E63C2F",
  },
  {
    key: "opposite",
    label: "Opposite Hitter",
    abbr: "OP",
    color: "#F5A623",
  },
  {
    key: "middleBlocker",
    label: "Middle Blocker",
    abbr: "MB",
    color: "#4DB87A",
  },
  {
    key: "setter",
    label: "Setter",
    abbr: "S",
    color: "#3EC6D4",
  },
  {
    key: "libero",
    label: "Libero",
    abbr: "L",
    color: "#624DB8",
  },
  {
    key: "coach",
    label: "Coach",
    abbr: "C",
    color: "#FFEE52",
  },
];

// ─── Counter component ─────────────────────────────────────────────────────────

const Counter = ({
  value,
  onChange,
  min = 0,
  max = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) => (
  <div className="playerselection__counter">
    <button
      type="button"
      className="playerselection__counter__btn playerselection__counter__btn--dec"
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      aria-label="Decrease"
    >
      −
    </button>
    <span className="playerselection__counter__value">{value}</span>
    <button
      type="button"
      className="playerselection__counter__btn playerselection__counter__btn--inc"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      aria-label="Increase"
    >
      +
    </button>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const PlayerSelection: React.FC<Props> = ({ players, onChange }) => {
  const total = Object.values(players).reduce((s, v) => s + v, 0);

  const set = (key: keyof Players, value: number) => {
    onChange({ players: { ...players, [key]: value } });
  };

  return (
    <div className="trainingwizard">
      <h2>Who's attending?</h2>
      <p className="playerselection__subtitle">
        Set how many players per position are joining this training session.
        Leave at 0 if a position isn't attending.
      </p>

      <div className="playerselection__grid">
        {POSITIONS.map((pos) => (
          <div key={pos.key} className="playerselection__row">
            <div className="playerselection__row__left">
              <div
                className="playerselection__abbr"
                style={{ background: pos.color }}
              >
                {pos.abbr}
              </div>
              <div className="playerselection__row__info">
                <span className="playerselection__row__label">{pos.label}</span>
              </div>
            </div>
            <Counter
              value={players[pos.key]}
              onChange={(v) => set(pos.key, v)}
            />
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="playerselection__total">
        <span className="playerselection__total__label">Total players</span>
        <span className="playerselection__total__value">{total}</span>
      </div>
    </div>
  );
};

export default PlayerSelection;
