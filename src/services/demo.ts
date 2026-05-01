import type { AuthSession, CoachInsight, FriendProfile, Friendship, GameRecord, LeaderboardEntry, RoomState, UserProfile } from "@/domain/types";
import type { AppServices, AuthService, CoachService, FriendsService, GameService, IdentityService, ProfileService, RoomService, SaveGameInput, ServiceResult } from "./contracts";
import { StockfishAiService } from "./engine/ai";
import { createTemplateInsights } from "./engine/template-coach";

const sessionKey = "mahiru:demo-session:v1";
const profileKey = "mahiru:demo-profile:v1";
const historyKey = "mahiru:demo-history:v1";

export function createDemoServices(): AppServices {
  return {
    auth: new DemoAuthService(),
    identity: new DemoIdentityService(),
    profiles: new DemoProfileService(),
    friends: new DemoFriendsService(),
    rooms: new DemoRoomService(),
    ai: new StockfishAiService(),
    games: new DemoGameService(),
    coach: new DemoCoachService(),
  };
}

class DemoAuthService implements AuthService {
  async getSession(): Promise<ServiceResult<AuthSession | null>> {
    return ok(readJson<AuthSession | null>(sessionKey, null));
  }

  async signUp(input: { email: string; username: string; city: string }): Promise<ServiceResult<AuthSession>> {
    const session = createSession(input.email);
    const profile: UserProfile = {
      id: session.userId,
      email: session.email,
      username: input.username.trim() || "Guest Player",
      city: input.city.trim() || "Local",
      rating: 1200,
      avatarUrl: null,
      isPro: false,
    };

    writeJson(sessionKey, session);
    writeJson(profileKey, profile);

    return ok(session);
  }

  async signIn(input: { email: string }): Promise<ServiceResult<AuthSession>> {
    const session = createSession(input.email);
    const existingProfile = readJson<UserProfile | null>(profileKey, null);

    writeJson(sessionKey, session);
    writeJson(profileKey, existingProfile ?? createDefaultProfile(session));

    return ok(session);
  }

  async signOut(): Promise<ServiceResult<null>> {
    removeJson(sessionKey);
    return ok(null);
  }
}

class DemoIdentityService implements IdentityService {
  async getPlayerId(): Promise<ServiceResult<string>> {
    const session = readJson<AuthSession | null>(sessionKey, null);

    return session ? ok(session.userId) : fail("Sign in required.");
  }
}

class DemoProfileService implements ProfileService {
  async getCurrentProfile(): Promise<ServiceResult<UserProfile>> {
    const session = readJson<AuthSession | null>(sessionKey, null);

    if (!session) {
      return fail("Sign in required.");
    }

    const profile = readJson<UserProfile | null>(profileKey, null) ?? createDefaultProfile(session);
    writeJson(profileKey, profile);

    return ok(profile);
  }

  async updateProfile(input: Partial<Pick<UserProfile, "username" | "city" | "avatarUrl" | "isPro">>): Promise<ServiceResult<UserProfile>> {
    const current = await this.getCurrentProfile();

    if (!current.data) {
      return current;
    }

    const profile = {
      ...current.data,
      ...input,
      username: input.username?.trim() || current.data.username,
      city: input.city?.trim() || current.data.city,
    };

    writeJson(profileKey, profile);

    return ok(profile);
  }

  async listLeaderboard(city?: string): Promise<ServiceResult<LeaderboardEntry[]>> {
    const profile = readJson<UserProfile | null>(profileKey, null);
    const seed: LeaderboardEntry[] = [
      { userId: "demo-almaty", username: "Aruzhan", city: "Almaty", rating: 1460, wins: 12, losses: 4, rank: 1 },
      { userId: "demo-jerusalem", username: "Noam", city: "Jerusalem", rating: 1390, wins: 9, losses: 5, rank: 2 },
      { userId: "demo-astana", username: "Mahir", city: "Astana", rating: 1320, wins: 7, losses: 6, rank: 3 },
    ];
    const entries = profile
      ? [
          ...seed,
          {
            userId: profile.id,
            username: profile.username,
            city: profile.city,
            rating: profile.rating,
            wins: 1,
            losses: 0,
            rank: seed.length + 1,
          },
        ]
      : seed;
    const filtered = city ? entries.filter((entry) => entry.city.toLowerCase() === city.toLowerCase()) : entries;

    return ok(filtered.map((entry, index) => ({ ...entry, rank: index + 1 })));
  }
}

