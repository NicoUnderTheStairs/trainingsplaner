import React, { useRef, useState, useCallback, useEffect } from "react";
import type { SketchData, PlayerType, Player, Arrow } from "../../../types/Sketch";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "select" | "arrow";

interface Props {
  sketch?: SketchData;
  onChange: (data: { sketch: SketchData }) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SVG_WIDTH  = 560;
const SVG_HEIGHT = 440;

const PLAYER_COLORS: Record<PlayerType, string> = {
  attacker: "#E63C2F",
  defender: "#3EC6D4",
  setter:   "#F5A623",
  libero:   "#4DB87A",
};

const PLAYER_LABELS: Record<PlayerType, string> = {
  attacker: "A",
  defender: "D",
  setter:   "S",
  libero:   "L",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const toSketchData = (players: Player[], arrows: Arrow[]): SketchData => ({
  players: Object.fromEntries(players.map(({ id, ...rest }) => [id, rest])),
  arrows:  Object.fromEntries(arrows.map(({ id, ...rest }) => [id, rest])),
});

const fromSketchData = (sketch?: SketchData): { players: Player[]; arrows: Arrow[] } => {
  if (!sketch) return { players: [], arrows: [] };
  return {
    players: Object.entries(sketch.players).map(([id, p]) => ({ id, ...p })),
    arrows:  Object.entries(sketch.arrows).map(([id, a]) => ({ id, ...a })),
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

const SketchCreation: React.FC<Props> = ({ sketch, onChange }) => {
  const { players: initPlayers, arrows: initArrows } = fromSketchData(sketch);

  const [players,   setPlayers]   = useState<Player[]>(initPlayers);
  const [arrows,    setArrows]    = useState<Arrow[]>(initArrows);
  const [tool,      setTool]      = useState<Tool>("select");
  const [arrowStyle, setArrowStyle] = useState<"solid" | "dashed">("solid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftArrow, setDraftArrow] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Mobile: which player type is queued to be placed on next court tap
  const [pendingPlayerType, setPendingPlayerType] = useState<PlayerType | null>(null);

  // Drag (mouse + touch)
  const dragRef  = useRef<{ playerId: string; offsetX: number; offsetY: number } | null>(null);
  const arrowRef = useRef<{ x1: number; y1: number } | null>(null);
  const svgRef   = useRef<SVGSVGElement>(null);

  // Emit upward whenever canvas changes
  useEffect(() => {
    onChange({ sketch: toSketchData(players, arrows) });
  }, [players, arrows]);

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  const getPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SVG_WIDTH,  (clientX - rect.left) * (SVG_WIDTH  / rect.width))),
      y: Math.max(0, Math.min(SVG_HEIGHT, (clientY - rect.top)  * (SVG_HEIGHT / rect.height))),
    };
  }, []);

  const fromMouseEvent  = (e: React.MouseEvent) => getPoint(e.clientX, e.clientY);
  const fromTouchEvent  = (e: React.TouchEvent) => {
    const t = e.touches[0] ?? e.changedTouches[0];
    return getPoint(t.clientX, t.clientY);
  };

  // ── Mouse handlers (desktop) ───────────────────────────────────────────────

