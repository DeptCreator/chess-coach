import type { Square } from "chess.js";
import {
  applyMove,
  createInitialGame,
  getPieceAt,
  initialFen,
  oppositeColor,
  type MoveInput,
} from "@/domain/chess";
import type {
  CoachInsight,
  GameRecord,
  LeaderboardEntry,
  RoomState,
  TimeControl,
  UserProfile,
} from "@/domain/types";
import type {
  AppServices,
  CoachService,
  GameService,
  IdentityService,
  ProfileService,
  RoomService,
  SaveGameInput,
  ServiceResult,
  CreateRoomOptions,
} from "../contracts";
import { createTemplateInsights } from "./coach";
import { StockfishAiService } from "../engine/ai";
import { createEngineCoachInsights } from "../engine/coach";
import { getBrowserStorage, readJson, type StorageLike, writeJson } from "./storage";

const keys = {
  playerId: "arena:player-id",
  profile: "arena:profile",
  rooms: "arena:rooms",
  games: "arena:games",
  insights: "arena:insights",
};

const defaultProfile: UserProfile = {
  id: "guest-local",
  username: "Guest Player",
  city: "Tel Aviv",
  rating: 1200,
  avatarUrl: null,
  isPro: false,
};

const seedLeaderboard: LeaderboardEntry[] = [
  { userId: "seed-1", username: "Mira", city: "Tel Aviv", rating: 1460, wins: 28, losses: 12, rank: 1 },
  { userId: "seed-2", username: "Jon", city: "Haifa", rating: 1395, wins: 21, losses: 15, rank: 2 },
  { userId: "seed-3", username: "Guest Player", city: "Tel Aviv", rating: 1200, wins: 3, losses: 2, rank: 3 },
  { userId: "seed-4", username: "Noa", city: "Jerusalem", rating: 1160, wins: 8, losses: 9, rank: 4 },
];

const defaultRoomOptions: CreateRoomOptions = {
  colorChoice: "white",
  timeControl: "rapid",
};

const timeControlSeconds: Record<TimeControl, number> = {
  bullet: 60,
  blitz: 300,
  rapid: 600,
};

export function createMockServices(storage: StorageLike = getBrowserStorage()): AppServices {
  return {
    identity: new MockIdentityService(storage),
    profiles: new MockProfileService(storage),
    rooms: new MockRoomService(storage),
    ai: new StockfishAiService(),
    games: new MockGameService(storage),
    coach: new MockCoachService(storage),
    source: "mock",
  };
}

export function createBrowserMockServices(storage: StorageLike = getBrowserStorage()): AppServices {
  return {
    identity: new MockIdentityService(storage),
    profiles: new MockProfileService(storage),
    rooms: new BrowserMockRoomService(),
    ai: new StockfishAiService(),
    games: new MockGameService(storage),
    coach: new MockCoachService(storage),
    source: "mock",
  };
}

class MockIdentityService implements IdentityService {
  constructor(private readonly storage: StorageLike) {}

  async getPlayerId(): Promise<ServiceResult<string>> {
    const existing = this.storage.getItem(keys.playerId);

    if (existing) {
      return ok(existing);
    }

    const playerId = createId("guest");
    this.storage.setItem(keys.playerId, playerId);

    return ok(playerId);
  }
}

class MockProfileService implements ProfileService {
  constructor(private readonly storage: StorageLike) {}

  async getCurrentProfile(): Promise<ServiceResult<UserProfile>> {
    return ok(readJson(this.storage, keys.profile, defaultProfile));
  }

  async updateProfile(input: Partial<Pick<UserProfile, "username" | "city" | "avatarUrl" | "isPro">>): Promise<ServiceResult<UserProfile>> {
    const profile = { ...readJson(this.storage, keys.profile, defaultProfile), ...input };
    writeJson(this.storage, keys.profile, profile);

    return ok(profile);
  }

