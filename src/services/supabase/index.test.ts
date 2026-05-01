import { describe, expect, it } from "vitest";
import { createSupabaseServices } from ".";
import { toSupabaseUserId } from "./index";

const userId = "11111111-1111-4111-8111-111111111111";

class FakeSupabaseQuery {
  constructor(
    private readonly table: string,
    private readonly state: { inserted: Record<string, unknown> | null; upserted: Record<string, unknown> | null },
  ) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  upsert(row: Record<string, unknown>) {
    this.state.upserted = row;
    return this;
  }

  insert(row: Record<string, unknown>) {
    this.state.inserted = row;
    return this;
  }

  async maybeSingle() {
    return { data: null, error: null };
  }

  async single() {
    if (this.table === "profiles") {
      return { data: this.state.upserted, error: null };
    }

    return {
      data: {
        id: "game-1",
        ...(this.state.inserted ?? {}),
        created_at: "2026-05-01T00:00:00.000Z",
      },
      error: null,
    };
  }
}

function createFakeClient() {
  const state = {
    inserted: null as Record<string, unknown> | null,
    upserted: null as Record<string, unknown> | null,
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    from: (table: string) => new FakeSupabaseQuery(table, state),
  };

  return { client, state };
}

describe("Supabase services", () => {
  it("bootstraps a default anonymous profile when none exists", async () => {
    const { client, state } = createFakeClient();
    const services = createSupabaseServices(client as never);
    const result = await services.profiles.getCurrentProfile();

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      id: userId,
      username: "Guest Player",
      city: "Local",
      rating: 1200,
      isPro: false,
    });
    expect(state.upserted).toMatchObject({ id: userId, username: "Guest Player" });
  });

  it("maps non-UUID system opponent IDs to null for game saves", async () => {
    const { client, state } = createFakeClient();
    const services = createSupabaseServices(client as never);
    const result = await services.games.saveCompletedGame({
      whiteId: userId,
      blackId: "mock-ai",
      mode: "ai",
      pgn: "1. e4 e5",
      finalFen: "fen",
      result: "*",
      durationSeconds: 30,
    });

    expect(result.error).toBeNull();
    expect(state.inserted).toMatchObject({ white_id: userId, black_id: null });
  });

  it("keeps valid UUIDs and clears invalid IDs", () => {
    expect(toSupabaseUserId(userId)).toBe(userId);
    expect(toSupabaseUserId("mock-ai")).toBeNull();
    expect(toSupabaseUserId(null)).toBeNull();
  });
});