class DemoFriendsService implements FriendsService {
  async searchProfiles(): Promise<ServiceResult<FriendProfile[]>> {
    return ok([]);
  }

  async listFriendships(): Promise<ServiceResult<Friendship[]>> {
    return ok([]);
  }

  async sendRequest(): Promise<ServiceResult<Friendship>> {
    return fail("Connect Supabase to use friend requests.");
  }

  async acceptRequest(): Promise<ServiceResult<Friendship>> {
    return fail("Connect Supabase to use friend requests.");
  }

  async declineOrRemove(): Promise<ServiceResult<null>> {
    return ok(null);
  }
}

class DemoRoomService implements RoomService {
  async createRoom(): Promise<ServiceResult<RoomState>> {
    return fail("Connect Supabase to create friend rooms.");
  }

  async joinRoom(): Promise<ServiceResult<RoomState>> {
    return fail("Connect Supabase to join friend rooms.");
  }

  async loadRoom(): Promise<ServiceResult<RoomState>> {
    return fail("Room not available in demo mode.");
  }

  async submitMove(): Promise<ServiceResult<RoomState>> {
    return fail("Room not available in demo mode.");
  }

  async resign(): Promise<ServiceResult<RoomState>> {
    return fail("Room not available in demo mode.");
  }

  subscribeToRoom(): () => void {
    return () => undefined;
  }
}

class DemoGameService implements GameService {
  async saveCompletedGame(input: SaveGameInput): Promise<ServiceResult<GameRecord>> {
    const record: GameRecord = {
      id: createClientId("demo-game"),
      whiteId: input.whiteId,
      blackId: input.blackId,
      pgn: input.pgn,
      finalFen: input.finalFen,
      result: input.result,
      createdAt: new Date().toISOString(),
      durationSeconds: input.durationSeconds,
    };
    const history = [record, ...readJson<GameRecord[]>(historyKey, [])].slice(0, 50);
    writeJson(historyKey, history);

    return ok(record);
  }

  async listHistory(userId: string | null): Promise<ServiceResult<GameRecord[]>> {
    const history = readJson<GameRecord[]>(historyKey, []);

    return ok(userId ? history.filter((game) => game.whiteId === userId || game.blackId === userId || !game.whiteId) : history);
  }

  async loadReplay(gameId: string): Promise<ServiceResult<GameRecord>> {
    const game = readJson<GameRecord[]>(historyKey, []).find((item) => item.id === gameId);

    return game ? ok(game) : fail("Game not found.");
  }
}

class DemoCoachService implements CoachService {
  async generateInsights(game: GameRecord): Promise<ServiceResult<CoachInsight[]>> {
    return ok(createTemplateInsights(game));
  }

  async loadInsights(): Promise<ServiceResult<CoachInsight[]>> {
    return ok([]);
  }
}

function createSession(email: string): AuthSession {
  const normalized = email.trim().toLowerCase() || "demo@mahiru.local";

  return {
    userId: `demo-${hashString(normalized)}`,
    email: normalized,
  };
}

function createDefaultProfile(session: AuthSession): UserProfile {
  return {
    id: session.userId,
    email: session.email,
    username: "Demo Player",
    city: "Almaty",
    rating: 1200,
    avatarUrl: null,
    isPro: false,
  };
}

function createClientId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}-${random}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function removeJson(key: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): ServiceResult<T> {
  return { data: null, error };
}
