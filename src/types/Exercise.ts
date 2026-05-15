import type { SketchData } from "./Sketch";

export interface Exercise {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
  author: string;
  date: string;
  sketch: SketchData;
}
