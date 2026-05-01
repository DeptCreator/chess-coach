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

function createUnauthenticatedFakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => {
      throw new Error("Unauthenticated service calls should fail before querying Supabase.");
    },
  };
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
      blackId: "system-ai",
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
    expect(toSupabaseUserId("system-ai")).toBeNull();
    expect(toSupabaseUserId(null)).toBeNull();
  });

  it("rejects unauthenticated friends actions before querying Supabase", async () => {
    const services = createSupabaseServices(createUnauthenticatedFakeClient() as never);

    await expect(services.friends.searchProfiles("mahiru")).resolves.toMatchObject({ data: null });
    await expect(services.friends.listFriendships()).resolves.toMatchObject({ data: null });
    await expect(services.friends.sendRequest(userId)).resolves.toMatchObject({ data: null });
    await expect(services.friends.acceptRequest(userId)).resolves.toMatchObject({ data: null });
    await expect(services.friends.declineOrRemove(userId)).resolves.toMatchObject({ data: null });
  });

  it("rejects unauthenticated room actions before querying Supabase", async () => {
    const services = createSupabaseServices(createUnauthenticatedFakeClient() as never);

    await expect(services.rooms.createRoom(null)).resolves.toMatchObject({ data: null });
    await expect(services.rooms.joinRoom("room-test", null)).resolves.toMatchObject({ data: null });
    await expect(
      services.rooms.submitMove("room-test", null, { from: "e2", to: "e4" } as never),
    ).resolves.toMatchObject({ data: null });
    await expect(services.rooms.resign("room-test", null)).resolves.toMatchObject({ data: null });
  });
});
