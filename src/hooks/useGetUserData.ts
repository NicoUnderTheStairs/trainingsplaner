import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import db from "../firebase";
import type { UserProfile } from "../services/upload/registerUser";

const STORAGE_PREFIX = "uprofile_";

function readStored(uid: string): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + uid);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function writeStored(uid: string, profile: UserProfile) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(profile));
  } catch {}
}

function removeStored(uid: string) {
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + uid);
  } catch {}
}

const cache = new Map<string, UserProfile>();

export function invalidateUserCache(uid: string) {
  cache.delete(uid);
  removeStored(uid);
}

export function updateUserCache(uid: string, data: Partial<UserProfile>) {
  const existing = cache.get(uid);
  if (existing) {
    const updated = { ...existing, ...data };
    cache.set(uid, updated);
    writeStored(uid, updated);
  }
}

export function useGetUserData(uid: string): UserProfile | null {
  const [userData, setUserData] = useState<UserProfile | null>(() => {
    if (!uid) return null;
    return cache.get(uid) ?? readStored(uid) ?? null;
  });

  useEffect(() => {
    if (!uid) return;

    const cached = cache.get(uid) ?? readStored(uid) ?? null;
    if (cached) {
      if (!cache.has(uid)) cache.set(uid, cached);
      setUserData(cached);
    }

    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (snap.exists()) {
          const profile = {
            id: snap.id,
            ...snap.data(),
          } as unknown as UserProfile;
          cache.set(uid, profile);
          writeStored(uid, profile);
          setUserData(profile);
        }
      },
      (err) => {
        console.error("[useGetUserData] snapshot error:", err);
      },
    );

    return () => unsub();
  }, [uid]);

  return userData;
}
