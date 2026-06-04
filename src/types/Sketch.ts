// ─── Sketch types ─────────────────────────────────────────────────────────────
// Shared types for sketch editor, sketch creation wizard, and sketch thumbnails.

export type PlayerType =
  | "outside"
  | "opposite"
  | "middleBlocker"
  | "setter"
  | "libero"
  | "coach";
export type ObjectType = "pylon" | "bench" | "matt" | "ball";

export interface Player {
  id: string;
  x: number;
  y: number;
  type: PlayerType;
  label: string;
}

export interface Arrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: "solid" | "dashed";
}

export interface SketchObject {
  id: string;
  x: number;
  y: number;
  type: ObjectType;
}

export interface SketchData {
  players: Record<string, Omit<Player, "id">>;
  arrows: Record<string, Omit<Arrow, "id">>;
  objects?: Record<string, Omit<SketchObject, "id">>;
}
