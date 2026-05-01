import { describe, expect, it } from "vitest";
import { parseBestMove, parseEvaluation, uciToMoveInput } from "./uci";

describe("UCI parser", () => {
  it("parses bestmove lines", () => {
    expect(parseBestMove("bestmove e7e8q ponder a2a1q")).toEqual({
      from: "e7",
      to: "e8",
      promotion: "q",
    });
  });

  it("parses centipawn and mate evaluations from latest info", () => {
    expect(parseEvaluation(["info depth 1 score cp 18", "info depth 2 score cp -42"])).toEqual({
      centipawns: -42,
      mate: null,
    });
    expect(parseEvaluation(["info depth 4 score mate 3"])?.centipawns).toBeGreaterThan(90000);
  });

  it("returns null for malformed output", () => {
    expect(parseBestMove("bestmove none")).toBeNull();
    expect(parseEvaluation(["uciok", "readyok"])).toBeNull();
    expect(uciToMoveInput("not-a-move")).toBeNull();
  });
});
