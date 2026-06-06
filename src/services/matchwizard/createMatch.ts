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

export async function createMatch(payload: CreateMatchPayload): Promise<string> {
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  if (!userId) throw new Error("User must be logged in to create a match.");

  const { teamId } = payload;

  // Save only new players to the shared team roster
  const newPlayers = payload.lineup.filter((p) => p._new);
  for (const player of newPlayers) {
    await addDoc(collection(db, "teams", teamId, "players"), {
      playerNumber: player.playerNumber,
      playerName: player.playerName,
      playerPosition: player.playerPosition,
    });
  }

  // Strip internal flags before saving the match document
  const lineup = payload.lineup.map(({ _new: _, ...p }) => p);

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
