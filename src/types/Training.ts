import type { SelectedExercise } from "../ui/components/trainingwizard/exerciseSelection";
 
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
}