  async listLeaderboard(city?: string): Promise<ServiceResult<LeaderboardEntry[]>> {
    const profile = readJson(this.storage, keys.profile, defaultProfile);
    const entries = [
      ...seedLeaderboard.filter((entry) => entry.userId !== profile.id),
      {
        userId: profile.id,
        username: profile.username,
        city: profile.city,
        rating: profile.rating,
        wins: 3,
        losses: 2,
        rank: 0,
      },
    ]
      .filter((entry) => !city || entry.city.toLowerCase() === city.toLowerCase())
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return ok(entries);
  }
}

class MockRoomService implements RoomService {
  constructor(private readonly storage: StorageLike) {}

  async createRoom(playerId: string | null, options: CreateRoomOptions = defaultRoomOptions): Promise<ServiceResult<RoomState>> {
    const rooms = this.readRooms();
    const id = createId("room");
    const initial = createInitialGame();
    const hostColor = resolveHostColor(options.colorChoice);
    const room: RoomState = {
      id,
      whitePlayerId: hostColor === "white" ? playerId : null,
      blackPlayerId: hostColor === "black" ? playerId : null,
      hostColor,
      timeControl: options.timeControl,
      fen: initialFen,
      pgn: "",
      status: "waiting",
      turn: initial.turn,
      clocks: createClock(options.timeControl),
    };
    rooms[id] = room;
    this.writeRooms(rooms);

    return ok(room);
  }

  async joinRoom(roomId: string, playerId: string | null): Promise<ServiceResult<RoomState>> {
    const rooms = this.readRooms();
    const room = rooms[roomId];

    if (!room) {
      return fail("Room not found");
    }

    const actorId = playerId ?? createId("guest");

    if (room.whitePlayerId !== actorId && room.blackPlayerId !== actorId) {
      if (!room.whitePlayerId) {
        room.whitePlayerId = actorId;
      } else if (!room.blackPlayerId) {
        room.blackPlayerId = actorId;
      } else {
        return fail("Room is full");
      }
    }

    if (room.whitePlayerId && room.blackPlayerId && room.status === "waiting") {
      room.status = "active";
    }

    rooms[roomId] = room;
    this.writeRooms(rooms);

    return ok(room);
  }

  async loadRoom(roomId: string): Promise<ServiceResult<RoomState>> {
    const room = this.readRooms()[roomId];

    return room ? ok(room) : fail("Room not found");
  }

  async submitMove(
    roomId: string,
    playerId: string | null,
    move: MoveInput & { from: Square; to: Square },
  ): Promise<ServiceResult<RoomState>> {
    const rooms = this.readRooms();
    const room = rooms[roomId];

    if (!room) {
      return fail("Room not found");
    }

    if (room.status !== "active") {
      return fail("Room is not active");
    }

    const actorColor =
      room.whitePlayerId === playerId ? "white" : room.blackPlayerId === playerId ? "black" : null;

    if (!actorColor) {
      return fail("Player is not assigned to this room");
    }

    if (actorColor !== room.turn) {
      return fail("It is not this player's turn");
    }

    if (getPieceAt(room.fen, move.from)?.color !== actorColor) {
      return fail("Player cannot move opponent pieces");
    }

    const result = applyMove({ fen: room.fen, pgn: room.pgn }, move);

    if (!result.ok) {
      return fail(result.error ?? "Illegal move");
    }

    const updated: RoomState = {
      ...room,
      fen: result.state.fen,
      pgn: result.state.pgn,
      turn: result.state.turn,
      status: result.state.status,
      clocks: {
        ...room.clocks,
        lastTickAt: new Date().toISOString(),
      },
    };
    rooms[roomId] = updated;
    this.writeRooms(rooms);

    return ok(updated);
  }

  async resign(roomId: string, playerId: string | null): Promise<ServiceResult<RoomState>> {
    const rooms = this.readRooms();
    const room = rooms[roomId];

    if (!room) {
      return fail("Room not found");
    }

    if (room.whitePlayerId !== playerId && room.blackPlayerId !== playerId) {
      return fail("Player is not assigned to this room");
    }

    const updated = {
      ...room,
      status: "resigned" as const,
      turn: oppositeColor(room.turn),
      resignedBy: room.whitePlayerId === playerId ? "white" as const : "black" as const,
    };
    rooms[roomId] = updated;
    this.writeRooms(rooms);

    return ok(updated);
  }

