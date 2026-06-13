import { getAuth } from "firebase/auth";
import { useGetUserData } from "./useGetUserData";

// undefined = still loading, null = user has no team, string = resolved teamId
export function useTeamId(): string | null | undefined {
  const uid = getAuth().currentUser?.uid ?? "";
  const userData = useGetUserData(uid);

  if (!uid) return null;
  if (userData === null) return undefined; // still loading
  return userData.team ?? null;
}
