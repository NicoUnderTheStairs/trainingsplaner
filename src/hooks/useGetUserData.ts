import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import db from "../firebase";
import type { UserProfile } from "../services/upload/registerUser";

export function useGetUserData(uid: string): UserProfile | null {
  const [userData, setUserData] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Don't fetch if uid hasn't resolved yet
    if (!uid) return;

    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          // @ts-ignore
          setUserData({ id: snap.id, ...snap.data() } as UserProfile);
        } else {
          console.warn(`No user document found for uid: ${uid}`);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchUser();
  }, [uid]); // re-runs once auth resolves and uid becomes available

  return userData;
}
