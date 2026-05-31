import db from "../../firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  userName: string;
  email: string;
  phone: string;
  profileImageUrl: string | null;
  favoriteExercises: string[]; // array of exercise IDs
  favoriteTrainings: string[]; // array of training IDs
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  role: "coach" | "player" | "admin";
  team: string | null; // optional team name
  bio: string | null;
  mobileMode?: "advanced" | "simple";
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
