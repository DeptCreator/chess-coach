import type { SupabaseClient } from "@supabase/supabase-js";
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
  AuthSession,
  CoachInsight,
  GameRecord,
  LeaderboardEntry,
  RoomState,
  TimeControl,
  UserProfile,
} from "@/domain/types";
import type {
  AppServices,
  AuthService,
  CoachService,
  GameService,
  IdentityService,
  ProfileService,
  RoomService,
  SaveGameInput,
  ServiceResult,
  CreateRoomOptions,
} from "../contracts";
import { createTemplateInsights } from "../mock/coach";
import { createSupabaseBrowserClient } from "./client";
import { StockfishAiService } from "../engine/ai";
import { createEngineCoachInsights } from "../engine/coach";

export function createSupabaseServices(client: SupabaseClient = createSupabaseBrowserClient()): AppServices {
  return {
    auth: new SupabaseAuthService(client),
    identity: new SupabaseIdentityService(client),
    profiles: new SupabaseProfileService(client),
    rooms: new SupabaseRoomService(client),
    ai: new StockfishAiService(),
    games: new SupabaseGameService(client),
    coach: new SupabaseCoachService(client),
    source: "supabase",
  };
}

class SupabaseAuthService implements AuthService {
  constructor(private readonly client: SupabaseClient) {}

  async getSession(): Promise<ServiceResult<AuthSession | null>> {
    const { data, error } = await this.client.auth.getSession();

    if (error) {
      return fail(error.message);
    }

    if (!data.session?.user) {
      return ok(null);
    }

    return ok({
      userId: data.session.user.id,
      email: data.session.user.email ?? "",
    });
  }

  async signUp(input: { email: string; password: string; username: string; city: string }): Promise<ServiceResult<AuthSession>> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          username: input.username,
          city: input.city,
        },
      },
    });

    if (error || !data.user) {
      return fail(error?.message ?? "Could not create account.");
    }

    await this.client.from("profiles").upsert({
      id: data.user.id,
      email: data.user.email,
      username: input.username.trim() || data.user.email?.split("@")[0] || "Player",
      city: input.city.trim() || "Local",
      avatar_url: null,
      is_pro: false,
    });

    return ok({ userId: data.user.id, email: data.user.email ?? "" });
  }

  async signIn(input: { email: string; password: string }): Promise<ServiceResult<AuthSession>> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });

    if (error || !data.user) {
      return fail(error?.message ?? "Could not sign in.");
    }

    return ok({ userId: data.user.id, email: data.user.email ?? "" });
  }

  async signOut(): Promise<ServiceResult<null>> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      return fail(error.message);
    }

    return ok(null);
  }
}

class SupabaseIdentityService implements IdentityService {
  constructor(private readonly client: SupabaseClient) {}

  async getPlayerId(): Promise<ServiceResult<string>> {
    const current = await this.client.auth.getUser();

    if (current.data.user) {
      return ok(current.data.user.id);
    }

    const { data, error } = await this.client.auth.signInAnonymously();

    if (error || !data.user) {
      return fail(error?.message ?? "Could not create anonymous Supabase player");
    }

    return ok(data.user.id);
  }
}

class SupabaseProfileService implements ProfileService {
  constructor(private readonly client: SupabaseClient) {}

  async getCurrentProfile(): Promise<ServiceResult<UserProfile>> {
    const { data: userData, error: authError } = await this.client.auth.getUser();

    if (authError || !userData.user) {
      return fail("No authenticated Supabase user");
    }

    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (error) {
      return fail(error.message);
    }

    if (data) {
      return ok(mapProfile(data));
    }

    return this.upsertDefaultProfile(userData.user.id);
  }

  async updateProfile(input: Partial<Pick<UserProfile, "username" | "city" | "avatarUrl" | "isPro">>): Promise<ServiceResult<UserProfile>> {
    const { data: userData, error: authError } = await this.client.auth.getUser();

    if (authError || !userData.user) {
      return fail("No authenticated Supabase user");
    }

    const { data, error } = await this.client
      .from("profiles")
      .upsert({
        id: userData.user.id,
        email: userData.user.email,
        username: input.username,
        city: input.city,
        avatar_url: input.avatarUrl,
        is_pro: input.isPro,
      })
      .select("*")
      .single();

    if (error) {
      return fail(error.message);
    }

    return ok(mapProfile(data));
  }

  async listLeaderboard(city?: string): Promise<ServiceResult<LeaderboardEntry[]>> {
    let query = this.client
      .from("profiles")
      .select("id, username, city, rating, wins, losses")
      .order("rating", { ascending: false })
      .order("wins", { ascending: false })
      .limit(50);

    if (city) {
      query = query.ilike("city", city);
    }

    const { data, error } = await query;

    if (error) {
      return fail(error.message);
    }

    return ok(
      (data ?? []).map((entry, index) => ({
        userId: entry.id,
        username: entry.username,
        city: entry.city ?? "Unknown",
        rating: entry.rating,
        wins: entry.wins,
        losses: entry.losses,
        rank: index + 1,
      })),
    );
  }

