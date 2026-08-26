import db from "../../firebase";
import { addDoc, collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { SelectedExercise } from "../../ui/components/trainingwizard/exerciseSelection";
import type { Players } from "../../ui/components/trainingwizard/playerSelection";
import { shareTrainingWithUsers } from "../sharing/shareTraining";

interface CreateTrainingPayload {
  date: Date;
  author: string;
  title: string;
  description: string;
  difficulty: number;
  duration: number;
  tags: string[];
  selectedExercises: SelectedExercise[];
  players: Players;
  team?: string | null;
  automaticSharing?: boolean;
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
    players,
  } = payload;

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
      exercises: selectedExercises.map((e) => ({
        exerciseId: e.exerciseId,
        title: e.title,
        duration: e.duration,
      })),
      players,
      createdAt: Timestamp.now(),
    },
  );

  // Auto-share with the rest of the team, unless the user opted out
  if (payload.automaticSharing && payload.team) {
    try {
      const teamSnap = await getDocs(
        query(collection(db, "users"), where("team", "==", payload.team)),
      );
      const recipientIds = teamSnap.docs
        .map((d) => d.id)
        .filter((id) => id !== userId);

      await shareTrainingWithUsers({
        trainingId: trainingRef.id,
        ownerId: userId,
        title,
        senderName: author,
        recipientIds,
      });
    } catch (e) {
      console.warn("Auto-share with team failed:", e);
    }
  }

  return trainingRef.id;
}
