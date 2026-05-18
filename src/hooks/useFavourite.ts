import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import db from "../firebase";

/**
 * Manages a single exercise favourite for the current user.
 * Favourite docs live at: users/{uid}/favouriteExercises/{exerciseId}
 *
 * Returns:
 *   isFavourite  — whether the exercise is currently favourited
 *   toggleFavourite — async function to add or remove the favourite
 *   loading      — true while the initial check is in flight
 */
export const useFavourite = (exerciseId: string | undefined) => {
  const [isFavourite, setIsFavourite] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState(false);

  const uid = getAuth().currentUser?.uid;

  // ── Check favourite status on mount ────────────────────────────────────────
  useEffect(() => {
    if (!uid || !exerciseId) { setLoading(false); return; }

    const check = async () => {
      try {
        const snap = await getDoc(
          doc(db, "users", uid, "favouriteExercises", exerciseId),
        );
        setIsFavourite(snap.exists());
      } catch (e) {
        console.error("Error checking favourite:", e);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [uid, exerciseId]);

  // ── Toggle ──────────────────────────────────────────────────────────────────
  const toggleFavourite = async () => {
    if (!uid || !exerciseId || toggling) return;
    setToggling(true);

    // Optimistic update
    const wasF = isFavourite;
    setIsFavourite(!wasF);

    try {
      const ref = doc(db, "users", uid, "favouriteExercises", exerciseId);
      if (wasF) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { exerciseId, addedAt: new Date() });
      }
    } catch (e) {
      // Roll back on error
      console.error("Error toggling favourite:", e);
      setIsFavourite(wasF);
    } finally {
      setToggling(false);
    }
  };

  return { isFavourite, toggleFavourite, loading, toggling };
};