  private async upsertDefaultProfile(userId: string): Promise<ServiceResult<UserProfile>> {
    const { data, error } = await this.client
      .from("profiles")
      .upsert(createDefaultProfileRow(userId))
      .select("*")
      .single();

    if (error) {
      return fail(error.message);
    }

    return ok(mapProfile(data));
  }
}

class SupabaseRoomService implements RoomService {
  constructor(private readonly client: SupabaseClient) {}

  async createRoom(playerId: string | null, options: CreateRoomOptions = defaultRoomOptions): Promise<ServiceResult<RoomState>> {
    const initial = createInitialGame();
    const id = `room-${crypto.randomUUID()}`;
    const hostColor = resolveHostColor(options.colorChoice);
    const seconds = timeControlSeconds(options.timeControl);
    const { data, error } = await this.client
      .from("rooms")
      .insert({
        id,
        white_player_id: hostColor === "white" ? playerId : null,
        black_player_id: hostColor === "black" ? playerId : null,
        host_color: hostColor,
        time_control: options.timeControl,
        resigned_by: null,
        fen: initialFen,
        pgn: "",
        status: "waiting",
        turn: initial.turn,
        white_seconds: seconds,
        black_seconds: seconds,
        increment_seconds: 0,
        last_tick_at: null,
      })
      .select("*")
      .single();

    if (error) {
      return fail(error.message);
    }

    return ok(mapRoom(data));
  }

  async joinRoom(roomId: string, playerId: string | null): Promise<ServiceResult<RoomState>> {
    const current = await this.loadRoom(roomId);

    if (!current.data) {
      return current;
    }

    const room = current.data;

    if (room.whitePlayerId !== playerId && room.blackPlayerId !== playerId) {
      if (!room.whitePlayerId) {
        room.whitePlayerId = playerId;
      } else if (!room.blackPlayerId) {
        room.blackPlayerId = playerId;
      } else {
        return fail("Room is full");
      }
    }

    if (room.whitePlayerId && room.blackPlayerId && room.status === "waiting") {
      room.status = "active";
    }

    return this.updateRoom(room);
  }

  async loadRoom(roomId: string): Promise<ServiceResult<RoomState>> {
    const { data, error } = await this.client.from("rooms").select("*").eq("id", roomId).single();

    if (error) {
      return fail(error.message);
    }

    return ok(mapRoom(data));
  }

  async submitMove(
    roomId: string,
    playerId: string | null,
    move: MoveInput & { from: Square; to: Square },
  ): Promise<ServiceResult<RoomState>> {
    const current = await this.loadRoom(roomId);

    if (!current.data) {
      return current;
    }

    const room = current.data;

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

    return this.updateRoom({
      ...room,
      fen: result.state.fen,
      pgn: result.state.pgn,
      turn: result.state.turn,
      status: result.state.status,
      clocks: {
        ...room.clocks,
        lastTickAt: new Date().toISOString(),
      },
    });
  }

  async resign(roomId: string, playerId: string | null): Promise<ServiceResult<RoomState>> {
    const current = await this.loadRoom(roomId);

    if (!current.data) {
      return current;
    }

    const room = current.data;

    if (room.whitePlayerId !== playerId && room.blackPlayerId !== playerId) {
      return fail("Player is not assigned to this room");
    }

    return this.updateRoom({
      ...room,
      status: "resigned",
      turn: oppositeColor(room.turn),
      resignedBy: room.whitePlayerId === playerId ? "white" : "black",
    });
  }

