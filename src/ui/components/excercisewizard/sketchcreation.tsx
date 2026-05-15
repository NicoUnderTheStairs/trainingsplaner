import React, { useRef, useState, useCallback, useEffect } from "react";
import type {
  SketchData,
  PlayerType,
  Player,
  Arrow,
} from "../../../types/Sketch";
import withNavigation from "../../../hoc/withNavigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "select" | "arrow";

interface Props {
  sketch?: SketchData;
  onChange: (data: { sketch: SketchData }) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SVG_WIDTH = 560;
const SVG_HEIGHT = 440;

const PLAYER_COLORS: Record<PlayerType, string> = {
  attacker: "#E63C2F",
  defender: "#3EC6D4",
  setter: "#F5A623",
  libero: "#4DB87A",
};

const PLAYER_LABELS: Record<PlayerType, string> = {
  attacker: "A",
  defender: "D",
  setter: "S",
  libero: "L",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const toSketchData = (players: Player[], arrows: Arrow[]): SketchData => ({
  players: Object.fromEntries(players.map(({ id, ...rest }) => [id, rest])),
  arrows: Object.fromEntries(arrows.map(({ id, ...rest }) => [id, rest])),
});

const fromSketchData = (
  sketch?: SketchData,
): { players: Player[]; arrows: Arrow[] } => {
  if (!sketch) return { players: [], arrows: [] };
  return {
    players: Object.entries(sketch.players).map(([id, p]) => ({ id, ...p })),
    arrows: Object.entries(sketch.arrows).map(([id, a]) => ({ id, ...a })),
  };
};

// Arrow head marker path helper
const arrowHead = (x1: number, y1: number, x2: number, y2: number) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 10;
  const spread = 0.4;
  return [
    `${x2},${y2}`,
    `${x2 - len * Math.cos(angle - spread)},${y2 - len * Math.sin(angle - spread)}`,
    `${x2 - len * Math.cos(angle + spread)},${y2 - len * Math.sin(angle + spread)}`,
  ].join(" ");
};

// ─── Component ────────────────────────────────────────────────────────────────

const SketchCreation: React.FC<Props> = ({ sketch, onChange }) => {
  const { players: initPlayers, arrows: initArrows } = fromSketchData(sketch);

  const [players, setPlayers] = useState<Player[]>(initPlayers);
  const [arrows, setArrows] = useState<Arrow[]>(initArrows);
  const [tool, setTool] = useState<Tool>("select");
  const [arrowStyle, setArrowStyle] = useState<"solid" | "dashed">("solid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Drag state for existing players
  const dragRef = useRef<{
    playerId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Arrow drawing state
  const arrowRef = useRef<{ x1: number; y1: number } | null>(null);
  const [draftArrow, setDraftArrow] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // Emit changes upward whenever players or arrows change
  useEffect(() => {
    onChange({ sketch: toSketchData(players, arrows) });
  }, [players, arrows]);

  // ── SVG coordinate helper ────────────────────────────────────────────────
  const getSVGPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_WIDTH / rect.width;
    const scaleY = SVG_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // ── Drag handlers ────────────────────────────────────────────────────────
  const handlePlayerMouseDown = useCallback(
    (e: React.MouseEvent, playerId: string) => {
      if (tool !== "select") return;
      e.stopPropagation();
      setSelectedId(playerId);
      const pt = getSVGPoint(e);
      const player = players.find((p) => p.id === playerId);
      if (!player) return;
      dragRef.current = {
        playerId,
        offsetX: pt.x - player.x,
        offsetY: pt.y - player.y,
      };
    },
    [tool, players, getSVGPoint],
  );

  const handleSVGMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pt = getSVGPoint(e);

      // Move player
      if (dragRef.current) {
        const { playerId, offsetX, offsetY } = dragRef.current;
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId
              ? {
                  ...p,
                  x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x - offsetX)),
                  y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y - offsetY)),
                }
              : p,
          ),
        );
      }

      // Update draft arrow
      if (arrowRef.current) {
        setDraftArrow({ ...arrowRef.current, x2: pt.x, y2: pt.y });
      }
    },
    [getSVGPoint],
  );

  const handleSVGMouseUp = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = null;

      if (arrowRef.current && draftArrow) {
        const dx = draftArrow.x2 - draftArrow.x1;
        const dy = draftArrow.y2 - draftArrow.y1;
        // Only save arrows longer than 20px
        if (Math.sqrt(dx * dx + dy * dy) > 20) {
          setArrows((prev) => [
            ...prev,
            {
              id: uid(),
              x1: draftArrow.x1,
              y1: draftArrow.y1,
              x2: draftArrow.x2,
              y2: draftArrow.y2,
              style: arrowStyle,
            },
          ]);
        }
        arrowRef.current = null;
        setDraftArrow(null);
      }
    },
    [draftArrow, arrowStyle],
  );

  const handleSVGMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (tool === "arrow") {
        const pt = getSVGPoint(e);
        arrowRef.current = { x1: pt.x, y1: pt.y };
        setDraftArrow({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      } else {
        setSelectedId(null);
      }
    },
    [tool, getSVGPoint],
  );

  // ── Drop player from palette ─────────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("playerType") as PlayerType;
      if (!type) return;
      const pt = getSVGPoint(e as unknown as MouseEvent);
      setPlayers((prev) => [
        ...prev,
        {
          id: uid(),
          x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x)),
          y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y)),
          type,
          label: PLAYER_LABELS[type],
        },
      ]);
    },
    [getSVGPoint],
  );

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // ── Delete selected ──────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    setPlayers((prev) => prev.filter((p) => p.id !== selectedId));
    setArrows((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDelete]);

  const clearAll = () => {
    setPlayers([]);
    setArrows([]);
    setSelectedId(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="excercisewizard">
      <h2>Create your sketch</h2>
      <p className="sketch__hint">
        {tool === "select"
          ? "Drag players from the palette onto the court. Click to select, then Delete to remove."
          : "Click and drag on the court to draw an arrow."}
      </p>

      {/* ── Toolbar ── */}
      <div className="sketch__toolbar">
        {/* Player palette */}
        <div className="sketch__toolbar__group">
          <div>
            <h4 className="sketch__toolbar__label">Drag players</h4>
            <p className="sketch__toolbar__hint">
              Attacker, Defender, Setter, Libero
            </p>
          </div>
          <div className="sketch__toolbar__group--tools">
            {(Object.keys(PLAYER_COLORS) as PlayerType[]).map((type) => (
              <div
                key={type}
                className="sketch__palette__player"
                draggable
                title={type}
                onDragStart={(e) => e.dataTransfer.setData("playerType", type)}
                style={{ background: PLAYER_COLORS[type] }}
              >
                {PLAYER_LABELS[type]}
              </div>
            ))}
          </div>
        </div>

        {/* Tool toggle */}
        <div className="sketch__toolbar__group">
          <h4 className="sketch__toolbar__label">Tools</h4>
          <div className="sketch__toolbar__group--tools">
            <button
              className={`sketch__tool__btn ${tool === "select" ? "sketch__tool__btn--active" : ""}`}
              onClick={() => setTool("select")}
              title="Select / Move (V)"
            >
              ↖ Select
            </button>
            <button
              className={`sketch__tool__btn ${tool === "arrow" ? "sketch__tool__btn--active" : ""}`}
              onClick={() => setTool("arrow")}
              title="Draw Arrow (A)"
            >
              → Arrow
            </button>
          </div>
        </div>

        {/* Arrow style */}
        {tool === "arrow" && (
          <div className="sketch__toolbar__group">
            <h4 className="sketch__toolbar__label">Arrow style</h4>
            <div className="sketch__toolbar__group--tools">
              <button
                className={`sketch__tool__btn ${arrowStyle === "solid" ? "sketch__tool__btn--active" : ""}`}
                onClick={() => setArrowStyle("solid")}
              >
                — Solid
              </button>
              <button
                className={`sketch__tool__btn ${arrowStyle === "dashed" ? "sketch__tool__btn--active" : ""}`}
                onClick={() => setArrowStyle("dashed")}
              >
                ╌ Dashed
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── SVG Canvas ── */}
      <svg
        ref={svgRef}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        fill="none"
        className={`sketch__canvas sketch__canvas--tool-${tool}`}
        onMouseDown={handleSVGMouseDown}
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
        onMouseLeave={handleSVGMouseUp}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L0,8 L8,4 Z" fill="#1E1E1E" />
          </marker>
          <marker
            id="arrowhead-draft"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L0,8 L8,4 Z" fill="#999" />
          </marker>
        </defs>

        {/* Court background */}
        <g className="background">
          <path d="M560 0H0V440H560V0Z" fill="white" />
          <path
            d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z"
            fill="#F4EDE0"
          />
          <path
            d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203"
            stroke="black"
          />
        </g>

        {/* Saved arrows */}
        {arrows.map((arrow) => (
          <g
            key={arrow.id}
            onClick={(e) => {
              e.stopPropagation();
              if (tool === "select") setSelectedId(arrow.id);
            }}
          >
            <line
              x1={arrow.x1}
              y1={arrow.y1}
              x2={arrow.x2}
              y2={arrow.y2}
              stroke={selectedId === arrow.id ? "#E63C2F" : "#1E1E1E"}
              strokeWidth={selectedId === arrow.id ? 2.5 : 2}
              strokeDasharray={arrow.style === "dashed" ? "6 4" : undefined}
              markerEnd="url(#arrowhead)"
              style={{ cursor: "pointer" }}
            />
            {/* Invisible wider hit area */}
            <line
              x1={arrow.x1}
              y1={arrow.y1}
              x2={arrow.x2}
              y2={arrow.y2}
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: "pointer" }}
            />
          </g>
        ))}

        {/* Draft arrow while drawing */}
        {draftArrow && (
          <line
            x1={draftArrow.x1}
            y1={draftArrow.y1}
            x2={draftArrow.x2}
            y2={draftArrow.y2}
            stroke="#999"
            strokeWidth={2}
            strokeDasharray={arrowStyle === "dashed" ? "6 4" : undefined}
            markerEnd="url(#arrowhead-draft)"
            pointerEvents="none"
          />
        )}

        {/* Players */}
        {players.map((player) => (
          <g
            key={player.id}
            transform={`translate(${player.x}, ${player.y})`}
            onMouseDown={(e) => handlePlayerMouseDown(e, player.id)}
            onClick={(e) => {
              e.stopPropagation();
              if (tool === "select") setSelectedId(player.id);
            }}
            style={{ cursor: tool === "select" ? "grab" : "default" }}
          >
            {/* Selection ring */}
            {selectedId === player.id && (
              <circle
                r={15}
                fill="none"
                stroke="#E63C2F"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            )}
            <circle r={11} fill={PLAYER_COLORS[player.type]} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={11}
              fontWeight="bold"
              fontFamily="Roboto, sans-serif"
              pointerEvents="none"
            >
              {player.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Actions */}
      <div className="sketch__toolbar__group sketch__toolbar__group--right">
        <div className="sketch__toolbar__group--tools">
          {selectedId && (
            <button
              className="sketch__tool__btn sketch__tool__btn--danger"
              onClick={handleDelete}
              title="Delete selected (Del)"
            >
              🗑 Delete
            </button>
          )}
          <button
            className="sketch__tool__btn"
            onClick={clearAll}
            title="Clear all"
          >
            ✕ Clear all
          </button>
        </div>
      </div>
    </div>
  );
};

export default withNavigation(SketchCreation);
