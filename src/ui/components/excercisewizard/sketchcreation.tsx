import React, { useRef, useState, useCallback, useEffect } from "react";
import type {
  SketchData,
  PlayerType,
  Player,
  Arrow,
} from "../../../types/Sketch";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "select" | "arrow";
type ObjectType = "pylon" | "bench";

interface SketchObject {
  id: string;
  x: number;
  y: number;
  type: ObjectType;
}

interface Props {
  sketch?: SketchData;
  onChange: (data: { sketch: SketchData }) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SVG_WIDTH = 560;
const SVG_HEIGHT = 440;

const PLAYER_COLORS: Record<PlayerType, string> = {
  outside: "#E63C2F",
  opposite: "#F5A623",
  middleBlocker: "#4DB87A",
  setter: "#3EC6D4",
  libero: "#624DB8",
};
const PLAYER_LABELS: Record<PlayerType, string> = {
  outside: "OH",
  opposite: "OP",
  middleBlocker: "MB",
  setter: "S",
  libero: "L",
};

const OBJECT_COLORS: Record<ObjectType, string> = {
  pylon: "#FF8C00",
  bench: "#8B5E3C",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const toSketchData = (
  players: Player[],
  arrows: Arrow[],
  objects: SketchObject[],
): SketchData => ({
  players: Object.fromEntries(players.map(({ id, ...rest }) => [id, rest])),
  arrows: Object.fromEntries(arrows.map(({ id, ...rest }) => [id, rest])),
  objects: Object.fromEntries(objects.map(({ id, ...rest }) => [id, rest])),
});

const fromSketchData = (
  sketch?: SketchData,
): {
  players: Player[];
  arrows: Arrow[];
  objects: SketchObject[];
} => {
  if (!sketch) return { players: [], arrows: [], objects: [] };

  const rawPlayers = Object.entries(sketch.players ?? {}).map(([id, p]) => ({
    id,
    ...(p as any),
  }));

  // Legacy migration: old sketches used attacker/defender/setter/libero with
  // different color semantics. Detect by checking for old-only type names.
  const hasLegacy = rawPlayers.some(
    (p) => p.type === "attacker" || p.type === "defender",
  );
  const LEGACY_MAP: Record<string, PlayerType> = {
    attacker: "outside", // red → red (OH)
    defender: "setter", // teal → teal (S)
    setter: "opposite", // orange → orange (OP)
    libero: "middleBlocker", // green → green (MB)
  };
  const players: Player[] = rawPlayers.map((p) => {
    const newType = hasLegacy
      ? ((LEGACY_MAP[p.type] ?? p.type) as PlayerType)
      : (p.type as PlayerType);
    return { ...p, type: newType, label: PLAYER_LABELS[newType] ?? p.label };
  });

  return {
    players,
    arrows: Object.entries(sketch.arrows ?? {}).map(([id, a]) => ({
      id,
      ...(a as any),
    })),
    objects: Object.entries((sketch as any).objects ?? {}).map(([id, o]) => ({
      id,
      ...(o as any),
    })),
  };
};

// ─── SVG shape renderers ──────────────────────────────────────────────────────

const PylonShape = ({ selected }: { selected: boolean }) => (
  <>
    {selected && (
      <polygon
        points="0,-20 17,12 -17,12"
        fill="none"
        stroke="#E63C2F"
        strokeWidth={2}
        strokeDasharray="4 2"
      />
    )}
    <polygon
      points="0,-13 11,8 -11,8"
      fill={OBJECT_COLORS.pylon}
      stroke="#1E1E1E"
      strokeWidth={1.5}
    />
  </>
);

const BenchShape = ({ selected }: { selected: boolean }) => (
  <>
    {selected && (
      <rect
        x={-22}
        y={-12}
        width={44}
        height={24}
        fill="none"
        stroke="#E63C2F"
        strokeWidth={2}
        strokeDasharray="4 2"
        rx={2}
      />
    )}
    <rect
      x={-15}
      y={-7}
      width={30}
      height={14}
      fill={OBJECT_COLORS.bench}
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
);

// ─── Palette item renderers (for toolbar) ─────────────────────────────────────

const PylonPalette = ({ active }: { active: boolean }) => (
  <svg width="28" height="28" viewBox="-14 -14 28 28">
    <polygon
      points="0,-10 9,6 -9,6"
      fill={OBJECT_COLORS.pylon}
      stroke="#1E1E1E"
      strokeWidth={active ? 2.5 : 1.5}
    />
  </svg>
);

const BenchPalette = ({ active }: { active: boolean }) => (
  <svg width="36" height="24" viewBox="-18 -12 36 24">
    <rect
      x={-13}
      y={-6}
      width={26}
      height={12}
      fill={OBJECT_COLORS.bench}
      stroke="#1E1E1E"
      strokeWidth={active ? 2.5 : 1.5}
      rx={2}
    />
    <line
      x1={-9}
      y1={6}
      x2={-9}
      y2={10}
      stroke="#1E1E1E"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <line
      x1={9}
      y1={6}
      x2={9}
      y2={10}
      stroke="#1E1E1E"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

const SketchCreation: React.FC<Props> = ({ sketch, onChange }) => {
  const {
    players: initPlayers,
    arrows: initArrows,
    objects: initObjects,
  } = fromSketchData(sketch);

  const [players, setPlayers] = useState<Player[]>(initPlayers);
  const [arrows, setArrows] = useState<Arrow[]>(initArrows);
  const [objects, setObjects] = useState<SketchObject[]>(initObjects);
  const [tool, setTool] = useState<Tool>("select");
  const [arrowStyle, setArrowStyle] = useState<"solid" | "dashed">("solid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftArrow, setDraftArrow] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [pendingPlayerType, setPendingPlayerType] = useState<PlayerType | null>(
    null,
  );
  const [pendingObjectType, setPendingObjectType] = useState<ObjectType | null>(
    null,
  );

  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    kind: "player" | "object";
  } | null>(null);
  const arrowRef = useRef<{ x1: number; y1: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    onChange({ sketch: toSketchData(players, arrows, objects) });
  }, [players, arrows, objects]);

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  const getPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(SVG_WIDTH, (clientX - rect.left) * (SVG_WIDTH / rect.width)),
      ),
      y: Math.max(
        0,
        Math.min(SVG_HEIGHT, (clientY - rect.top) * (SVG_HEIGHT / rect.height)),
      ),
    };
  }, []);

  const fromMouseEvent = (e: React.MouseEvent) =>
    getPoint(e.clientX, e.clientY);
  const fromTouchEvent = (e: React.TouchEvent) => {
    const t = e.touches[0] ?? e.changedTouches[0];
    return getPoint(t.clientX, t.clientY);
  };

  // ── Place helpers ──────────────────────────────────────────────────────────

  const placePlayer = (pt: { x: number; y: number }, type: PlayerType) => {
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
  };

  const placeObject = (pt: { x: number; y: number }, type: ObjectType) => {
    setObjects((prev) => [
      ...prev,
      {
        id: uid(),
        x: Math.max(15, Math.min(SVG_WIDTH - 15, pt.x)),
        y: Math.max(15, Math.min(SVG_HEIGHT - 15, pt.y)),
        type,
      },
    ]);
  };

  // ── Mouse handlers ─────────────────────────────────────────────────────────

  const handlePlayerMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (tool !== "select") return;
      e.stopPropagation();
      setSelectedId(id);
      const pt = fromMouseEvent(e);
      const p = players.find((p) => p.id === id);
      if (!p) return;
      dragRef.current = {
        id,
        offsetX: pt.x - p.x,
        offsetY: pt.y - p.y,
        kind: "player",
      };
    },
    [tool, players],
  );

  const handleObjectMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (tool !== "select") return;
      e.stopPropagation();
      setSelectedId(id);
      const pt = fromMouseEvent(e);
      const o = objects.find((o) => o.id === id);
      if (!o) return;
      dragRef.current = {
        id,
        offsetX: pt.x - o.x,
        offsetY: pt.y - o.y,
        kind: "object",
      };
    },
    [tool, objects],
  );

  const handleSVGMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (tool === "arrow") {
        const pt = fromMouseEvent(e);
        arrowRef.current = { x1: pt.x, y1: pt.y };
        setDraftArrow({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      } else {
        setSelectedId(null);
      }
    },
    [tool],
  );

  const handleSVGMouseMove = useCallback((e: React.MouseEvent) => {
    const pt = fromMouseEvent(e);
    if (dragRef.current) {
      const { id, offsetX, offsetY, kind } = dragRef.current;
      if (kind === "player") {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x - offsetX)),
                  y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y - offsetY)),
                }
              : p,
          ),
        );
      } else {
        setObjects((prev) =>
          prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  x: Math.max(15, Math.min(SVG_WIDTH - 15, pt.x - offsetX)),
                  y: Math.max(15, Math.min(SVG_HEIGHT - 15, pt.y - offsetY)),
                }
              : o,
          ),
        );
      }
    }
    if (arrowRef.current)
      setDraftArrow({ ...arrowRef.current, x2: pt.x, y2: pt.y });
  }, []);

  const commitDraftArrow = useCallback(() => {
    if (arrowRef.current && draftArrow) {
      const dx = draftArrow.x2 - draftArrow.x1,
        dy = draftArrow.y2 - draftArrow.y1;
      if (Math.sqrt(dx * dx + dy * dy) > 20) {
        setArrows((prev) => [
          ...prev,
          { id: uid(), ...draftArrow, style: arrowStyle },
        ]);
      }
      arrowRef.current = null;
      setDraftArrow(null);
    }
    dragRef.current = null;
  }, [draftArrow, arrowStyle]);

  const handleSVGMouseUp = useCallback(() => {
    commitDraftArrow();
  }, [commitDraftArrow]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const pt = getPoint(e.clientX, e.clientY);
      const playerType = e.dataTransfer.getData("playerType") as PlayerType;
      const objectType = e.dataTransfer.getData("objectType") as ObjectType;
      if (playerType) placePlayer(pt, playerType);
      else if (objectType) placeObject(pt, objectType);
    },
    [getPoint],
  );

  // ── Touch handlers ─────────────────────────────────────────────────────────

  const handleSVGTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const pt = fromTouchEvent(e);

      if (pendingPlayerType) {
        placePlayer(pt, pendingPlayerType);
        setPendingPlayerType(null);
        return;
      }
      if (pendingObjectType) {
        placeObject(pt, pendingObjectType);
        setPendingObjectType(null);
        return;
      }

      if (tool === "arrow") {
        arrowRef.current = { x1: pt.x, y1: pt.y };
        setDraftArrow({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      } else {
        const hitPlayer = players.find((p) => {
          const dx = p.x - pt.x,
            dy = p.y - pt.y;
          return Math.sqrt(dx * dx + dy * dy) < 22;
        });
        if (hitPlayer) {
          setSelectedId(hitPlayer.id);
          dragRef.current = {
            id: hitPlayer.id,
            offsetX: pt.x - hitPlayer.x,
            offsetY: pt.y - hitPlayer.y,
            kind: "player",
          };
          return;
        }
        const hitObject = objects.find((o) => {
          const dx = Math.abs(o.x - pt.x),
            dy = Math.abs(o.y - pt.y);
          return dx < 20 && dy < 20;
        });
        if (hitObject) {
          setSelectedId(hitObject.id);
          dragRef.current = {
            id: hitObject.id,
            offsetX: pt.x - hitObject.x,
            offsetY: pt.y - hitObject.y,
            kind: "object",
          };
          return;
        }
        setSelectedId(null);
      }
    },
    [tool, players, objects, pendingPlayerType, pendingObjectType],
  );

  const handleSVGTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const pt = fromTouchEvent(e);
    if (dragRef.current) {
      const { id, offsetX, offsetY, kind } = dragRef.current;
      if (kind === "player") {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x - offsetX)),
                  y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y - offsetY)),
                }
              : p,
          ),
        );
      } else {
        setObjects((prev) =>
          prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  x: Math.max(15, Math.min(SVG_WIDTH - 15, pt.x - offsetX)),
                  y: Math.max(15, Math.min(SVG_HEIGHT - 15, pt.y - offsetY)),
                }
              : o,
          ),
        );
      }
    }
    if (arrowRef.current)
      setDraftArrow({ ...arrowRef.current, x2: pt.x, y2: pt.y });
  }, []);

  const handleSVGTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      commitDraftArrow();
    },
    [commitDraftArrow],
  );

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    setPlayers((prev) => prev.filter((p) => p.id !== selectedId));
    setArrows((prev) => prev.filter((a) => a.id !== selectedId));
    setObjects((prev) => prev.filter((o) => o.id !== selectedId));
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
    setObjects([]);
    setSelectedId(null);
    setPendingPlayerType(null);
    setPendingObjectType(null);
  };

  // ── Palette handlers ───────────────────────────────────────────────────────

  const handlePalettePlayer = (
    type: PlayerType,
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      e.preventDefault();
      setPendingObjectType(null);
      setPendingPlayerType((prev) => (prev === type ? null : type));
    }
  };

  const handlePaletteObject = (
    type: ObjectType,
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      e.preventDefault();
      setPendingPlayerType(null);
      setPendingObjectType((prev) => (prev === type ? null : type));
    }
  };

  const pendingAny = pendingPlayerType ?? pendingObjectType;
  const pendingLabel = pendingPlayerType
    ? pendingPlayerType
    : pendingObjectType === "pylon"
      ? "pylon"
      : pendingObjectType === "bench"
        ? "bench/elevated object"
        : null;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="excercisewizard">
      <h2>Create your sketch</h2>

      {pendingAny ? (
        <p className="sketch__hint sketch__hint--pending">
          Tap anywhere on the court to place <strong>{pendingLabel}</strong> —
          tap badge again to cancel
        </p>
      ) : (
        <p className="sketch__hint">
          {tool === "select"
            ? "Desktop: drag items onto court. Mobile: tap a badge then tap the court."
            : "Click / drag on the court to draw an arrow."}
        </p>
      )}

      {/* ── Toolbar ── */}
      <div className="sketch__toolbar">
        {/* Players */}
        <div className="sketch__toolbar__group">
          <div>
            <h4 className="sketch__toolbar__label">Players</h4>
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

        {/* Objects */}
        <div className="sketch__toolbar__group">
          <div>
            <h4 className="sketch__toolbar__label">Objects</h4>
          </div>
          <div className="sketch__toolbar__group--tools">
            <div
              className={`sketch__palette__object ${pendingObjectType === "pylon" ? "sketch__palette__object--active" : ""}`}
              draggable
              title="Pylon"
              onDragStart={(e) => e.dataTransfer.setData("objectType", "pylon")}
              onClick={(e) => handlePaletteObject("pylon", e)}
              onTouchStart={(e) => handlePaletteObject("pylon", e)}
            >
              <PylonPalette active={pendingObjectType === "pylon"} />
            </div>
            <div
              className={`sketch__palette__object ${pendingObjectType === "bench" ? "sketch__palette__object--active" : ""}`}
              draggable
              title="Bench / elevated object"
              onDragStart={(e) => e.dataTransfer.setData("objectType", "bench")}
              onClick={(e) => handlePaletteObject("bench", e)}
              onTouchStart={(e) => handlePaletteObject("bench", e)}
            >
              <BenchPalette active={pendingObjectType === "bench"} />
            </div>
          </div>
        </div>

        {/* Tools */}
        <div className="sketch__toolbar__group">
          <h4 className="sketch__toolbar__label">Tools</h4>
          <div className="sketch__toolbar__group--tools">
            <button
              className={`sketch__tool__btn ${tool === "select" ? "sketch__tool__btn--active" : ""}`}
              onClick={() => {
                setTool("select");
                setPendingPlayerType(null);
                setPendingObjectType(null);
              }}
            >
              ↖ Select
            </button>
            <button
              className={`sketch__tool__btn ${tool === "arrow" ? "sketch__tool__btn--active" : ""}`}
              onClick={() => {
                setTool("arrow");
                setPendingPlayerType(null);
                setPendingObjectType(null);
              }}
            >
              → Arrow
            </button>
          </div>
        </div>

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
        className={`sketch__canvas sketch__canvas--tool-${tool}${pendingAny ? " sketch__canvas--placing" : ""}`}
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

        {/* Court */}
        <path d="M560 0H0V440H560V0Z" fill="white" />
        <path
          d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z"
          fill="#F4EDE0"
        />
        <path
          d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203"
          stroke="black"
        />

        {/* Objects */}
        {objects.map((obj) => (
          <g
            key={obj.id}
            transform={`translate(${obj.x}, ${obj.y})`}
            onMouseDown={(e) => handleObjectMouseDown(e, obj.id)}
            onClick={(e) => {
              e.stopPropagation();
              if (tool === "select") setSelectedId(obj.id);
            }}
            style={{ cursor: tool === "select" ? "grab" : "default" }}
          >
            {obj.type === "pylon" && (
              <PylonShape selected={selectedId === obj.id} />
            )}
            {obj.type === "bench" && (
              <BenchShape selected={selectedId === obj.id} />
            )}
          </g>
        ))}

        {/* Arrows */}
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
            <line
              x1={arrow.x1}
              y1={arrow.y1}
              x2={arrow.x2}
              y2={arrow.y2}
              stroke="transparent"
              strokeWidth={16}
              style={{ cursor: "pointer" }}
            />
          </g>
        ))}

        {/* Draft arrow */}
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
              if (tool === "select" && !dragRef.current)
                setSelectedId(player.id);
            }}
            style={{ cursor: tool === "select" ? "grab" : "default" }}
          >
            {selectedId === player.id && (
              <circle
                r={18}
                fill="none"
                stroke="#E63C2F"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            )}
            <circle r={18} fill="transparent" />
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
            >
              × Delete
            </button>
          )}
          <button className="sketch__tool__btn" onClick={clearAll}>
            ✕ Clear all
          </button>
        </div>
      </div>
    </div>
  );
};

export default SketchCreation;
