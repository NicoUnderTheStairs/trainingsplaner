import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import db from "../../firebase";
import { notifyTrainingShared } from "../notifications/notifications";
import type { SharedTrainingRef } from "../upload/registerUser";

interface ShareTrainingParams {
  trainingId: string;
  ownerId: string;
  title: string;
  senderName: string;
  recipientIds: string[];
}

// Shared by the manual "Share" dialog and by automatic sharing on training
// creation, so both write the same sharedWithMe / sharedWith / notification shape.
export async function shareTrainingWithUsers({
  trainingId,
  ownerId,
  title,
  senderName,
  recipientIds,
}: ShareTrainingParams): Promise<void> {
  if (recipientIds.length === 0) return;
  const sharedAt = new Date();

  await Promise.all(
    recipientIds.map((recipientId) => {
      const ref: SharedTrainingRef = {
        trainingId,
        ownerId,
        sharedBy: ownerId,
        sharedAt,
      };
      return updateDoc(doc(db, "users", recipientId), {
        sharedWithMe: arrayUnion(ref),
      });
    }),
  );

  await updateDoc(doc(db, "users", ownerId, "trainings", trainingId), {
    sharedWith: arrayUnion(...recipientIds),
  });

  try {
    await Promise.all(
      recipientIds.map((recipientId) =>
        notifyTrainingShared(
          recipientId,
          ownerId,
          trainingId,
          title,
          senderName,
          ownerId,
        ),
      ),
    );
  } catch (notifError) {
    console.warn("Could not send share notifications:", notifError);
  }
}
