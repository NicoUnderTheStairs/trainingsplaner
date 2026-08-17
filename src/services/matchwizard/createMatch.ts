import db from "../../firebase";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { Player } from "../../types/Match";

export interface LineupPlayer extends Player {
  _new?: boolean; // not yet in the teams roster
}

interface CreateMatchPayload {
  teamId: string;
  opponent: string;
  date: Date;
  noteOnOpponent: string;
  strategy: string;
  isHomeGame: boolean;
  lineup: LineupPlayer[];
}

// Save only new players (added via the wizard, not picked from the roster) to the shared team roster
export async function saveNewLineupPlayers(teamId: string, lineup: LineupPlayer[]): Promise<void> {
  const newPlayers = lineup.filter((p) => p._new);
  for (const player of newPlayers) {
    await addDoc(collection(db, "teams", teamId, "players"), {
      playerNumber: player.playerNumber,
      playerName: player.playerName,
      playerPosition: player.playerPosition,
    });
  }
}

// Strip internal wizard-only flags before saving to the match document
export function toLineup(lineup: LineupPlayer[]): Player[] {
  return lineup.map((p) => ({
    playerNumber: p.playerNumber,
    playerName: p.playerName,
    playerPosition: p.playerPosition,
  }));
}

export async function createMatch(payload: CreateMatchPayload): Promise<string> {
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  if (!userId) throw new Error("User must be logged in to create a match.");

  const { teamId } = payload;

  await saveNewLineupPlayers(teamId, payload.lineup);

  const lineup = toLineup(payload.lineup);

  const matchRef = await addDoc(collection(db, "teams", teamId, "matches"), {
    opponent: payload.opponent,
    date: Timestamp.fromDate(payload.date),
    noteOnOpponent: payload.noteOnOpponent,
    strategy: payload.strategy,
    isHomeGame: payload.isHomeGame,
    lineup,
    createdAt: Timestamp.now(),
    createdBy: userId,
  });

  return matchRef.id;
}
