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
// Fallback list used when the Firestore config doc doesn't exist yet.
const FALLBACK_PHONE_NUMBERS: string[] = [
  "+41796167045",
  "+41767256001",
  "+41762397502",
  "+41786739011",
];

export const isPhoneAllowed = async (phone: string): Promise<boolean> => {
  const normalized = phone.replace(/\s/g, "");
  try {
    const snap = await getDoc(doc(db, "config", "allowedPhones"));
    if (snap.exists()) {
      const phones = (snap.data().phones as string[]) ?? [];
      return phones.includes(normalized);
    }
  } catch {
    // fall through to hardcoded list
  }
  return FALLBACK_PHONE_NUMBERS.includes(normalized);
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

  if (!(await isPhoneAllowed(normalized))) {
    throw new Error("PHONE_NOT_ALLOWED");
  }

  // Reject if a user already registered with this phone number
  if (await isPhoneInUse(normalized)) {
    throw new Error("PHONE_ALREADY_IN_USE");
  }

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  await registerUser(userCredential.user.uid, userName, email, normalized);

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
