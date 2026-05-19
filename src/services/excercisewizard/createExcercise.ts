import db from "../../firebase";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import type { SketchData } from "../../types/Sketch";

interface CreateExcercisePayload {
  date: Date;
  author: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
  sketch: SketchData;
  team: string; // the creator's team — used to scope visibility
}

export async function createExcercise(
  payload: CreateExcercisePayload,
): Promise<string> {
  const { date, author, title, description, difficulty, tags, sketch, team } =
    payload;

  const ref = await addDoc(collection(db, "Excercises"), {
    date: Timestamp.fromDate(date),
    author,
    title,
    description,
    difficulty,
    tags,
    team, // stamped on every exercise doc
    sketch: {
      players: sketch?.players ?? {},
      arrows: sketch?.arrows ?? {},
      objects: (sketch as any)?.objects ?? {},
    },
    createdAt: Timestamp.now(),
  });

  return ref.id;
}
