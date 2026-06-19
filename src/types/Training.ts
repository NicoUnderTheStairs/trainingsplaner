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
  players?: Players;
  sharedWith?: string[]; // UIDs of users this training was shared with
  rating?: number; // 1–5 post-training star rating by the owner
  ratingReminderSent?: boolean; // set by the server-side rating-reminder cron job
}
