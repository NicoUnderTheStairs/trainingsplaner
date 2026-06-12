import db, { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { registerUser } from "../services/upload/registerUser";

// ─── Phone allowlist ──────────────────────────────────────────────────────────
// Each allowed phone is stored as its own document:
//   config/allowedPhones/entries/{+41796167040}
// Firestore rule: allow get: if true  (existence check only, no list)
// Fallback to hardcoded list when Firestore is unreachable.
const FALLBACK_PHONES: string[] = [
  "+41796167045",
  "+41767256001",
  "+41762397502",
  "+41786739011",
];

export const isPhoneAllowed = async (phone: string): Promise<boolean> => {
  const normalized = phone.replace(/\s/g, "");
  try {
    const snap = await getDoc(doc(db, "config", "allowedPhones", "entries", normalized));
    if (snap.exists()) return true;
    // Document missing means not on the list (don't fall through to hardcoded).
    // Only fall through on a permissions/network error.
    return false;
  } catch {
    return FALLBACK_PHONES.includes(normalized);
  }
};

// ─── Phone uniqueness check ─────────────────────────────────────────────────────

export const isPhoneInUse = async (phone: string): Promise<boolean> => {
  const normalized = phone.replace(/\s/g, "");
  const q = query(collection(db, "users"), where("phone", "==", normalized));
  const snap = await getDocs(q);
  return !snap.empty;
};

// ─── Create user ──────────────────────────────────────────────────────────────

export const doCreateUserWithEmailAndPassword = async (
  userName: string,
  email: string,
  password: string,
  phone: string,
) => {
  const normalized = phone.replace(/\s/g, "");

  // Step 1: allowlist check — unauthenticated, uses allow get: if true rule
  if (!(await isPhoneAllowed(normalized))) {
    throw new Error("PHONE_NOT_ALLOWED");
  }

  // Step 2: create the Firebase Auth user — now the session is authenticated
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  // Step 3: phone uniqueness check — runs authenticated, so Firestore rules pass
  try {
    if (await isPhoneInUse(normalized)) {
      await userCredential.user.delete();
      throw new Error("PHONE_ALREADY_IN_USE");
    }
    await registerUser(userCredential.user.uid, userName, email, normalized);
  } catch (err) {
    // If anything after auth creation fails, roll back the auth user
    if (!(err instanceof Error && err.message === "PHONE_ALREADY_IN_USE")) {
      await userCredential.user.delete().catch(() => {});
    }
    throw err;
  }

  return userCredential;
};

// ─── Sign in ──────────────────────────────────────────────────────────────────

export const doSignInWithEmailAndPassword = async (
  email: string,
  password: string,
) => {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password,
  );
  return userCredential;
};

// ─── Sign out ─────────────────────────────────────────────────────────────────

export const doSignOut = async () => {
  await signOut(auth);
};

// ─── Password reset ───────────────────────────────────────────────────────────

export const sendResetPasswordEmail = async (email: string) => {
  await sendPasswordResetEmail(auth, email);
};
