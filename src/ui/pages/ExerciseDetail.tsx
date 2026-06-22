import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Navigation from "../components/navigation/Navigation";
import SketchThumbnail from "../components/sketch/Sketchthumbnail";
import KraftDetail from "./KraftDetail";
import type { Exercise } from "../../types/Exercise";
import type { SketchData } from "../../types/Sketch";
import db from "../../firebase";
import {
  fetchVariants,
  removeFromVariantGroup,
} from "../../services/excercisewizard/exerciseVariants";
import { useFavourite } from "../../hooks/useFavourite";
import { useAuth } from "../../auth/authContext";
import { useGetUserData } from "../../hooks/useGetUserData";

// ─── Constants ────────────────────────────────────────────────────────────────

export const AVAILABLE_TAGS = [
  "Warmup",
  "Defense",
  "Attack",
  "Block",
  "Reception",
  "Service",
];

const SVG_W = 560;
const SVG_H = 440;

type PlayerType =
  | "outside"
  | "opposite"
  | "middleBlocker"
  | "setter"
  | "libero"
  | "coach";
type SketchTool = "select" | "arrow";
type ObjectType = "pylon" | "bench" | "matt" | "ball";

interface Player {
  id: string;
  x: number;
  y: number;
  type: PlayerType;
  label: string;
}
interface Arrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: "solid" | "dashed";
}
interface SketchObject {
  id: string;
  x: number;
  y: number;
  type: ObjectType;
}

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
  players: Object.fromEntries(players.map(({ id, ...r }) => [id, r])),
  arrows: Object.fromEntries(arrows.map(({ id, ...r }) => [id, r])),
  objects: Object.fromEntries(objects.map(({ id, ...r }) => [id, r])),
});

const fromSketchData = (
  sketch?: SketchData,
): { players: Player[]; arrows: Arrow[]; objects: SketchObject[] } => {
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

// ─── Object shape renderers ────────────────────────────────────────────────────

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

const renderDescription = (text?: string) =>
  text?.split("\n").map((line, i) => (
    <span key={i}>
      {line}
      {i < text.split("\n").length - 1 && <br />}
    </span>
  ));

// ─── Palette renderers ──────────────────────────────────────────────────────

const PylonPalette = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="-12 -12 24 24">
    <polygon
      points="0,-10 9,6 -9,6"
      fill={OBJECT_COLORS.pylon}
      stroke="#1E1E1E"
      strokeWidth={active ? 2.5 : 1.5}
    />
  </svg>
);

