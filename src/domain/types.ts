export type ChessColor = "white" | "black";

export type GameMode = "local" | "friend" | "ai";

export type RoomColorChoice = "white" | "black" | "random";

export type TimeControl = "bullet" | "blitz" | "rapid";

export type GameStatus =
  | "waiting"
  | "active"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resigned"
  | "timeout"
  | "abandoned";

export type CoachClassification =
  | "best move"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface UserProfile {
  id: string;
  email?: string | null;
  username: string;
  city: string;
  rating: number;
  avatarUrl: string | null;
  isPro: boolean;
}

export interface AuthSession {
  userId: string;
  email: string;
}

export interface GameRecord {
  id: string;
  whiteId: string | null;
  blackId: string | null;
  pgn: string;
  finalFen: string;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  createdAt: string;
  durationSeconds: number;
}

export interface RoomClock {
  whiteSeconds: number;
  blackSeconds: number;
  incrementSeconds: number;
  lastTickAt: string | null;
}

export interface RoomState {
  id: string;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  hostColor: ChessColor;
  timeControl: TimeControl;
  resignedBy?: ChessColor;
  fen: string;
  pgn: string;
  status: GameStatus;
  turn: ChessColor;
  clocks: RoomClock;
}

export interface CoachInsight {
  moveNumber: number;
  moveSan: string;
  classification: CoachClassification;
  explanation: string;
  bestMove: string;
  evalBefore: number;
  evalAfter: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  city: string;
  rating: number;
  wins: number;
  losses: number;
  rank: number;
}
