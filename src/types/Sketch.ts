export type PlayerType = "attacker" | "defender" | "setter" | "libero";

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

export interface SketchData {
  players: Record<string, Omit<Player, "id">>;
  arrows: Record<string, Omit<Arrow, "id">>;
}
