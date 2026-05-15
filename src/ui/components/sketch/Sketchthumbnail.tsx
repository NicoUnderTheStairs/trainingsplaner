import type { SketchData } from "../../../types/Sketch";

const PLAYER_COLORS: Record<string, string> = {
  attacker: "#E63C2F",
  defender: "#3EC6D4",
  setter: "#F5A623",
  libero: "#4DB87A",
};

const PLAYER_LABELS: Record<string, string> = {
  attacker: "A",
  defender: "D",
  setter: "S",
  libero: "L",
};

const SketchThumbnail = ({ sketch }: { sketch: SketchData }) => {
  const players = sketch?.players ? Object.entries(sketch.players) : [];
  const arrows = sketch?.arrows ? Object.entries(sketch.arrows) : [];

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

      {/* Court */}
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

      {/* Arrows */}
      {arrows.map(([id, arrow]) => (
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

      {/* Players */}
      {players.map(([id, player]) => (
        <g key={id} transform={`translate(${player.x}, ${player.y})`}>
          <circle r={11} fill={PLAYER_COLORS[player.type] ?? "#999"} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
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

export default SketchThumbnail;
