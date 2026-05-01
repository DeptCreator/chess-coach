import type { Square } from "chess.js";
import type {
  AuthSession,
  CoachInsight,
  FriendProfile,
  Friendship,
  GameMode,
  GameRecord,
  LeaderboardEntry,
  RoomColorChoice,
  RoomState,
  TimeControl,
  UserProfile,
} from "@/domain/types";
import type { ChessGameState, MoveInput } from "@/domain/chess";

export type AiDifficulty = "beginner" | "casual" | "competitive" | "expert";

export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

export interface SaveGameInput {
  whiteId: string | null;
  blackId: string | null;
  mode: GameMode;
  pgn: string;
  finalFen: string;
  result: GameRecord["result"];
  durationSeconds: number;
}

export interface ProfileService {
  getCurrentProfile(): Promise<ServiceResult<UserProfile>>;
  updateProfile(input: Partial<Pick<UserProfile, "username" | "city" | "avatarUrl" | "isPro">>): Promise<ServiceResult<UserProfile>>;
  listLeaderboard(city?: string): Promise<ServiceResult<LeaderboardEntry[]>>;
}

export interface FriendsService {
  searchProfiles(query: string): Promise<ServiceResult<FriendProfile[]>>;
  listFriendships(): Promise<ServiceResult<Friendship[]>>;
  sendRequest(profileId: string): Promise<ServiceResult<Friendship>>;
  acceptRequest(friendshipId: string): Promise<ServiceResult<Friendship>>;
  declineOrRemove(friendshipId: string): Promise<ServiceResult<null>>;
}

export interface AuthService {
  getSession(): Promise<ServiceResult<AuthSession | null>>;
  signUp(input: { email: string; password: string; username: string; city: string }): Promise<ServiceResult<AuthSession>>;
  signIn(input: { email: string; password: string }): Promise<ServiceResult<AuthSession>>;
  signOut(): Promise<ServiceResult<null>>;
}

export interface CreateRoomOptions {
  colorChoice: RoomColorChoice;
  timeControl: TimeControl;
}

export interface RoomService {
  createRoom(playerId: string | null, options?: CreateRoomOptions): Promise<ServiceResult<RoomState>>;
  joinRoom(roomId: string, playerId: string | null): Promise<ServiceResult<RoomState>>;
  loadRoom(roomId: string): Promise<ServiceResult<RoomState>>;
  submitMove(roomId: string, playerId: string | null, move: MoveInput & { from: Square; to: Square }): Promise<ServiceResult<RoomState>>;
  resign(roomId: string, playerId: string | null): Promise<ServiceResult<RoomState>>;
  subscribeToRoom(roomId: string, onState: (room: RoomState) => void): () => void;
}

export interface IdentityService {
  getPlayerId(): Promise<ServiceResult<string>>;
}

export interface AiMoveResult {
  move: MoveInput | null;
  source: "stockfish" | "fallback";
  message: string;
}

export interface AiService {
  chooseMove(state: ChessGameState, difficulty: AiDifficulty): Promise<AiMoveResult>;
}

export interface GameService {
  saveCompletedGame(input: SaveGameInput): Promise<ServiceResult<GameRecord>>;
  listHistory(userId: string | null): Promise<ServiceResult<GameRecord[]>>;
  loadReplay(gameId: string): Promise<ServiceResult<GameRecord>>;
}

export interface CoachService {
  generateInsights(game: GameRecord): Promise<ServiceResult<CoachInsight[]>>;
  loadInsights(gameId: string): Promise<ServiceResult<CoachInsight[]>>;
}

export interface AppServices {
  auth: AuthService;
  identity: IdentityService;
  profiles: ProfileService;
  friends: FriendsService;
  rooms: RoomService;
  ai: AiService;
  games: GameService;
  coach: CoachService;
}
