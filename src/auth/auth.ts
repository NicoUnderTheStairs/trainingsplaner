import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { registerUser } from "../services/upload/registerUser";

// ─── Phone allowlist ──────────────────────────────────────────────────────────
// Add phone numbers in E.164 format (e.g. +41791234567)
// Only users whose phone number is in this list can register.
const ALLOWED_PHONE_NUMBERS: string[] = [
  "+41796167045",
  "+41767256001",
  "+41762397502",
  "+41786739011",
  // add more numbers here
];

export const isPhoneAllowed = (phone: string): boolean => {
  const normalized = phone.replace(/\s/g, ""); // strip spaces
  return ALLOWED_PHONE_NUMBERS.includes(normalized);
};

// ─── Create user ──────────────────────────────────────────────────────────────

export const doCreateUserWithEmailAndPassword = async (
  userName: string,
  email: string,
  password: string,
  phone: string,
) => {
  if (!isPhoneAllowed(phone)) {
    throw new Error("PHONE_NOT_ALLOWED");
  }

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  await registerUser(userCredential.user.uid, userName, email, phone);

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
