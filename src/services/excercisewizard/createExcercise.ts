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
}

export async function createExcercise(
  payload: CreateExcercisePayload,
): Promise<string> {
  const { date, author, title, description, difficulty, tags, sketch } =
    payload;

  const newExcerciseRef = await addDoc(collection(db, "Excercises"), {
    date: Timestamp.fromDate(date), // Firestore Timestamp instead of raw Date
    author,
    title,
    description,
    difficulty,
    tags,
    sketch: {
      players: sketch?.players ?? {},
      arrows: sketch?.arrows ?? {},
    },
    createdAt: Timestamp.now(),
  });

  return newExcerciseRef.id;
}
