import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import db from "../../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExerciseVariantGroup {
  id: string;            // doc ID in ExerciseVariants collection
  exerciseIds: string[]; // all exercise IDs in this group
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Find the variant group that contains a given exercise ID, if any.
 */
export const findVariantGroup = async (
  exerciseId: string,
): Promise<ExerciseVariantGroup | null> => {
  const q = query(
    collection(db, "ExerciseVariants"),
    where("exerciseIds", "array-contains", exerciseId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ExerciseVariantGroup;
};

/**
 * Link two exercises as variants:
 * - If `existingExerciseId` already belongs to a group → add `newExerciseId` to that group
 *   and write variantGroupId onto the new exercise doc.
 * - If neither belongs to a group → create a new group with both IDs.
 * - Also writes `variantGroupId` onto both exercise docs for fast lookup.
 */
export const linkVariants = async (
  newExerciseId: string,
  existingExerciseId: string,
): Promise<string> => {
  // 1. Look for an existing group containing the chosen parent exercise
  const existingGroup = await findVariantGroup(existingExerciseId);

  if (existingGroup) {
    // Add the new exercise to the existing group
    await updateDoc(doc(db, "ExerciseVariants", existingGroup.id), {
      exerciseIds: arrayUnion(newExerciseId),
      updatedAt: new Date(),
    });

    // Stamp variantGroupId onto the new exercise doc
    await updateDoc(doc(db, "Excercises", newExerciseId), {
      variantGroupId: existingGroup.id,
    });

    return existingGroup.id;
  } else {
    // Create a brand new variant group with both exercises
    const groupId = uid();
    const groupRef = doc(db, "ExerciseVariants", groupId);

    await setDoc(groupRef, {
      exerciseIds: [existingExerciseId, newExerciseId],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Stamp variantGroupId onto both exercise docs
    await Promise.all([
      updateDoc(doc(db, "Excercises", existingExerciseId), {
        variantGroupId: groupId,
      }),
      updateDoc(doc(db, "Excercises", newExerciseId), {
        variantGroupId: groupId,
      }),
    ]);

    return groupId;
  }
};

/**
 * Fetch all exercises in the same variant group as the given exercise.
 * Returns an empty array if the exercise has no variant group.
 */
export const fetchVariants = async (
  exerciseId: string,
): Promise<{ id: string; title: string; difficulty: number; tags: string[] }[]> => {
  const group = await findVariantGroup(exerciseId);
  if (!group) return [];

  const siblings = group.exerciseIds.filter((id) => id !== exerciseId);
  const results = await Promise.all(
    siblings.map(async (id) => {
      const snap = await getDoc(doc(db, "Excercises", id));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        id,
        title: data.title ?? "Untitled",
        difficulty: data.difficulty ?? 1,
        tags: data.tags ?? [],
      };
    }),
  );

  return results.filter(Boolean) as {
    id: string;
    title: string;
    difficulty: number;
    tags: string[];
  }[];
};

/**
 * Remove an exercise from its variant group when it is deleted.
 *
 * - If the group will still have ≥ 2 members after removal → pull the ID out
 *   with arrayRemove and clear variantGroupId on the deleted exercise is a no-op
 *   (doc is being deleted anyway).
 * - If the group drops to exactly 1 member → delete the group doc entirely and
 *   clear variantGroupId on the sole remaining exercise (it's no longer a variant).
 * - If the group is somehow empty after removal → delete the group doc.
 */
export const removeFromVariantGroup = async (
  exerciseId: string,
): Promise<void> => {
  const group = await findVariantGroup(exerciseId);
  if (!group) return; // exercise wasn't in any group — nothing to do

  const remaining = group.exerciseIds.filter((id) => id !== exerciseId);

  if (remaining.length >= 2) {
    // Group still valid — just remove this exercise from the array
    await updateDoc(doc(db, "ExerciseVariants", group.id), {
      exerciseIds: arrayRemove(exerciseId),
      updatedAt: new Date(),
    });
  } else if (remaining.length === 1) {
    // Only one exercise left — group no longer makes sense, delete it
    // and clear the variantGroupId on the last remaining exercise
    await Promise.all([
      deleteDoc(doc(db, "ExerciseVariants", group.id)),
      updateDoc(doc(db, "Excercises", remaining[0]), {
        variantGroupId: null,
      }),
    ]);
  } else {
    // Group is now empty — just delete the group doc
    await deleteDoc(doc(db, "ExerciseVariants", group.id));
  }
};