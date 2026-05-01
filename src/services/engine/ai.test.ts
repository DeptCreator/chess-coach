import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "@/domain/chess";
import { StockfishAiService } from "./ai";
import type { EngineClient } from "./stockfish";

class FakeEngine implements EngineClient {
  readonly dispose = vi.fn();

  constructor(
    private readonly move = { from: "e7" as const, to: "e5" as const },
    private readonly error: Error | null = null,
  ) {}

  async getBestMove() {
    if (this.error) {
      throw this.error;
    }

    return this.move;
  }

  async evaluatePosition() {
    return { centipawns: 20, mate: null };
  }
}

describe("StockfishAiService", () => {
  it("returns a legal engine move", async () => {
    const engine = new FakeEngine();
    const service = new StockfishAiService(() => engine);
    const result = await service.chooseMove(
      {
        ...createInitialGame(),
        turn: "black",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        pgn: "1. e4",
      },
      "casual",
    );

    expect(result.source).toBe("stockfish");
    expect(result.move).toEqual({ from: "e7", to: "e5" });
    expect(engine.dispose).toHaveBeenCalledOnce();
  });

  it("falls back when the engine fails", async () => {
    const service = new StockfishAiService(() => {
      throw new Error("worker unavailable");
    });
    const result = await service.chooseMove(createInitialGame(), "beginner");

    expect(result.source).toBe("fallback");
    expect(result.move).toBeTruthy();
  });

  it("disposes the engine when search fails after creation", async () => {
    const engine = new FakeEngine({ from: "e7", to: "e5" }, new Error("search timeout"));
    const service = new StockfishAiService(() => engine);
    const result = await service.chooseMove(createInitialGame(), "beginner");

    expect(result.source).toBe("fallback");
    expect(result.message).toContain("search timeout");
    expect(engine.dispose).toHaveBeenCalledOnce();
  });
});