  subscribeToRoom(roomId: string, onState: (room: RoomState) => void): () => void {
    const channel = this.client
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            onState(mapRoom(payload.new as Record<string, any>));
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      this.client.removeChannel(channel);
    };
  }

  private async updateRoom(room: RoomState): Promise<ServiceResult<RoomState>> {
    const { data, error } = await this.client
      .from("rooms")
      .update({
        white_player_id: room.whitePlayerId,
        black_player_id: room.blackPlayerId,
        host_color: room.hostColor,
        time_control: room.timeControl,
        resigned_by: room.resignedBy ?? null,
        fen: room.fen,
        pgn: room.pgn,
        status: room.status,
        turn: room.turn,
        white_seconds: room.clocks.whiteSeconds,
        black_seconds: room.clocks.blackSeconds,
        increment_seconds: room.clocks.incrementSeconds,
        last_tick_at: room.clocks.lastTickAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", room.id)
      .select("*")
      .single();

    if (error) {
      return fail(error.message);
    }

    return ok(mapRoom(data));
  }
}

class SupabaseGameService implements GameService {
  constructor(private readonly client: SupabaseClient) {}

  async saveCompletedGame(input: SaveGameInput): Promise<ServiceResult<GameRecord>> {
    const { data, error } = await this.client
      .from("games")
      .insert({
        white_id: toSupabaseUserId(input.whiteId),
        black_id: toSupabaseUserId(input.blackId),
        mode: input.mode,
        pgn: input.pgn,
        final_fen: input.finalFen,
        result: input.result,
        duration_seconds: input.durationSeconds,
      })
      .select("*")
      .single();

    if (error) {
      return fail(error.message);
    }

    return ok(mapGame(data));
  }

  async listHistory(userId: string | null): Promise<ServiceResult<GameRecord[]>> {
    let query = this.client.from("games").select("*").order("created_at", { ascending: false });

    if (userId) {
      query = query.or(`white_id.eq.${userId},black_id.eq.${userId}`);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      return fail(error.message);
    }

    return ok((data ?? []).map(mapGame));
  }

  async loadReplay(gameId: string): Promise<ServiceResult<GameRecord>> {
    const { data, error } = await this.client.from("games").select("*").eq("id", gameId).single();

    if (error) {
      return fail(error.message);
    }

    return ok(mapGame(data));
  }
}

class SupabaseCoachService implements CoachService {
  constructor(private readonly client: SupabaseClient) {}

  async generateInsights(game: GameRecord): Promise<ServiceResult<CoachInsight[]>> {
    const insights = await createEngineCoachInsights(game).catch(() => createTemplateInsights(game));
    const { error } = await this.client.from("coach_insights").insert(
      insights.map((insight) => ({
        game_id: game.id,
        move_number: insight.moveNumber,
        move_san: insight.moveSan,
        classification: insight.classification,
        explanation: insight.explanation,
        best_move: insight.bestMove,
        eval_before: insight.evalBefore,
        eval_after: insight.evalAfter,
      })),
    );

    if (error) {
      return fail(error.message);
    }

    return ok(insights);
  }

  async loadInsights(gameId: string): Promise<ServiceResult<CoachInsight[]>> {
    const { data, error } = await this.client
      .from("coach_insights")
      .select("*")
      .eq("game_id", gameId)
      .order("move_number", { ascending: true });

    if (error) {
      return fail(error.message);
    }

    return ok(
      (data ?? []).map((row) => ({
        moveNumber: row.move_number,
        moveSan: row.move_san,
        classification: row.classification,
        explanation: row.explanation,
        bestMove: row.best_move,
        evalBefore: Number(row.eval_before),
        evalAfter: Number(row.eval_after),
      })),
    );
  }
}

function mapProfile(row: Record<string, any>): UserProfile {
  return {
    id: row.id,
    email: row.email ?? null,
    username: row.username,
    city: row.city ?? "",
    rating: row.rating,
    avatarUrl: row.avatar_url,
    isPro: row.is_pro,
  };
}

function mapRoom(row: Record<string, any>): RoomState {
  return {
    id: row.id,
    whitePlayerId: row.white_player_id,
    blackPlayerId: row.black_player_id,
    hostColor: row.host_color ?? (row.white_player_id ? "white" : "black"),
    timeControl: row.time_control ?? inferTimeControl(Number(row.white_seconds)),
    resignedBy: row.resigned_by,
    fen: row.fen,
    pgn: row.pgn,
    status: row.status,
    turn: row.turn,
    clocks: {
      whiteSeconds: row.white_seconds,
      blackSeconds: row.black_seconds,
      incrementSeconds: row.increment_seconds,
      lastTickAt: row.last_tick_at,
    },
  };
}

const defaultRoomOptions: CreateRoomOptions = {
  colorChoice: "white",
  timeControl: "rapid",
};

function resolveHostColor(choice: CreateRoomOptions["colorChoice"]) {
  if (choice === "random") {
    return Math.random() >= 0.5 ? "white" : "black";
  }

  return choice;
}

function timeControlSeconds(value: TimeControl): number {
  if (value === "bullet") {
    return 60;
  }

  if (value === "blitz") {
    return 300;
  }

  return 600;
}

function inferTimeControl(seconds: number): TimeControl {
  if (seconds <= 60) {
    return "bullet";
  }

  if (seconds <= 300) {
    return "blitz";
  }

  return "rapid";
}

function mapGame(row: Record<string, any>): GameRecord {
  return {
    id: row.id,
    whiteId: row.white_id,
    blackId: row.black_id,
    pgn: row.pgn,
    finalFen: row.final_fen,
    result: row.result,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds,
  };
}

function createDefaultProfileRow(userId: string) {
  return {
    id: userId,
    email: null,
    username: "Guest Player",
    city: "Local",
    rating: 1200,
    avatar_url: null,
    is_pro: false,
  };
}

export function toSupabaseUserId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): ServiceResult<T> {
  return { data: null, error };
}
