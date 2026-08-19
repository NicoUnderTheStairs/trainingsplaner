import type { Timestamp } from "firebase/firestore";

export interface Player {
  playerNumber: number;
  playerName: string;
  playerPosition: string;
  // Links this snapshot back to its team-roster doc (teams/{teamId}/players/{rosterId}),
  // so a roster edit can offer to cascade the correction into matches that used this player.
  // Absent on matches created before this field existed.
  rosterId?: string;
}

export interface Match {
  id?: string;
  opponent: string;
  date: Timestamp;
  noteOnOpponent: string;
  strategy: string;
  isHomeGame: boolean;
  // true = Rückrunde (second half of season), false/undefined = Hinrunde (first half)
  isRueckrunde?: boolean;
  lineup: Player[];
  starting?: Player[];
  createdAt: Timestamp;
}
