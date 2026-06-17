import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import db from "../../firebase";

const NON_CRITICAL = [
  /invalid dom property/i,
  /did you mean/i,
  /react does not recognize/i,
  /unknown event handler property/i,
  /each child in a list should have a unique/i,
  /warning: /i,
];

export function isCriticalError(message: string): boolean {
  return !NON_CRITICAL.some((p) => p.test(message));
}

export async function logErrorToFirestore(
  message: string,
  stack?: string,
): Promise<void> {
  if (!isCriticalError(message)) return;
  try {
    const uid = getAuth().currentUser?.uid ?? null;
    await addDoc(collection(db, "config", "errorlog", "entries"), {
      message: message.slice(0, 500),
      stack: stack ? stack.slice(0, 2000) : null,
      url: window.location.href,
      uid,
      userAgent: navigator.userAgent.slice(0, 200),
      timestamp: serverTimestamp(),
    });
  } catch {
    // never throw from error logger
  }
}

export interface ErrorLogEntry {
  id: string;
  message: string;
  stack: string | null;
  url: string;
  uid: string | null;
  userAgent: string;
  timestamp: Date | null;
}

export async function fetchErrorLog(): Promise<ErrorLogEntry[]> {
  const snap = await getDocs(collection(db, "config", "errorlog", "entries"));
  const entries = snap.docs.map((d) => ({
    id: d.id,
    message: d.data().message ?? "",
    stack: d.data().stack ?? null,
    url: d.data().url ?? "",
    uid: d.data().uid ?? null,
    userAgent: d.data().userAgent ?? "",
    timestamp: d.data().timestamp?.toDate() ?? null,
  }));
  return entries.sort(
    (a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0),
  );
}

export async function clearErrorLog(entries: ErrorLogEntry[]): Promise<void> {
  await Promise.all(
    entries.map((e) =>
      deleteDoc(doc(db, "config", "errorlog", "entries", e.id)),
    ),
  );
}
