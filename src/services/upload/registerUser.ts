import db from "../../firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";

export interface SharedTrainingRef {
  trainingId: string;
  ownerId: string;
  sharedBy: string;
  sharedAt: any;
}

export interface UserProfile {
  uid: string;
  userName: string;
  email: string;
  phone: string;
  profileImageUrl: string | null;
  favoriteExercises: string[];
  favoriteTrainings: string[];
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  role: "coach" | "player" | "admin";
  team: string | null;
  bio: string | null;
  mobileMode?: "advanced" | "simple";
  planningDirection?: "forward" | "backward";
  notificationScope?: "all" | "team";
  tourCompleted?: boolean;
  sharedWithMe?: SharedTrainingRef[];
  // Defaults to true when absent — new trainings are auto-shared with the user's team.
  automaticSharing?: boolean;
}

export const registerUser = async (
  uid: string,
  userName: string,
  email: string,
  phone: string,
) => {
  const userProfile: UserProfile = {
    uid,
    userName,
    email,
    phone,
    profileImageUrl: null,
    favoriteExercises: [],
    favoriteTrainings: [],
    createdAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    role: "coach",
    team: null,
    bio: null,
  };

  await setDoc(doc(db, "users", uid), userProfile);
};
