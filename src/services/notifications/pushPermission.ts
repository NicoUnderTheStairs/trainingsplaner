import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import db, { messagingPromise } from "../../firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/** Request push permission and store the FCM token in Firestore. */
export const registerPushToken = async (uid: string): Promise<"granted" | "denied" | "unsupported"> => {
  const messaging = await messagingPromise;
  if (!messaging) return "unsupported";

  if (typeof Notification === "undefined") return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.register("/firebase-messaging-sw.js"),
    });
    await setDoc(doc(db, "users", uid), { fcmToken: token }, { merge: true });
    return "granted";
  } catch (err) {
    console.error("FCM token registration failed:", err);
    return "denied";
  }
};

/** Remove the FCM token from Firestore (e.g. on logout). */
export const unregisterPushToken = async (uid: string): Promise<void> => {
  await setDoc(doc(db, "users", uid), { fcmToken: null }, { merge: true });
};

/** Handle foreground messages (tab is open). Returns unsubscribe fn. */
export const onForegroundMessage = async (
  callback: (title: string, body: string, link?: string) => void,
): Promise<() => void> => {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? "Notification";
    const body = payload.notification?.body ?? payload.data?.body ?? "";
    const link = payload.data?.link;
    callback(title, body, link);
  });
};
