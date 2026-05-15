import db from "../../firebase";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { SelectedExercise } from "../../ui/components/trainingwizard/exerciseSelection";

interface CreateTrainingPayload {
  date: Date;
  author: string;
  title: string;
  description: string;
  difficulty: number;
  duration: number;
  tags: string[];
  selectedExercises: SelectedExercise[];
}

export async function createTraining(
  payload: CreateTrainingPayload,
): Promise<string> {
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  if (!userId) {
    throw new Error("User must be logged in to create a training.");
  }

  const {
    date,
    author,
    title,
    description,
    difficulty,
    duration,
    tags,
    selectedExercises,
  } = payload;

  // Store under users/{userId}/trainings/{trainingId}
  const trainingRef = await addDoc(
    collection(db, "users", userId, "trainings"),
    {
      date: Timestamp.fromDate(date),
      author,
      title,
      description,
      difficulty,
      duration,
      tags,
      // Store as array for ordered access — each item has exerciseId, title, duration
      exercises: selectedExercises.map((e) => ({
        exerciseId: e.exerciseId,
        title: e.title,
        duration: e.duration,
      })),
      createdAt: Timestamp.now(),
    },
  );

  return trainingRef.id;
}
