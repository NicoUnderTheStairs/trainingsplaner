import React, { useRef, useState, useCallback, useEffect } from "react";
import type {
  SketchData,
  PlayerType,
  Player,
  Arrow,
} from "../../../types/Sketch";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = "select" | "arrow";
type ObjectType = "pylon" | "bench" | "matt" | "ball";

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
  coach: "#FFEE52",
};
const PLAYER_LABELS: Record<PlayerType, string> = {
  outside: "OH",
  opposite: "OP",
  middleBlocker: "MB",
  setter: "S",
  libero: "L",
  coach: "C",
};

const OBJECT_COLORS: Record<ObjectType, string> = {
  pylon: "#FF8C00",
  bench: "#8B5E3C",
  matt: "#4A90D9",
  ball: "#FFEE52",
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

const MattShape = ({ selected }: { selected: boolean }) => (
  <>
    {selected && (
      <rect
        x={-28}
        y={-15}
        width={56}
        height={30}
        fill="none"
        stroke="#E63C2F"
        strokeWidth={2}
        strokeDasharray="4 2"
        rx={3}
      />
    )}
    <rect
      x={-22}
      y={-10}
      width={44}
      height={20}
      fill={OBJECT_COLORS.matt}
      stroke="#1E1E1E"
      strokeWidth={1.5}
      rx={3}
    />
  </>
);

const BallShape = ({ selected }: { selected: boolean }) => (
  <>
    {selected && (
      <circle
        r={14}
        fill="none"
        stroke="#E63C2F"
        strokeWidth={2}
        strokeDasharray="4 2"
      />
    )}
    <circle
      r={8}
      fill={OBJECT_COLORS.ball}
      stroke="#1E1E1E"
      strokeWidth={1.5}
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

const MattPalette = ({ active }: { active: boolean }) => (
  <svg width="36" height="20" viewBox="-18 -10 36 20">
    <rect
      x={-15}
      y={-7}
      width={30}
      height={14}
      fill={OBJECT_COLORS.matt}
      stroke="#1E1E1E"
      strokeWidth={active ? 2.5 : 1.5}
      rx={3}
    />
  </svg>
);

const BallPalette = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="-12 -12 24 24">
    <circle
      r={8}
      fill={OBJECT_COLORS.ball}
      stroke="#1E1E1E"
      strokeWidth={active ? 2.5 : 1.5}
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
  const didDragRef = useRef(false);

  // ── History (undo / redo) ─────────────────────────────────────────────────
  type HistSnap = { players: Player[]; arrows: Arrow[]; objects: SketchObject[] };
  const historyStack = useRef<HistSnap[]>([{ players: initPlayers, arrows: initArrows, objects: initObjects }]);
  const historyIdx = useRef(0);
  const [historyVersion, setHistoryVersion] = useState(0);

  const playersRef = useRef(players);
  const arrowsRef = useRef(arrows);
  const objectsRef = useRef(objects);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { arrowsRef.current = arrows; }, [arrows]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);

  useEffect(() => {
    onChange({ sketch: toSketchData(players, arrows, objects) });
  }, [players, arrows, objects]);

  // ── History helpers ───────────────────────────────────────────────────────

  const doSnapshot = (p: Player[], a: Arrow[], o: SketchObject[]) => {
    historyStack.current = historyStack.current.slice(0, historyIdx.current + 1);
    historyStack.current.push({ players: p, arrows: a, objects: o });
    historyIdx.current = historyStack.current.length - 1;
    setHistoryVersion((v) => v + 1);
  };

  const undo = useCallback(() => {
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    const s = historyStack.current[historyIdx.current];
    setPlayers(s.players); playersRef.current = s.players;
    setArrows(s.arrows);   arrowsRef.current = s.arrows;
    setObjects(s.objects); objectsRef.current = s.objects;
    setSelectedId(null);
    setHistoryVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    if (historyIdx.current >= historyStack.current.length - 1) return;
    historyIdx.current++;
    const s = historyStack.current[historyIdx.current];
    setPlayers(s.players); playersRef.current = s.players;
    setArrows(s.arrows);   arrowsRef.current = s.arrows;
    setObjects(s.objects); objectsRef.current = s.objects;
    setSelectedId(null);
    setHistoryVersion((v) => v + 1);
  }, []);

  const canUndo = historyVersion >= 0 && historyIdx.current > 0;
  const canRedo = historyVersion >= 0 && historyIdx.current < historyStack.current.length - 1;

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
    const newP: Player = {
      id: uid(),
      x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x)),
      y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y)),
      type,
      label: PLAYER_LABELS[type],
    };
    const nextP = [...playersRef.current, newP];
    setPlayers(nextP);
    playersRef.current = nextP;
    doSnapshot(nextP, arrowsRef.current, objectsRef.current);
  };

  const placeObject = (pt: { x: number; y: number }, type: ObjectType) => {
    const newO: SketchObject = {
      id: uid(),
      x: Math.max(15, Math.min(SVG_WIDTH - 15, pt.x)),
      y: Math.max(15, Math.min(SVG_HEIGHT - 15, pt.y)),
      type,
    };
    const nextO = [...objectsRef.current, newO];
    setObjects(nextO);
    objectsRef.current = nextO;
    doSnapshot(playersRef.current, arrowsRef.current, nextO);
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
      didDragRef.current = true;
      if (kind === "player") {
        setPlayers((prev) => {
          const next = prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x - offsetX)),
                  y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y - offsetY)),
                }
              : p,
          );
          playersRef.current = next;
          return next;
        });
      } else {
        setObjects((prev) => {
          const next = prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  x: Math.max(15, Math.min(SVG_WIDTH - 15, pt.x - offsetX)),
                  y: Math.max(15, Math.min(SVG_HEIGHT - 15, pt.y - offsetY)),
                }
              : o,
          );
          objectsRef.current = next;
          return next;
        });
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
        const newArrow: Arrow = { id: uid(), ...draftArrow, style: arrowStyle };
        const nextA = [...arrowsRef.current, newArrow];
        setArrows(nextA);
        arrowsRef.current = nextA;
        doSnapshot(playersRef.current, nextA, objectsRef.current);
      }
      arrowRef.current = null;
      setDraftArrow(null);
    }
    if (didDragRef.current) {
      doSnapshot(playersRef.current, arrowsRef.current, objectsRef.current);
      didDragRef.current = false;
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
      didDragRef.current = true;
      if (kind === "player") {
        setPlayers((prev) => {
          const next = prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  x: Math.max(10, Math.min(SVG_WIDTH - 10, pt.x - offsetX)),
                  y: Math.max(10, Math.min(SVG_HEIGHT - 10, pt.y - offsetY)),
                }
              : p,
          );
          playersRef.current = next;
          return next;
        });
      } else {
        setObjects((prev) => {
          const next = prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  x: Math.max(15, Math.min(SVG_WIDTH - 15, pt.x - offsetX)),
                  y: Math.max(15, Math.min(SVG_HEIGHT - 15, pt.y - offsetY)),
                }
              : o,
          );
          objectsRef.current = next;
          return next;
        });
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
    const nextP = playersRef.current.filter((x) => x.id !== selectedId);
    const nextA = arrowsRef.current.filter((x) => x.id !== selectedId);
    const nextO = objectsRef.current.filter((x) => x.id !== selectedId);
    setPlayers(nextP); playersRef.current = nextP;
    setArrows(nextA);  arrowsRef.current = nextA;
    setObjects(nextO); objectsRef.current = nextO;
    setSelectedId(null);
    doSnapshot(nextP, nextA, nextO);
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if ((e.key === "Delete" || e.key === "Backspace") && tag !== "INPUT" && tag !== "TEXTAREA") {
        handleDelete();
      }
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === "y" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDelete, undo, redo]);

  const clearAll = () => {
    setPlayers([]); playersRef.current = [];
    setArrows([]);   arrowsRef.current = [];
    setObjects([]); objectsRef.current = [];
    setSelectedId(null);
    setPendingPlayerType(null);
    setPendingObjectType(null);
    doSnapshot([], [], []);
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
  // true on touch-screen devices — used to gate draggable and fix double-fire
  const coarsePointer = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
    <div className="excercisewizard">
      <h2>Create your sketch</h2>

      <div className="sketch__editor">
        {/* ── Top controls: undo · redo · delete · clear ── */}
        <div className="sketch__topbar">
          <button
            className="sketch__tool__btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ⟲ Undo
          </button>
          <button
            className="sketch__tool__btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ⟳ Redo
          </button>
          <div className="sketch__topbar__spacer" />
          {selectedId && (
            <button
              className="sketch__tool__btn sketch__tool__btn--danger"
              onClick={handleDelete}
            >
              × Delete
            </button>
          )}
          <button className="sketch__tool__btn" onClick={clearAll}>
            ✕ Clear
          </button>
        </div>

        {/* ── Canvas ── */}
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
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
              <path d="M0,0 L0,8 L8,4 Z" fill="#1E1E1E" />
            </marker>
            <marker id="arrowhead-draft" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
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
              onClick={(e) => { e.stopPropagation(); if (tool === "select") setSelectedId(obj.id); }}
              style={{ cursor: tool === "select" ? "grab" : "default" }}
            >
              {obj.type === "pylon" && <PylonShape selected={selectedId === obj.id} />}
              {obj.type === "bench" && <BenchShape selected={selectedId === obj.id} />}
              {obj.type === "matt"  && <MattShape  selected={selectedId === obj.id} />}
              {obj.type === "ball"  && <BallShape  selected={selectedId === obj.id} />}
            </g>
          ))}

          {/* Arrows */}
          {arrows.map((arrow) => (
            <g
              key={arrow.id}
              onClick={(e) => { e.stopPropagation(); if (tool === "select") setSelectedId(arrow.id); }}
            >
              <line
                x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2}
                stroke={selectedId === arrow.id ? "#E63C2F" : "#1E1E1E"}
                strokeWidth={selectedId === arrow.id ? 2.5 : 2}
                strokeDasharray={arrow.style === "dashed" ? "6 4" : undefined}
                markerEnd="url(#arrowhead)"
                style={{ cursor: "pointer" }}
              />
              <line
                x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2}
                stroke="transparent" strokeWidth={16} style={{ cursor: "pointer" }}
              />
            </g>
          ))}

          {/* Draft arrow */}
          {draftArrow && (
            <line
              x1={draftArrow.x1} y1={draftArrow.y1} x2={draftArrow.x2} y2={draftArrow.y2}
              stroke="#999" strokeWidth={2}
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
                if (tool === "select" && !dragRef.current) setSelectedId(player.id);
              }}
              style={{ cursor: tool === "select" ? "grab" : "default" }}
            >
              {selectedId === player.id && (
                <circle r={18} fill="none" stroke="#E63C2F" strokeWidth={2} strokeDasharray="4 2" />
              )}
              <circle r={18} fill="transparent" />
              <circle r={11} fill={PLAYER_COLORS[player.type]} />
              <text
                textAnchor="middle" dominantBaseline="central"
                fill={player.type === "coach" ? "#1E1E1E" : "white"}
                fontSize={11} fontWeight="bold" fontFamily="Roboto, sans-serif"
                pointerEvents="none"
              >
                {player.label}
              </text>
            </g>
          ))}
        </svg>

        {/* ── Bottom toolbar ── */}
        <div className="sketch__bottombar">
          {/* Palette row: players + objects side by side */}
          <div className="sketch__bottombar__palette">
            <div className="sketch__bottombar__palette__group">
              <span className="sketch__bottombar__label">Players</span>
              {(Object.keys(PLAYER_COLORS) as PlayerType[]).map((type) => (
                <div
                  key={type}
                  className={`sketch__palette__player ${pendingPlayerType === type ? "sketch__palette__player--active" : ""}`}
                  draggable={!coarsePointer}
                  title={type}
                  onDragStart={(e) => e.dataTransfer.setData("playerType", type)}
                  onTouchStart={(e) => { e.preventDefault(); handlePalettePlayer(type, e); }}
                  style={{ background: PLAYER_COLORS[type] }}
                >
                  {PLAYER_LABELS[type]}
                </div>
              ))}
            </div>
            <div className="sketch__bottombar__palette__group">
              <span className="sketch__bottombar__label">Objects</span>
              <div
                className={`sketch__palette__object ${pendingObjectType === "pylon" ? "sketch__palette__object--active" : ""}`}
                draggable={!coarsePointer} title="Pylon"
                onDragStart={(e) => e.dataTransfer.setData("objectType", "pylon")}
                onTouchStart={(e) => { e.preventDefault(); handlePaletteObject("pylon", e); }}
              >
                <PylonPalette active={pendingObjectType === "pylon"} />
              </div>
              <div
                className={`sketch__palette__object ${pendingObjectType === "bench" ? "sketch__palette__object--active" : ""}`}
                draggable={!coarsePointer} title="Bench / elevated object"
                onDragStart={(e) => e.dataTransfer.setData("objectType", "bench")}
                onTouchStart={(e) => { e.preventDefault(); handlePaletteObject("bench", e); }}
              >
                <BenchPalette active={pendingObjectType === "bench"} />
              </div>
              <div
                className={`sketch__palette__object ${pendingObjectType === "matt" ? "sketch__palette__object--active" : ""}`}
                draggable={!coarsePointer} title="Matt"
                onDragStart={(e) => e.dataTransfer.setData("objectType", "matt")}
                onTouchStart={(e) => { e.preventDefault(); handlePaletteObject("matt", e); }}
              >
                <MattPalette active={pendingObjectType === "matt"} />
              </div>
              <div
                className={`sketch__palette__object ${pendingObjectType === "ball" ? "sketch__palette__object--active" : ""}`}
                draggable={!coarsePointer} title="Ball"
                onDragStart={(e) => e.dataTransfer.setData("objectType", "ball")}
                onTouchStart={(e) => { e.preventDefault(); handlePaletteObject("ball", e); }}
              >
                <BallPalette active={pendingObjectType === "ball"} />
              </div>
            </div>
          </div>

          {/* Controls row */}
          <div className="sketch__bottombar__controls">
            <div className="sketch__pill">
              <button
                className={`sketch__pill__btn ${tool === "select" ? "sketch__pill__btn--active" : ""}`}
                title="Move and select items"
                onClick={() => { setTool("select"); setPendingPlayerType(null); setPendingObjectType(null); }}
              >
                ▶ Move
              </button>
              <button
                className={`sketch__pill__btn ${tool === "arrow" ? "sketch__pill__btn--active" : ""}`}
                title="Draw arrows on the court"
                onClick={() => { setTool("arrow"); setPendingPlayerType(null); setPendingObjectType(null); }}
              >
                → Draw
              </button>
            </div>

            {tool === "arrow" && (
              <div className="sketch__pill">
                <button
                  className={`sketch__pill__btn ${arrowStyle === "solid" ? "sketch__pill__btn--active" : ""}`}
                  onClick={() => setArrowStyle("solid")} title="Solid line"
                >
                  — Solid
                </button>
                <button
                  className={`sketch__pill__btn ${arrowStyle === "dashed" ? "sketch__pill__btn--active" : ""}`}
                  onClick={() => setArrowStyle("dashed")} title="Dashed line"
                >
                  ╌ Dashed
                </button>
              </div>
            )}

          </div>

          <p className={`sketch__hint${pendingAny ? " sketch__hint--pending" : ""}`}>
            {pendingAny
              ? `Tap the court to place ${pendingLabel} — tap the badge again to cancel`
              : tool === "select"
                ? ""
                : ""}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SketchCreation;