  subscribeToRoom(roomId: string, onState: (room: RoomState) => void): () => void {
    let lastSerialized = "";
    const tick = () => {
      const room = this.readRooms()[roomId];

      if (!room) {
        return;
      }

      const serialized = JSON.stringify(room);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        onState(room);
      }
    };
    tick();
    const interval = window.setInterval(tick, 700);

    return () => window.clearInterval(interval);
  }

  private readRooms(): Record<string, RoomState> {
    return readJson(this.storage, keys.rooms, {});
  }

  private writeRooms(rooms: Record<string, RoomState>): void {
    writeJson(this.storage, keys.rooms, rooms);
  }
}

class BrowserMockRoomService implements RoomService {
  private socket: WebSocket | null = null;
  private connecting: Promise<WebSocket> | null = null;
  private requestId = 0;
  private readonly pending = new Map<string, (result: ServiceResult<RoomState>) => void>();
  private readonly subscriptions = new Map<string, Set<(room: RoomState) => void>>();

  async createRoom(playerId: string | null, options: CreateRoomOptions = defaultRoomOptions): Promise<ServiceResult<RoomState>> {
    return this.request("create", { playerId, options });
  }

  async joinRoom(roomId: string, playerId: string | null): Promise<ServiceResult<RoomState>> {
    return this.request("join", { roomId, playerId });
  }

  async loadRoom(roomId: string): Promise<ServiceResult<RoomState>> {
    return this.request("load", { roomId });
  }

  async submitMove(
    roomId: string,
    playerId: string | null,
    move: MoveInput & { from: Square; to: Square },
  ): Promise<ServiceResult<RoomState>> {
    return this.request("move", { roomId, playerId, move });
  }

  async resign(roomId: string, playerId: string | null): Promise<ServiceResult<RoomState>> {
    return this.request("resign", { roomId, playerId });
  }

