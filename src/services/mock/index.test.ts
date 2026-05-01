import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./storage";
import { createMockServices } from ".";

describe("mock services", () => {
  it("creates and joins a room with opposite colors", async () => {
    const services = createMockServices(createMemoryStorage());
    const created = await services.rooms.createRoom("white-player");
    expect(created.data?.status).toBe("waiting");

    const joined = await services.rooms.joinRoom(created.data!.id, "black-player");

    expect(joined.data?.whitePlayerId).toBe("white-player");
    expect(joined.data?.blackPlayerId).toBe("black-player");
    expect(joined.data?.status).toBe("active");
  });

  it("keeps joining the same player idempotent", async () => {
    const services = createMockServices(createMemoryStorage());
    const created = await services.rooms.createRoom("white-player");
    const firstJoin = await services.rooms.joinRoom(created.data!.id, "white-player");
    const secondJoin = await services.rooms.joinRoom(created.data!.id, "white-player");

    expect(firstJoin.data?.whitePlayerId).toBe("white-player");
    expect(secondJoin.data?.whitePlayerId).toBe("white-player");
    expect(secondJoin.data?.blackPlayerId).toBeNull();
    expect(secondJoin.data?.status).toBe("waiting");
  });

  it("rejects a third player when room is full", async () => {
    const services = createMockServices(createMemoryStorage());
    const created = await services.rooms.createRoom("white-player");
    await services.rooms.joinRoom(created.data!.id, "black-player");

    const rejected = await services.rooms.joinRoom(created.data!.id, "third-player");

    expect(rejected.error).toMatch(/full/i);
  });

  it("rejects wrong-turn multiplayer moves", async () => {
    const services = createMockServices(createMemoryStorage());
    const created = await services.rooms.createRoom("white-player");
    const joined = await services.rooms.joinRoom(created.data!.id, "black-player");

    const result = await services.rooms.submitMove(joined.data!.id, "black-player", {
      from: "e7",
      to: "e5",
    });

    expect(result.error).toMatch(/turn/i);
  });

  it("rejects moves from unassigned players", async () => {
    const services = createMockServices(createMemoryStorage());
    const created = await services.rooms.createRoom("white-player");
    const joined = await services.rooms.joinRoom(created.data!.id, "black-player");

    const result = await services.rooms.submitMove(joined.data!.id, "third-player", {
      from: "e2",
      to: "e4",
    });

    expect(result.error).toMatch(/not assigned/i);
  });

  it("rejects assigned players moving the opponent color", async () => {
    const services = createMockServices(createMemoryStorage());
    const created = await services.rooms.createRoom("white-player");
    const joined = await services.rooms.joinRoom(created.data!.id, "black-player");

    const result = await services.rooms.submitMove(joined.data!.id, "white-player", {
      from: "e7",
      to: "e5",
    });

    expect(result.error).toMatch(/opponent/i);
  });

  it("submits a legal room move using FEN and PGN authority", async () => {
    const services = createMockServices(createMemoryStorage());
    const created = await services.rooms.createRoom("white-player");
    const joined = await services.rooms.joinRoom(created.data!.id, "black-player");

    const result = await services.rooms.submitMove(joined.data!.id, "white-player", {
      from: "e2",
      to: "e4",
    });

    expect(result.data?.turn).toBe("black");
    expect(result.data?.pgn).toContain("e4");
    expect(result.data?.fen).not.toBe(joined.data?.fen);
    expect(result.data?.status).toBe("active");
  });

  it("loads the latest room state after reconnect", async () => {
    const services = createMockServices(createMemoryStorage());
    const created = await services.rooms.createRoom("white-player");
    const joined = await services.rooms.joinRoom(created.data!.id, "black-player");
    const moved = await services.rooms.submitMove(joined.data!.id, "white-player", {
      from: "e2",
      to: "e4",
    });

    const loaded = await services.rooms.loadRoom(joined.data!.id);

    expect(loaded.data?.fen).toBe(moved.data?.fen);
    expect(loaded.data?.pgn).toBe(moved.data?.pgn);
    expect(loaded.data?.turn).toBe("black");
  });

  it("saves completed games and returns history", async () => {
    const services = createMockServices(createMemoryStorage());
    const saved = await services.games.saveCompletedGame({
      whiteId: "white-player",
      blackId: "black-player",
      mode: "friend",
      pgn: "1. e4 e5",
      finalFen: "final-fen",
      result: "1-0",
      durationSeconds: 90,
    });
    const history = await services.games.listHistory("white-player");

    expect(saved.data?.id).toBeTruthy();
    expect(history.data).toHaveLength(1);
  });

  it("returns ranked leaderboard entries", async () => {
    const services = createMockServices(createMemoryStorage());
    const leaderboard = await services.profiles.listLeaderboard();

    expect(leaderboard.data?.[0].rank).toBe(1);
    expect(leaderboard.data?.[0].rating).toBeGreaterThanOrEqual(leaderboard.data?.[1].rating ?? 0);
  });

  it("persists profile updates", async () => {
    const storage = createMemoryStorage();
    const services = createMockServices(storage);

    await services.profiles.updateProfile({ username: "Mahiru", city: "Jerusalem", isPro: true });
    const profile = await services.profiles.getCurrentProfile();

    expect(profile.data?.username).toBe("Mahiru");
    expect(profile.data?.city).toBe("Jerusalem");
    expect(profile.data?.isPro).toBe(true);
  });
});
