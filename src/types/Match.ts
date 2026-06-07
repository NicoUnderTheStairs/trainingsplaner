import type { Timestamp } from "firebase/firestore";

export interface Player {
  playerNumber: number;
  playerName: string;
  playerPosition: string;
}

export interface Match {
  id?: string;
  opponent: string;
  date: Timestamp;
  noteOnOpponent: string;
  strategy: string;
  isHomeGame: boolean;
  lineup: Player[];
  starting?: Player[];
  createdAt: Timestamp;
}
