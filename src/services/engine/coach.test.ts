import { describe, expect, it } from "vitest";
import type { GameRecord } from "@/domain/types";
import { classifyDrop, createEngineCoachInsights } from "./coach";
import type { EngineClient } from "./stockfish";

class FakeCoachEngine implements EngineClient {
  async getBestMove() {
    return { from: "e2" as const, to: "e4" as const };
  }

  async evaluatePosition(fen: string) {
    return { centipawns: fen.includes(" b ") ? -30 : 25, mate: null };
  }

  dispose() {
    return undefined;
  }
}

class FakeSwingEngine implements EngineClient {
  private evaluationCalls = 0;

  async getBestMove() {
    return { from: "g1" as const, to: "f3" as const };
  }

  async evaluatePosition() {
    const pointIndex = Math.floor(this.evaluationCalls / 2);
    const isBefore = this.evaluationCalls % 2 === 0;
    this.evaluationCalls += 1;

    if (pointIndex === 3) {
      return { centipawns: isBefore ? 500 : 0, mate: null };
    }

    return { centipawns: isBefore ? 20 : -10, mate: null };
  }

  dispose() {
    return undefined;
  }
}

const game: GameRecord = {
  id: "game-1",
  whiteId: "white",
  blackId: "black",
  pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5",
  finalFen: "final",
  result: "*",
  createdAt: new Date().toISOString(),
  durationSeconds: 120,
};

describe("engine coach", () => {
  it("returns at least three engine-backed insights for a normal PGN", async () => {
    const insights = await createEngineCoachInsights(game, () => new FakeCoachEngine());

    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights[0].bestMove).toBe("e2e4");
  });

  it("includes high swing candidates for longer games", async () => {
    const longGame: GameRecord = {
      ...game,
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+",
    };
    const insights = await createEngineCoachInsights(longGame, () => new FakeSwingEngine());

    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights.some((insight) => insight.classification === "blunder")).toBe(true);
  });

  it("classifies centipawn drops", () => {
    expect(classifyDrop(10, "e4", { from: "e2", to: "e4" }, { from: "e2", to: "e4" })).toBe("best move");
    expect(classifyDrop(80, "h3", { from: "g1", to: "f3" })).toBe("inaccuracy");
    expect(classifyDrop(220, "Qh5", { from: "b1", to: "c3" })).toBe("mistake");
    expect(classifyDrop(400, "Qxf7", { from: "e7", to: "e5" })).toBe("blunder");
  });
});
