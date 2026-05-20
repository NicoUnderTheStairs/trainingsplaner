import db from "../../firebase";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import type { SketchData } from "../../types/Sketch";
import { getAuth } from "firebase/auth";

interface CreateExcercisePayload {
  date: Date;
  author: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
  sketch: SketchData;
  team: string; // the creator's team — stored as array for multi-team support
}

export async function createExcercise(
  payload: CreateExcercisePayload,
): Promise<string> {
  const { date, author, title, description, difficulty, tags, sketch, team } =
    payload;

  const ref = await addDoc(collection(db, "Excercises"), {
    date:        Timestamp.fromDate(date),
    author,
    title,
    description,
    createdBy: getAuth().currentUser?.uid ?? "",
    difficulty,
    tags,
    team: [team], // store as array — consistent with copies added via shop
    sketch: {
      players: sketch?.players ?? {},
      arrows:  sketch?.arrows  ?? {},
      objects: (sketch as any)?.objects ?? {},
    },
    createdAt: Timestamp.now(),
  });

  return ref.id;
}