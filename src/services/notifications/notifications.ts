import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import db from "../../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "training_shared"
  | "exercise_created";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: any;
  fromUserId?: string;
  fromUserName?: string;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export const sendNotification = async (
  recipientUserId: string,
  payload: Omit<AppNotification, "id" | "read" | "createdAt">,
): Promise<void> => {
  await addDoc(collection(db, "notifications", recipientUserId, "items"), {
    ...payload,
    read: false,
    createdAt: Timestamp.now(),
  });
};

/** Call after writing a shared training copy to the recipient's subcollection */
export const notifyTrainingShared = async (
  recipientUserId: string,
  trainingId: string,
  trainingTitle: string,
  senderName: string,
  senderUserId: string,
): Promise<void> => {
  await sendNotification(recipientUserId, {
    type: "training_shared",
    title: "New training shared with you",
    body: `${senderName} shared "${trainingTitle}" with you.`,
    link: `/training-detail/${trainingId}`,
    fromUserId: senderUserId,
    fromUserName: senderName,
  });
};

/** Broadcast a new-exercise notification to all users except the creator */
export const notifyExerciseCreated = async (
  recipientUserIds: string[],
  exerciseId: string,
  exerciseTitle: string,
  creatorName: string,
  creatorUserId: string,
): Promise<void> => {
  await Promise.all(
    recipientUserIds.map((uid) =>
      sendNotification(uid, {
        type: "exercise_created",
        title: "New exercise added",
        body: `${creatorName} created "${exerciseTitle}".`,
        link: `/exercise-detail/${exerciseId}`,
        fromUserId: creatorUserId,
        fromUserName: creatorName,
      }),
    ),
  );
};

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** Real-time subscription — returns unsubscribe fn */
export const subscribeToNotifications = (
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void,
): (() => void) => {
  const q = query(
    collection(db, "notifications", userId, "items"),
    orderBy("createdAt", "desc"),
    limit(20),
  );
  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification));
  });
};

export const markNotificationRead = async (
  userId: string,
  notificationId: string,
): Promise<void> => {
  await updateDoc(
    doc(db, "notifications", userId, "items", notificationId),
    { read: true },
  );
};

export const markAllNotificationsRead = async (
  userId: string,
  notificationIds: string[],
): Promise<void> => {
  if (notificationIds.length === 0) return;
  const batch = writeBatch(db);
  notificationIds.forEach((id) => {
    batch.update(doc(db, "notifications", userId, "items", id), { read: true });
  });
  await batch.commit();
};