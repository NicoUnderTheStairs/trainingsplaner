import { getAuth } from "firebase/auth";
import { useGetUserData } from "./useGetUserData";

/** Replaces path-unsafe characters so team names can be used as folder/Firestore IDs. */
export function sanitizeTeamId(name: string): string {
  return name.replace(/\//g, "-");
}

// undefined = still loading, null = user has no team, string = resolved teamId
export function useTeamId(): string | null | undefined {
  const uid = getAuth().currentUser?.uid ?? "";
  const userData = useGetUserData(uid);

  if (!uid) return null;
  if (userData === null) return undefined; // still loading
  const team = userData.team;
  return team ? sanitizeTeamId(team) : null;
}
