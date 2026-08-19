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
  isRueckrunde: boolean;
  lineup: LineupPlayer[];
}

// Save new players (added via the wizard, not picked from the roster) to the shared team roster,
// and stamp their new roster doc id onto the lineup entry so future roster edits can find them again.
export async function saveNewLineupPlayers(teamId: string, lineup: LineupPlayer[]): Promise<LineupPlayer[]> {
  const result: LineupPlayer[] = [];
  for (const player of lineup) {
    if (!player._new) {
      result.push(player);
      continue;
    }
    const docRef = await addDoc(collection(db, "teams", teamId, "players"), {
      playerNumber: player.playerNumber,
      playerName: player.playerName,
      playerPosition: player.playerPosition,
    });
    result.push({ ...player, rosterId: docRef.id });
  }
  return result;
}

// Strip internal wizard-only flags before saving to the match document
export function toLineup(lineup: LineupPlayer[]): Player[] {
  return lineup.map((p) => {
    const player: Player = {
      playerNumber: p.playerNumber,
      playerName: p.playerName,
      playerPosition: p.playerPosition,
    };
    if (p.rosterId) player.rosterId = p.rosterId;
    return player;
  });
}

export async function createMatch(payload: CreateMatchPayload): Promise<string> {
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  if (!userId) throw new Error("User must be logged in to create a match.");

  const { teamId } = payload;

  const lineupWithIds = await saveNewLineupPlayers(teamId, payload.lineup);

  const lineup = toLineup(lineupWithIds);

  const matchRef = await addDoc(collection(db, "teams", teamId, "matches"), {
    opponent: payload.opponent,
    date: Timestamp.fromDate(payload.date),
    noteOnOpponent: payload.noteOnOpponent,
    strategy: payload.strategy,
    isHomeGame: payload.isHomeGame,
    isRueckrunde: payload.isRueckrunde,
    lineup,
    createdAt: Timestamp.now(),
    createdBy: userId,
  });

  return matchRef.id;
}
