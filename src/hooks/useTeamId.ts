import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import db from "../firebase";

// undefined = still loading, null = user has no team, string = resolved teamId
export function useTeamId(): string | null | undefined {
  const [teamId, setTeamId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) { setTeamId(null); return; }
    getDoc(doc(db, "users", uid))
      .then((snap) => setTeamId(snap.exists() ? (snap.data().team ?? null) : null))
      .catch(() => setTeamId(null));
  }, []);

  return teamId;
}