const BenchPalette = ({ active }: { active: boolean }) => (
  <svg width="32" height="22" viewBox="-16 -11 32 22">
    <rect
      x={-12}
      y={-5}
      width={24}
      height={11}
      fill={OBJECT_COLORS.bench}
      stroke="#1E1E1E"
      strokeWidth={active ? 2.5 : 1.5}
      rx={2}
    />
    <line
      x1={-8}
      y1={6}
      x2={-8}
      y2={10}
      stroke="#1E1E1E"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <line
      x1={8}
      y1={6}
      x2={8}
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

// ─── Sketch editor ────────────────────────────────────────────────────────────

export const SketchEditor = ({
  sketch,
  onChange,
}: {
  sketch?: SketchData;
  onChange: (s: SketchData) => void;
}) => {
  const {
    players: initP,
    arrows: initA,
    objects: initO,
  } = fromSketchData(sketch);

  const [players, setPlayers] = useState<Player[]>(initP);
  const [arrows, setArrows] = useState<Arrow[]>(initA);
  const [objects, setObjects] = useState<SketchObject[]>(initO);
  const [tool, setTool] = useState<SketchTool>("select");
  const [arrowStyle, setArrowStyle] = useState<"solid" | "dashed">("solid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftArrow, setDraftArrow] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Pending placement (mobile: tap badge → tap court)
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
  const historyStack = useRef<HistSnap[]>([{ players: initP, arrows: initA, objects: initO }]);
  const historyIdx = useRef(0);
  const [historyVersion, setHistoryVersion] = useState(0);

  // Mirrors of state kept in sync so callbacks can snapshot without stale closures
  const playersRef = useRef(players);
  const arrowsRef = useRef(arrows);
  const objectsRef = useRef(objects);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { arrowsRef.current = arrows; }, [arrows]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);

  useEffect(() => {
    onChange(toSketchData(players, arrows, objects));
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

  // historyVersion >= 0 is always true — it's referenced so canUndo/canRedo
  // recompute on every history change without a stale-closure problem.
  const canUndo = historyVersion >= 0 && historyIdx.current > 0;
  const canRedo = historyVersion >= 0 && historyIdx.current < historyStack.current.length - 1;

  // ── Coordinate helper (works for mouse + touch) ──────────────────────────
  const getPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SVG_W, (clientX - r.left) * (SVG_W / r.width))),
      y: Math.max(0, Math.min(SVG_H, (clientY - r.top) * (SVG_H / r.height))),
    };
  }, []);

  const fromMouse = (e: React.MouseEvent | MouseEvent) =>
    getPoint(e.clientX, e.clientY);
  const fromTouch = (e: React.TouchEvent) => {
    const t = e.touches[0] ?? e.changedTouches[0];
    return getPoint(t.clientX, t.clientY);
  };

  // ── Place helpers ──────────────────────────────────────────────────────────
  const placePlayer = (pt: { x: number; y: number }, type: PlayerType) => {
    const newP: Player = {
      id: uid(),
      x: Math.max(10, Math.min(SVG_W - 10, pt.x)),
      y: Math.max(10, Math.min(SVG_H - 10, pt.y)),
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
      x: Math.max(15, Math.min(SVG_W - 15, pt.x)),
      y: Math.max(15, Math.min(SVG_H - 15, pt.y)),
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
      const pt = fromMouse(e);
      const p = players.find((p) => p.id === id);
      if (!p) return;
      dragRef.current = {
        id,
        offsetX: pt.x - p.x,
        offsetY: pt.y - p.y,
        kind: "player",
      };
    },
    [tool, players, getPoint],
  );

  const handleObjectMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (tool !== "select") return;
      e.stopPropagation();
      setSelectedId(id);
      const pt = fromMouse(e);
      const o = objects.find((o) => o.id === id);
      if (!o) return;
      dragRef.current = {
        id,
        offsetX: pt.x - o.x,
        offsetY: pt.y - o.y,
        kind: "object",
      };
    },
    [tool, objects, getPoint],
  );

  const moveDragged = (pt: { x: number; y: number }) => {
    const { id, offsetX, offsetY, kind } = dragRef.current!;
    didDragRef.current = true;
    if (kind === "player") {
      setPlayers((prev) => {
        const next = prev.map((p) =>
          p.id === id
            ? {
                ...p,
                x: Math.max(10, Math.min(SVG_W - 10, pt.x - offsetX)),
                y: Math.max(10, Math.min(SVG_H - 10, pt.y - offsetY)),
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
                x: Math.max(15, Math.min(SVG_W - 15, pt.x - offsetX)),
                y: Math.max(15, Math.min(SVG_H - 15, pt.y - offsetY)),
              }
            : o,
        );
        objectsRef.current = next;
        return next;
      });
    }
  };

  const handleSVGMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pt = fromMouse(e);
      if (dragRef.current) moveDragged(pt);
      if (arrowRef.current)
        setDraftArrow({ ...arrowRef.current, x2: pt.x, y2: pt.y });
    },
    [getPoint],
  );

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

  const handleSVGMouseUp = useCallback(
    () => commitDraftArrow(),
    [commitDraftArrow],
  );

  const handleSVGMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (tool === "arrow") {
        const pt = fromMouse(e);
        arrowRef.current = { x1: pt.x, y1: pt.y };
        setDraftArrow({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      } else {
        setSelectedId(null);
      }
    },
    [tool, getPoint],
  );

  // ── Desktop drag-and-drop from palette ───────────────────────────────────
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
      const pt = fromTouch(e);

      // Pending placement first
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
        return;
      }

      // Select mode — hit-test players then objects
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
    },
    [tool, players, objects, pendingPlayerType, pendingObjectType, getPoint],
  );

  const handleSVGTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const pt = fromTouch(e);
      if (dragRef.current) moveDragged(pt);
      if (arrowRef.current)
        setDraftArrow({ ...arrowRef.current, x2: pt.x, y2: pt.y });
    },
    [getPoint],
  );

  const handleSVGTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      commitDraftArrow();
    },
    [commitDraftArrow],
  );

  // ── Palette tap handlers (coarse pointer = mobile) ────────────────────────
  const isCoarse = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  const handlePalettePlayer = (
    type: PlayerType,
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    if (isCoarse()) {
      e.preventDefault();
      setPendingObjectType(null);
      setPendingPlayerType((prev) => (prev === type ? null : type));
    }
  };
  const handlePaletteObject = (
    type: ObjectType,
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    if (isCoarse()) {
      e.preventDefault();
      setPendingPlayerType(null);
      setPendingObjectType((prev) => (prev === type ? null : type));
    }
  };

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

  const pendingAny = pendingPlayerType ?? pendingObjectType;
  const pendingLabel = pendingPlayerType
    ? pendingPlayerType
    : pendingObjectType === "pylon"
      ? "pylon"
      : pendingObjectType === "bench"
        ? "bench/elevated object"
        : null;

  // true on touch-screen devices — used to gate draggable and fix double-fire
  const coarsePointer = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
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
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
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
            id="ed-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L0,8 L8,4 Z" fill="#1E1E1E" />
          </marker>
          <marker
            id="ed-arrow-draft"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L0,8 L8,4 Z" fill="#aaa" />
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
        {objects.map((o) => (
          <g
            key={o.id}
            transform={`translate(${o.x}, ${o.y})`}
            onMouseDown={(e) => handleObjectMouseDown(e, o.id)}
            onClick={(e) => {
              e.stopPropagation();
              if (tool === "select") setSelectedId(o.id);
            }}
            style={{ cursor: tool === "select" ? "grab" : "default" }}
          >
            {o.type === "pylon" && (
              <PylonShape selected={selectedId === o.id} />
            )}
            {o.type === "bench" && (
              <BenchShape selected={selectedId === o.id} />
            )}
            {o.type === "matt" && <MattShape selected={selectedId === o.id} />}
            {o.type === "ball" && <BallShape selected={selectedId === o.id} />}
          </g>
        ))}

        {/* Arrows */}
        {arrows.map((a) => (
          <g
            key={a.id}
            onClick={(e) => {
              e.stopPropagation();
              if (tool === "select") setSelectedId(a.id);
            }}
          >
            <line
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke={selectedId === a.id ? "#E63C2F" : "#1E1E1E"}
              strokeWidth={selectedId === a.id ? 2.5 : 2}
              strokeDasharray={a.style === "dashed" ? "6 4" : undefined}
              markerEnd="url(#ed-arrow)"
              style={{ cursor: "pointer" }}
            />
            <line
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke="transparent"
              strokeWidth={12}
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
            stroke="#aaa"
            strokeWidth={2}
            strokeDasharray={arrowStyle === "dashed" ? "6 4" : undefined}
            markerEnd="url(#ed-arrow-draft)"
            pointerEvents="none"
          />
        )}

        {/* Players */}
        {players.map((p) => (
          <g
            key={p.id}
            transform={`translate(${p.x}, ${p.y})`}
            onMouseDown={(e) => handlePlayerMouseDown(e, p.id)}
            onClick={(e) => {
              e.stopPropagation();
              if (tool === "select" && !dragRef.current) setSelectedId(p.id);
            }}
            style={{ cursor: tool === "select" ? "grab" : "default" }}
          >
            {selectedId === p.id && (
              <circle
                r={18}
                fill="none"
                stroke="#E63C2F"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            )}
            <circle r={18} fill="transparent" />
            <circle r={11} fill={PLAYER_COLORS[p.type]} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill={p.type === "coach" ? "#1E1E1E" : "white"}
              fontSize={11}
              fontWeight="bold"
              fontFamily="Roboto, sans-serif"
              pointerEvents="none"
            >
              {p.label}
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

        {/* Controls row: tool toggle · undo/redo · delete/clear */}
        <div className="sketch__bottombar__controls">
          <div className="sketch__pill">
            <button
              className={`sketch__pill__btn ${tool === "select" ? "sketch__pill__btn--active" : ""}`}
              title="Move and select items (drag to reposition)"
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
                onClick={() => setArrowStyle("solid")}
                title="Solid line"
              >
                — Solid
              </button>
              <button
                className={`sketch__pill__btn ${arrowStyle === "dashed" ? "sketch__pill__btn--active" : ""}`}
                onClick={() => setArrowStyle("dashed")}
                title="Dashed line"
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
              ? "Drag items to reposition · click to select · Del to delete"
              : "Click and drag on the court to draw an arrow"}
        </p>
      </div>
    </div>
  );

};

// ─── Variant types ────────────────────────────────────────────────────────────

interface VariantExercise {
  id: string;
  title: string;
  difficulty: number;
  tags: string[];
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const ExerciseDetailSkeleton = () => (
  <>
    <Navigation />
    <div className="exercisedetail section">
      <div className="exercisedetail__inner">
        {/* back */}
        <div className="exercisedetail__back">
          <span className="sk sk--rect" style={{ width: "8rem", height: "3.4rem" }} />
        </div>

        <div className="exercisedetail__layout">
          {/* left: info */}
          <div className="exercisedetail__info">
            <div className="sk-card" style={{ gap: "1.4rem" }}>
              <span className="sk sk--line sk--w30" />
              <span className="sk sk--line-xl sk--w65" />
              <div className="sk-row">
                <span className="sk sk--rect" style={{ width: "7rem", height: "2.4rem" }} />
                <span className="sk sk--rect" style={{ width: "7rem", height: "2.4rem" }} />
              </div>
              <div className="sk-row" style={{ marginTop: "0.4rem" }}>
                <span className="sk sk--rect" style={{ width: "9rem", height: "3.2rem" }} />
                <span className="sk sk--rect" style={{ width: "9rem", height: "3.2rem" }} />
              </div>
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="sk-card">
                <span className="sk sk--line sk--w30" />
                <span className="sk sk--line sk--w55" />
              </div>
            ))}
          </div>

          {/* right: sketch */}
          <span className="sk sk--rect" style={{ width: "100%", aspectRatio: "560/440" }} />
        </div>
      </div>
    </div>
  </>
);