  subscribeToRoom(roomId: string, onState: (room: RoomState) => void): () => void {
    const callbacks = this.subscriptions.get(roomId) ?? new Set<(room: RoomState) => void>();
    callbacks.add(onState);
    this.subscriptions.set(roomId, callbacks);

    this.request("subscribe", { roomId }).then((result) => {
      if (result.data && this.subscriptions.get(roomId)?.has(onState)) {
        onState(result.data);
      }
    });

    let cancelled = false;
    let lastSerialized = "";
    let interval: number | null = null;

    const startHttpFallback = () => {
      if (interval !== null) {
        return;
      }

      const tick = async () => {
        if (cancelled || this.socket?.readyState === WebSocket.OPEN) {
          return;
        }

        const result = await this.httpRequest("load", { roomId });
        if (result.data) {
          const serialized = JSON.stringify(result.data);
          if (serialized !== lastSerialized) {
            lastSerialized = serialized;
            onState(result.data);
          }
        }
      };

      tick();
      interval = window.setInterval(tick, 700);
    };

    window.setTimeout(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        startHttpFallback();
      }
    }, 1200);

    return () => {
      cancelled = true;
      callbacks.delete(onState);
      if (callbacks.size === 0) {
        this.subscriptions.delete(roomId);
      }
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }

  private async request(action: string, body: Record<string, unknown>): Promise<ServiceResult<RoomState>> {
    const websocketResult = await this.websocketRequest(action, body);

    if (websocketResult) {
      return websocketResult;
    }

    return this.httpRequest(action, body);
  }

  private async websocketRequest(action: string, body: Record<string, unknown>): Promise<ServiceResult<RoomState> | null> {
    try {
      const socket = await this.getSocket();
      const requestId = `room-${++this.requestId}`;

      return await new Promise<ServiceResult<RoomState>>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          this.pending.delete(requestId);
          reject(new Error("Room WebSocket request timed out"));
        }, 3000);

        this.pending.set(requestId, (result) => {
          window.clearTimeout(timeout);
          resolve(result);
        });
        socket.send(JSON.stringify({ action, requestId, ...body }));
      });
    } catch {
      return null;
    }
  }

  private async httpRequest(action: string, body: Record<string, unknown>): Promise<ServiceResult<RoomState>> {
    try {
      const response = await fetch("/api/mock-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });

      const result = (await response.json()) as ServiceResult<RoomState>;
      return result;
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Mock room request failed");
    }
  }

  private async getSocket(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/rooms`);
      const timeout = window.setTimeout(() => {
        socket.close();
        reject(new Error("Room WebSocket connection timed out"));
      }, 1500);

      socket.addEventListener("open", () => {
        window.clearTimeout(timeout);
        this.socket = socket;
        this.connecting = null;
        resolve(socket);
      });

      socket.addEventListener("message", (event) => {
        this.handleSocketMessage(event.data);
      });

      socket.addEventListener("close", () => {
        if (this.socket === socket) {
          this.socket = null;
        }
        this.connecting = null;
      });

      socket.addEventListener("error", () => {
        window.clearTimeout(timeout);
        this.connecting = null;
        reject(new Error("Room WebSocket connection failed"));
      });
    });

    return this.connecting;
  }

  private handleSocketMessage(raw: unknown): void {
    let message: {
      type?: string;
      requestId?: string;
      result?: ServiceResult<RoomState>;
      room?: RoomState;
    };

    try {
      message = JSON.parse(String(raw)) as typeof message;
    } catch {
      return;
    }

    if (message.type === "response" && message.requestId && message.result) {
      this.pending.get(message.requestId)?.(message.result);
      this.pending.delete(message.requestId);
      return;
    }

    if (message.type === "room" && message.room) {
      const callbacks = this.subscriptions.get(message.room.id);
      callbacks?.forEach((callback) => callback(message.room!));
    }
  }
}

class MockGameService implements GameService {
  constructor(private readonly storage: StorageLike) {}

  async saveCompletedGame(input: SaveGameInput): Promise<ServiceResult<GameRecord>> {
    const games = this.readGames();
    const game: GameRecord = {
      id: createId("game"),
      whiteId: input.whiteId,
      blackId: input.blackId,
      pgn: input.pgn,
      finalFen: input.finalFen,
      result: input.result,
      createdAt: new Date().toISOString(),
      durationSeconds: input.durationSeconds,
    };
    games.unshift(game);
    writeJson(this.storage, keys.games, games.slice(0, 50));

    return ok(game);
  }

  async listHistory(userId: string | null): Promise<ServiceResult<GameRecord[]>> {
    const games = this.readGames().filter(
      (game) => !userId || game.whiteId === userId || game.blackId === userId,
    );

    return ok(games);
  }

  async loadReplay(gameId: string): Promise<ServiceResult<GameRecord>> {
    const game = this.readGames().find((item) => item.id === gameId);

    return game ? ok(game) : fail("Game not found");
  }

  private readGames(): GameRecord[] {
    return readJson(this.storage, keys.games, []);
  }
}

class MockCoachService implements CoachService {
  constructor(private readonly storage: StorageLike) {}

  async generateInsights(game: GameRecord): Promise<ServiceResult<CoachInsight[]>> {
    const allInsights = readJson<Record<string, CoachInsight[]>>(this.storage, keys.insights, {});
    const insights = await createEngineCoachInsights(game).catch(() => createTemplateInsights(game));
    allInsights[game.id] = insights;
    writeJson(this.storage, keys.insights, allInsights);

    return ok(insights);
  }

  async loadInsights(gameId: string): Promise<ServiceResult<CoachInsight[]>> {
    return ok(readJson<Record<string, CoachInsight[]>>(this.storage, keys.insights, {})[gameId] ?? []);
  }
}

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): ServiceResult<T> {
  return { data: null, error };
}

function resolveHostColor(choice: CreateRoomOptions["colorChoice"]) {
  if (choice === "random") {
    return Math.random() >= 0.5 ? "white" : "black";
  }

  return choice;
}

function createClock(timeControl: TimeControl) {
  const seconds = timeControlSeconds[timeControl];

  return {
    whiteSeconds: seconds,
    blackSeconds: seconds,
    incrementSeconds: 0,
    lastTickAt: null,
  };
}

function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}-${random}`;
}
