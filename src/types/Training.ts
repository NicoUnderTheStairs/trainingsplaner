import type { SelectedExercise } from "../ui/components/trainingwizard/exerciseSelection";
import type { Players } from "../ui/components/trainingwizard/playerSelection";

export interface Training {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
  author: string;
  date: string;
  duration: number;
  exercises: SelectedExercise[];
  players?: Players; // optional — older trainings won't have this
}
