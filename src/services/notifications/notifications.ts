import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import db from "../../firebase";

// ─── Push relay ───────────────────────────────────────────────────────────────

const PUSH_RELAY_URL = import.meta.env.VITE_PUSH_RELAY_URL as string | undefined;
const PUSH_SECRET    = import.meta.env.VITE_PUSH_SECRET    as string | undefined;

const sendPushToUser = async (
  recipientUserId: string,
  title: string,
  body: string,
  link?: string,
): Promise<void> => {
  if (!PUSH_RELAY_URL || !PUSH_SECRET) return;
  try {
    const userSnap = await getDoc(doc(db, "users", recipientUserId));
    const token = userSnap.data()?.fcmToken as string | undefined;
    if (!token) return;

    await fetch(PUSH_RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Push-Secret": PUSH_SECRET,
      },
      body: JSON.stringify({ token, title, body, link: link ?? "/" }),
    });
  } catch {
    // Push is best-effort — never break the in-app notification flow
  }
};

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

export const deleteNotification = async (
  uid: string,
  notificationId: string
) => {
  const ref = doc(db, "notifications", uid, "items", notificationId);
  await deleteDoc(ref);
};

export const sendNotification = async (
  recipientUserId: string,
  payload: Omit<AppNotification, "id" | "read" | "createdAt">,
): Promise<void> => {
  await addDoc(collection(db, "notifications", recipientUserId, "items"), {
    ...payload,
    read: false,
    createdAt: Timestamp.now(),
  });
  // Fire-and-forget push — does nothing if relay URL not configured
  sendPushToUser(recipientUserId, payload.title, payload.body, payload.link);
};

export const notifyTrainingShared = async (
  recipientUserId: string,
  ownerId: string,
  trainingId: string,
  trainingTitle: string,
  senderName: string,
  senderUserId: string,
): Promise<void> => {
  await sendNotification(recipientUserId, {
    type: "training_shared",
    title: "New training shared with you",
    body: `${senderName} shared "${trainingTitle}" with you.`,
    link: `/training-detail/${ownerId}/${trainingId}`,
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