// ─── Main component ───────────────────────────────────────────────────────────

const ExerciseDetail = () => {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();

  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");
  const userTeam = (userData as any)?.team ?? "";
  const currentUid = getAuth().currentUser?.uid ?? "";

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<VariantExercise[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Exercise>>({});

  const [editingSketch, setEditingSketch] = useState(false);
  const [editSketch, setEditSketch] = useState<SketchData | undefined>(
    undefined,
  );

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { isFavourite, toggleFavourite, toggling } = useFavourite(exerciseId);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!exerciseId) return;
    const fetch = async () => {
      const snap = await getDoc(doc(db, "Excercises", exerciseId));
      if (snap.exists())
        setExercise({ id: snap.id, ...snap.data() } as Exercise);
      setLoading(false);
    };
    fetch();
  }, [exerciseId]);

  useEffect(() => {
    if (!exerciseId || !exercise || !(exercise as any).variantGroupId) return;
    setLoadingVariants(true);
    fetchVariants(exerciseId)
      .then(setVariants)
      .catch(() => setVariants([]))
      .finally(() => setLoadingVariants(false));
  }, [exerciseId, exercise]);

  // ── Edit info ──────────────────────────────────────────────────────────────
  const handleEditStart = () => {
    if (!exercise) return;
    setEditData({
      title: exercise.title,
      description: exercise.description,
      difficulty: exercise.difficulty,
      tags: exercise.tags ?? [],
    });
    setEditing(true);
  };
  const handleEditCancel = () => {
    setEditing(false);
    setEditData({});
  };
  const handleEditChange = (field: keyof Exercise, value: unknown) =>
    setEditData((prev) => ({ ...prev, [field]: value }));
  const handleTagToggle = (tag: string) => {
    const current = editData.tags ?? [];
    handleEditChange(
      "tags",
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    );
  };

  // ── Fork helper ────────────────────────────────────────────────────────────
  const forkIfNeeded = async (): Promise<string> => {
    if (!exercise || !exerciseId) return exerciseId ?? "";
    const exTeam = (exercise as any).team;
    const teams: string[] = Array.isArray(exTeam)
      ? exTeam
      : exTeam
        ? [exTeam]
        : [];
    const isOwner =
      (teams.length === 1 && teams[0] === userTeam) ||
      (exercise as any).createdBy === currentUid;
    if (isOwner) return exerciseId;
    const { id: _id, ...exerciseData } = exercise as any;
    const forkRef = await addDoc(collection(db, "Excercises"), {
      ...exerciseData,
      team: userTeam ? [userTeam] : teams,
      forkedFrom: exerciseId,
      createdBy: currentUid,
      createdAt: Timestamp.now(),
    });
    return forkRef.id;
  };

  const handleSave = async () => {
    if (!exerciseId || !exercise) return;
    setSaving(true);
    try {
      const targetId = await forkIfNeeded();
      const isForked = targetId !== exerciseId;
      await updateDoc(doc(db, "Excercises", targetId), {
        title: editData.title ?? exercise.title,
        description: editData.description ?? exercise.description,
        difficulty: editData.difficulty ?? exercise.difficulty,
        tags: editData.tags ?? exercise.tags,
      });
      setEditing(false);
      setEditData({});
      if (isForked) navigate(`/exercise-detail/${targetId}`, { replace: true });
      else setExercise((prev) => (prev ? { ...prev, ...editData } : prev));
    } catch (e) {
      console.error("Error updating exercise:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit sketch ────────────────────────────────────────────────────────────
  const handleEditSketchStart = () => {
    setEditSketch(exercise?.sketch);
    setEditingSketch(true);
  };
  const handleEditSketchCancel = () => {
    setEditingSketch(false);
    setEditSketch(undefined);
  };
  const handleSaveSketch = async () => {
    if (!exerciseId || !exercise || !editSketch) return;
    setSaving(true);
    try {
      const targetId = await forkIfNeeded();
      const isForked = targetId !== exerciseId;
      await updateDoc(doc(db, "Excercises", targetId), { sketch: editSketch });
      setEditingSketch(false);
      setEditSketch(undefined);
      if (isForked) navigate(`/exercise-detail/${targetId}`, { replace: true });
      else
        setExercise((prev) => (prev ? { ...prev, sketch: editSketch } : prev));
    } catch (e) {
      console.error("Error updating sketch:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete permission ──────────────────────────────────────────────────────
  const exerciseTeams: string[] = (() => {
    const t = (exercise as any)?.team;
    return Array.isArray(t) ? t : t ? [t] : [];
  })();
  const canDelete = !!(userTeam && exerciseTeams.includes(userTeam));

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!exerciseId || !canDelete) return;
    setDeleting(true);
    try {
      await removeFromVariantGroup(exerciseId);
      await deleteDoc(doc(db, "Excercises", exerciseId));
      navigate(-1);
    } catch (e) {
      console.error("Error deleting exercise:", e);
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (loading)
    return (
      <ExerciseDetailSkeleton />
    );
  if (!exercise)
    return (
      <>
        <Navigation />
        <p style={{ padding: "4rem 11.2rem" }}>Exercise not found.</p>
      </>
    );

  if (exercise.title?.trim().toLowerCase() === "kraft") {
    return <KraftDetail exercise={exercise} />;
  }

  const hasVariants = variants.length > 0;

  return (
    <>
      <Navigation />
      <div className="exercisedetail section">
        <div className="exercisedetail__inner">
          {/* Back */}
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

          {/* ── Two-column layout ── */}
          <div className="exercisedetail__layout">
            {/* Left: info */}
            <div className="exercisedetail__info">
              <div className="exercisedetail__header">
                <div className="exercisedetail__header__accent" />
                <div className="exercisedetail__header__body">
                  <div className="exercisedetail__meta">
                    <span className="exercisedetail__meta__author">
                      {exercise.author}
                    </span>
                    {!editing && (
                      <>
                        <span className="exercisedetail__meta__sep">·</span>
                        <div
                          className={`difficulty difficulty--${exercise.difficulty}`}
                        >
                          <svg
                            width="16"
                            height="18"
                            viewBox="0 0 21 24"
                            fill="none"
                          >
                            <path
                              className={`difficulty--${exercise.difficulty}__path1`}
                              d="M0 17.5238H6V24H0V17.5238Z"
                              fill="#1E1E1E"
                            />
                            <path
                              className={`difficulty--${exercise.difficulty}__path2`}
                              d="M7.5 8.7619H13.5V24H7.5V8.7619Z"
                              fill="#1E1E1E"
                            />
                            <path
                              className={`difficulty--${exercise.difficulty}__path3`}
                              d="M15 0H21V24H15V0Z"
                              fill="#1E1E1E"
                            />
                          </svg>
                          <span>Level {exercise.difficulty}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {editing ? (
                    <input
                      className="exercisedetail__edit__input exercisedetail__edit__input--title"
                      value={editData.title ?? ""}
                      onChange={(e) =>
                        handleEditChange("title", e.target.value)
                      }
                      placeholder="Exercise title"
                    />
                  ) : (
                    <h1 className="exercisedetail__title">{exercise.title}</h1>
                  )}

                  {editing ? (
                    <textarea
                      className="exercisedetail__edit__input exercisedetail__edit__input--description"
                      value={editData.description ?? ""}
                      onChange={(e) =>
                        handleEditChange("description", e.target.value)
                      }
                      placeholder="Description"
                      rows={5}
                    />
                  ) : (
                    exercise.description && (
                      <p className="exercisedetail__description">
                        {renderDescription(exercise.description)}
                      </p>
                    )
                  )}

                  {editing && (
                    <div className="exercisedetail__edit__difficulty">
                      <label>Difficulty</label>
                      <div className="exercisedetail__edit__difficulty__btns">
                        {[1, 2, 3, 4, 5].map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={`exercisedetail__edit__difficulty__btn ${(editData.difficulty ?? exercise.difficulty) === d ? "exercisedetail__edit__difficulty__btn--active" : ""}`}
                            onClick={() => handleEditChange("difficulty", d)}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="exercisedetail__tags">
                    {editing ? (
                      <div className="exercisedetail__edit__tags">
                        {AVAILABLE_TAGS.map((tag) => (
                          <label
                            key={tag}
                            className={[
                              "tags",
                              `tags--${tag.toLowerCase()}`,
                              (editData.tags ?? []).includes(tag)
                                ? `tags--${tag.toLowerCase()}--active`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{ cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              style={{ display: "none" }}
                              checked={(editData.tags ?? []).includes(tag)}
                              onChange={() => handleTagToggle(tag)}
                            />
                            {tag}
                          </label>
                        ))}
                      </div>
                    ) : (
                      (exercise.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className={`tags tags--${tag.toLowerCase()}`}
                        >
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="exercisedetail__actions">
                {editing ? (
                  <>
                    <button
                      className="btn__wired"
                      onClick={handleEditCancel}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn__primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={`exercisedetail__btn exercisedetail__btn--favourite${isFavourite ? " exercisedetail__btn--favourite--active" : ""}`}
                      title={
                        isFavourite
                          ? "Remove from favourites"
                          : "Add to favourites"
                      }
                      onClick={toggleFavourite}
                      disabled={toggling}
                    >
                      <svg
                        width="22"
                        height="20"
                        viewBox="0 0 26 24"
                        fill="none"
                      >
                        <path
                          d="M19.2754 1.5C22.2429 1.5 24.4998 3.75726 24.5 6.79199C24.5 8.52207 24.2672 9.79464 23.8379 10.8643C23.4088 11.9333 22.7465 12.892 21.7627 13.9512C20.7617 15.0288 19.4807 16.1562 17.8262 17.6025C16.4436 18.8112 14.8339 20.216 13 21.9346C11.1661 20.216 9.55644 18.8112 8.17383 17.6025C6.51934 16.1562 5.2383 15.0288 4.2373 13.9512C3.25348 12.892 2.59124 11.9333 2.16211 10.8643C1.73284 9.79464 1.5 8.52207 1.5 6.79199C1.50023 3.75726 3.7571 1.5 6.72461 1.5C8.77382 1.50018 10.5736 2.70206 11.71 4.61523L13 6.78613L14.29 4.61523C15.4264 2.70206 17.2262 1.50018 19.2754 1.5Z"
                          stroke="currentColor"
                          strokeWidth="3"
                          fill={isFavourite ? "currentColor" : "none"}
                        />
                      </svg>
                      {isFavourite ? "Favourited" : "Favourite"}
                    </button>
                    <button
                      className="exercisedetail__btn"
                      onClick={handleEditStart}
                    >
                      <svg
                        width="16"
                        height="18"
                        viewBox="0 0 18 24"
                        fill="none"
                      >
                        <path
                          d="M16.8756 21.5929H1.12977C0.831474 21.5929 0.545402 21.7198 0.334478 21.9454C0.123556 22.1711 0.00506036 22.4772 0.00506036 22.7964C0.00506036 23.1156 0.123556 23.4217 0.334478 23.6474C0.545402 23.873 0.831474 23.9999 1.12977 23.9999H16.8756C17.1739 23.9999 17.46 23.873 17.671 23.6474C17.8818 23.4217 18.0004 23.1156 18.0004 22.7964C18.0004 22.4772 17.8818 22.1711 17.671 21.9454C17.46 21.7198 17.1739 21.5929 16.8756 21.5929Z"
                          fill="currentColor"
                        />
                        <path
                          d="M1.12943 19.1861H1.23066L5.92067 18.7288C6.43444 18.674 6.91495 18.4318 7.28156 18.0428L17.404 7.21152C17.7968 6.76739 18.0091 6.17473 17.9944 5.5634C17.9796 4.95206 17.739 4.37192 17.3251 3.9501L14.2435 0.652573C13.8413 0.248321 13.3142 0.0163667 12.7626 0.000833716C12.211 -0.0146993 11.6733 0.187273 11.2518 0.568331L1.12943 11.3996C0.765888 11.7919 0.53953 12.3061 0.48835 12.8558L0.00472708 17.8744C-0.0104239 18.0505 0.0109516 18.2282 0.0673295 18.3947C0.123707 18.5611 0.2137 18.7122 0.330892 18.8371C0.435984 18.9486 0.56062 19.0369 0.69765 19.0968C0.834682 19.1567 0.981413 19.187 1.12943 19.1861ZM12.6802 2.33744L15.7506 5.62292L13.5012 7.9697L10.487 4.74439L12.6802 2.33744ZM2.67028 13.0604L9.00236 6.33298L12.0391 9.58236L5.74072 16.3218L2.3666 16.6588L2.67028 13.0604Z"
                          fill="currentColor"
                        />
                      </svg>
                      Edit
                    </button>
                    {canDelete && (
                      <button
                        className="exercisedetail__btn exercisedetail__btn--danger"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Variants */}
              {(hasVariants || loadingVariants) && (
                <div className="exercisedetail__variants">
                  <h3 className="exercisedetail__variants__title">
                    Variants{" "}
                    <span className="exercisedetail__variants__count">
                      {variants.length}
                    </span>
                  </h3>
                  <p className="exercisedetail__variants__hint">
                    These exercises are variations of the same base exercise.
                  </p>
                  {loadingVariants ? (
                    <div className="exercisedetail__variants__loading">
                      Loading variants...
                    </div>
                  ) : (
                    <div className="exercisedetail__variants__list">
                      {variants.map((v) => (
                        <Link
                          key={v.id}
                          to={`/exercise-detail/${v.id}`}
                          className="exercisedetail__variants__item"
                        >
                          <div className="exercisedetail__variants__item__info">
                            <span className="exercisedetail__variants__item__title">
                              {v.title}
                            </span>
                            <div className="exercisedetail__variants__item__tags">
                              {v.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className={`tags tags--${tag.toLowerCase()}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="exercisedetail__variants__item__right">
                            <div
                              className={`difficulty difficulty--${v.difficulty}`}
                            >
                              <svg
                                width="14"
                                height="16"
                                viewBox="0 0 21 24"
                                fill="none"
                              >
                                <path
                                  className={`difficulty--${v.difficulty}__path1`}
                                  d="M0 17.5238H6V24H0V17.5238Z"
                                  fill="#1E1E1E"
                                />
                                <path
                                  className={`difficulty--${v.difficulty}__path2`}
                                  d="M7.5 8.7619H13.5V24H7.5V8.7619Z"
                                  fill="#1E1E1E"
                                />
                                <path
                                  className={`difficulty--${v.difficulty}__path3`}
                                  d="M15 0H21V24H15V0Z"
                                  fill="#1E1E1E"
                                />
                              </svg>
                            </div>
                            <svg
                              width="14"
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
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: sketch panel */}
            <div className="exercisedetail__sketch__panel">
              {editingSketch ? (
                <>
                  <SketchEditor
                    sketch={editSketch}
                    onChange={(s) => setEditSketch(s)}
                  />
                  <div className="exercisedetail__sketch__edit__actions">
                    <button
                      className="btn__wired"
                      onClick={handleEditSketchCancel}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn__primary"
                      onClick={handleSaveSketch}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save sketch"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="exercisedetail__sketch">
                    {exercise.sketch ? (
                      <SketchThumbnail sketch={exercise.sketch} />
                    ) : (
                      <div className="exercisedetail__sketch__empty">
                        <p>No sketch yet.</p>
                      </div>
                    )}
                  </div>
                  <button
                    className="exercisedetail__btn exercisedetail__btn--sketch"
                    onClick={handleEditSketchStart}
                  >
                    <svg width="16" height="18" viewBox="0 0 18 24" fill="none">
                      <path
                        d="M16.8756 21.5929H1.12977C0.831474 21.5929 0.545402 21.7198 0.334478 21.9454C0.123556 22.1711 0.00506036 22.4772 0.00506036 22.7964C0.00506036 23.1156 0.123556 23.4217 0.334478 23.6474C0.545402 23.873 0.831474 23.9999 1.12977 23.9999H16.8756C17.1739 23.9999 17.46 23.873 17.671 23.6474C17.8818 23.4217 18.0004 23.1156 18.0004 22.7964C18.0004 22.4772 17.8818 22.1711 17.671 21.9454C17.46 21.7198 17.1739 21.5929 16.8756 21.5929Z"
                        fill="currentColor"
                      />
                      <path
                        d="M1.12943 19.1861H1.23066L5.92067 18.7288C6.43444 18.674 6.91495 18.4318 7.28156 18.0428L17.404 7.21152C17.7968 6.76739 18.0091 6.17473 17.9944 5.5634C17.9796 4.95206 17.739 4.37192 17.3251 3.9501L14.2435 0.652573C13.8413 0.248321 13.3142 0.0163667 12.7626 0.000833716C12.211 -0.0146993 11.6733 0.187273 11.2518 0.568331L1.12943 11.3996C0.765888 11.7919 0.53953 12.3061 0.48835 12.8558L0.00472708 17.8744C-0.0104239 18.0505 0.0109516 18.2282 0.0673295 18.3947C0.123707 18.5611 0.2137 18.7122 0.330892 18.8371C0.435984 18.9486 0.56062 19.0369 0.69765 19.0968C0.834682 19.1567 0.981413 19.187 1.12943 19.1861ZM12.6802 2.33744L15.7506 5.62292L13.5012 7.9697L10.487 4.74439L12.6802 2.33744ZM2.67028 13.0604L9.00236 6.33298L12.0391 9.58236L5.74072 16.3218L2.3666 16.6588L2.67028 13.0604Z"
                        fill="currentColor"
                      />
                    </svg>
                    {exercise.sketch ? "Edit sketch" : "Create sketch"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete dialog */}
      {deleteConfirm && (
        <div
          className="dialog__overlay"
          onClick={() => !deleting && setDeleteConfirm(false)}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog__title">Delete exercise?</h3>
            <p className="dialog__body">
              <strong>{exercise.title}</strong> will be permanently deleted.
              This cannot be undone.
            </p>
            <div className="dialog__actions">
              <button
                className="btn__wired"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn__danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExerciseDetail;