  const handlePlayerMouseDown = useCallback((e: React.MouseEvent, playerId: string) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(playerId);
    const pt = fromMouseEvent(e);
    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    dragRef.current = { playerId, offsetX: pt.x - player.x, offsetY: pt.y - player.y };
  }, [tool, players, fromMouseEvent]);

  const handleSVGMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === "arrow") {
      const pt = fromMouseEvent(e);
      arrowRef.current = { x1: pt.x, y1: pt.y };
      setDraftArrow({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    } else {
      setSelectedId(null);
    }
  }, [tool, fromMouseEvent]);

  const handleSVGMouseMove = useCallback((e: React.MouseEvent) => {
    const pt = fromMouseEvent(e);
    if (dragRef.current) {
      const { playerId, offsetX, offsetY } = dragRef.current;
      setPlayers((prev) => prev.map((p) => p.id === playerId
        ? { ...p, x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x - offsetX)), y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y - offsetY)) }
        : p));
    }
    if (arrowRef.current) setDraftArrow({ ...arrowRef.current, x2: pt.x, y2: pt.y });
  }, [fromMouseEvent]);

  const commitDraftArrow = useCallback(() => {
    if (arrowRef.current && draftArrow) {
      const dx = draftArrow.x2 - draftArrow.x1, dy = draftArrow.y2 - draftArrow.y1;
      if (Math.sqrt(dx * dx + dy * dy) > 20) {
        setArrows((prev) => [...prev, { id: uid(), ...draftArrow, style: arrowStyle }]);
      }
      arrowRef.current = null;
      setDraftArrow(null);
    }
    dragRef.current = null;
  }, [draftArrow, arrowStyle]);

  const handleSVGMouseUp = useCallback(() => { commitDraftArrow(); }, [commitDraftArrow]);

  // Desktop drag-and-drop from palette
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("playerType") as PlayerType;
    if (!type) return;
    const pt = getPoint(e.clientX, e.clientY);
    setPlayers((prev) => [...prev, { id: uid(), x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x)), y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y)), type, label: PLAYER_LABELS[type] }]);
  }, [getPoint]);

  // ── Touch handlers (mobile) ────────────────────────────────────────────────

  const handleSVGTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    const pt = fromTouchEvent(e);

    if (pendingPlayerType) {
      setPlayers((prev) => [...prev, {
        id: uid(),
        x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x)),
        y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y)),
        type: pendingPlayerType,
        label: PLAYER_LABELS[pendingPlayerType],
      }]);
      setPendingPlayerType(null);
      return;
    }

    if (tool === "arrow") {
      arrowRef.current = { x1: pt.x, y1: pt.y };
      setDraftArrow({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    } else {
      const hit = players.find((p) => {
        const dx = p.x - pt.x, dy = p.y - pt.y;
        return Math.sqrt(dx * dx + dy * dy) < 20;
      });
      if (hit) {
        setSelectedId(hit.id);
        dragRef.current = { playerId: hit.id, offsetX: pt.x - hit.x, offsetY: pt.y - hit.y };
      } else {
        setSelectedId(null);
      }
    }
  }, [tool, players, pendingPlayerType, fromTouchEvent]);

  const handleSVGTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const pt = fromTouchEvent(e);

    if (dragRef.current) {
      const { playerId, offsetX, offsetY } = dragRef.current;
      setPlayers((prev) => prev.map((p) => p.id === playerId
        ? { ...p, x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x - offsetX)), y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y - offsetY)) }
        : p));
    }
    if (arrowRef.current) setDraftArrow({ ...arrowRef.current, x2: pt.x, y2: pt.y });
  }, [fromTouchEvent]);

  const handleSVGTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    commitDraftArrow();
  }, [commitDraftArrow]);

  // ── Delete ─────────────────────────────────────────────────────────────────

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

  const clearAll = () => { setPlayers([]); setArrows([]); setSelectedId(null); setPendingPlayerType(null); };

  const handlePalettePlayer = (type: PlayerType, e: React.MouseEvent | React.TouchEvent) => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      e.preventDefault();
      setPendingPlayerType((prev) => prev === type ? null : type);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="excercisewizard">
      <h2>Create your sketch</h2>

      {pendingPlayerType ? (
        <p className="sketch__hint sketch__hint--pending">
          Tap anywhere on the court to place
          <strong> {pendingPlayerType}</strong> — or tap the badge again to cancel
        </p>
      ) : (
        <p className="sketch__hint">
          {tool === "select"
            ? "Desktop: drag players onto court. Mobile: tap a player badge then tap the court."
            : "Click / drag on the court to draw an arrow."}
        </p>
      )}

      {/* ── Toolbar ── */}
      <div className="sketch__toolbar">
        <div className="sketch__toolbar__group">
          <div>
            <h4 className="sketch__toolbar__label">Players</h4>
            <p className="sketch__toolbar__hint">Drag (desktop) or tap then place (mobile)</p>
          </div>
          <div className="sketch__toolbar__group--tools">
            {(Object.keys(PLAYER_COLORS) as PlayerType[]).map((type) => (
              <div
                key={type}
                className={`sketch__palette__player ${pendingPlayerType === type ? "sketch__palette__player--active" : ""}`}
                draggable
                title={type}
                onDragStart={(e) => e.dataTransfer.setData("playerType", type)}
                onClick={(e) => handlePalettePlayer(type, e)}
                onTouchStart={(e) => handlePalettePlayer(type, e)}
                style={{ background: PLAYER_COLORS[type] }}
              >
                {PLAYER_LABELS[type]}
              </div>
            ))}
          </div>
        </div>

        <div className="sketch__toolbar__group">
          <h4 className="sketch__toolbar__label">Tools</h4>
          <div className="sketch__toolbar__group--tools">
            <button
              className={`sketch__tool__btn ${tool === "select" ? "sketch__tool__btn--active" : ""}`}
              onClick={() => { setTool("select"); setPendingPlayerType(null); }}
            >
              ↖ Select
            </button>
            <button
              className={`sketch__tool__btn ${tool === "arrow" ? "sketch__tool__btn--active" : ""}`}
              onClick={() => { setTool("arrow"); setPendingPlayerType(null); }}
            >
              → Arrow
            </button>
          </div>
        </div>

        {tool === "arrow" && (
          <div className="sketch__toolbar__group">
            <h4 className="sketch__toolbar__label">Arrow style</h4>
            <div className="sketch__toolbar__group--tools">
              <button className={`sketch__tool__btn ${arrowStyle === "solid"  ? "sketch__tool__btn--active" : ""}`} onClick={() => setArrowStyle("solid")}>— Solid</button>
              <button className={`sketch__tool__btn ${arrowStyle === "dashed" ? "sketch__tool__btn--active" : ""}`} onClick={() => setArrowStyle("dashed")}>╌ Dashed</button>
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
        className={`sketch__canvas sketch__canvas--tool-${tool}${pendingPlayerType ? " sketch__canvas--placing" : ""}`}
        style={{ touchAction: "none" }}
        onMouseDown={handleSVGMouseDown}
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
        onMouseLeave={handleSVGMouseUp}
        onTouchStart={handleSVGTouchStart}
        onTouchMove={handleSVGTouchMove}
        onTouchEnd={handleSVGTouchEnd}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <defs>
          <marker id="arrowhead"       markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="#1E1E1E" /></marker>
          <marker id="arrowhead-draft" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 Z" fill="#999" /></marker>
        </defs>

        <path d="M560 0H0V440H560V0Z" fill="white" />
        <path d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z" fill="#F4EDE0" />
        <path d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203" stroke="black" />

        {arrows.map((arrow) => (
          <g key={arrow.id} onClick={(e) => { e.stopPropagation(); if (tool === "select") setSelectedId(arrow.id); }}>
            <line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} stroke={selectedId === arrow.id ? "#E63C2F" : "#1E1E1E"} strokeWidth={selectedId === arrow.id ? 2.5 : 2} strokeDasharray={arrow.style === "dashed" ? "6 4" : undefined} markerEnd="url(#arrowhead)" style={{ cursor: "pointer" }} />
            <line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} stroke="transparent" strokeWidth={16} style={{ cursor: "pointer" }} />
          </g>
        ))}

        {draftArrow && (
          <line x1={draftArrow.x1} y1={draftArrow.y1} x2={draftArrow.x2} y2={draftArrow.y2} stroke="#999" strokeWidth={2} strokeDasharray={arrowStyle === "dashed" ? "6 4" : undefined} markerEnd="url(#arrowhead-draft)" pointerEvents="none" />
        )}

        {players.map((player) => (
          <g
            key={player.id}
            transform={`translate(${player.x}, ${player.y})`}
            onMouseDown={(e) => handlePlayerMouseDown(e, player.id)}
            onClick={(e) => { e.stopPropagation(); if (tool === "select" && !dragRef.current) setSelectedId(player.id); }}
            style={{ cursor: tool === "select" ? "grab" : "default" }}
          >
            {selectedId === player.id && <circle r={18} fill="none" stroke="#E63C2F" strokeWidth={2} strokeDasharray="4 2" />}
            <circle r={18} fill="transparent" />
            <circle r={11} fill={PLAYER_COLORS[player.type]} />
            <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize={11} fontWeight="bold" fontFamily="Roboto, sans-serif" pointerEvents="none">{player.label}</text>
          </g>
        ))}
      </svg>

      {/* Actions */}
      <div className="sketch__toolbar__group sketch__toolbar__group--right">
        <div className="sketch__toolbar__group--tools">
          {selectedId && (
            <button className="sketch__tool__btn sketch__tool__btn--danger" onClick={handleDelete} title="Delete selected (Del)">
              × Delete
            </button>
          )}
          <button className="sketch__tool__btn" onClick={clearAll}>✕ Clear all</button>
        </div>
      </div>
    </div>
  );
};

// No withNavigation — navigation is handled by CreateExcercise directly
export default SketchCreation;