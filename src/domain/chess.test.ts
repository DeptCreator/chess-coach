import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  applyMove,
  createInitialGame,
  snapshotFromChess,
  type ChessGameState,
  type MoveInput,
} from "./chess";

function play(state: ChessGameState, move: MoveInput): ChessGameState {
  const result = applyMove(state, move);
  expect(result.ok, result.error).toBe(true);
  return result.state;
}

describe("chess domain wrapper", () => {
  it("accepts a legal pawn move", () => {
    const result = applyMove(createInitialGame(), { from: "e2", to: "e4" });

    expect(result.ok).toBe(true);
    expect(result.state.turn).toBe("black");
    expect(result.move?.san).toBe("e4");
  });

  it("rejects an illegal piece move", () => {
    const state = createInitialGame();
    const result = applyMove(state, { from: "e2", to: "e5" });

    expect(result.ok).toBe(false);
    expect(result.state.fen).toBe(state.fen);
  });

  it("rejects a move that exposes the king", () => {
    const state = snapshotFromChess(new Chess("4k3/8/8/8/4r3/8/4R3/4K3 w - - 0 1"));
    const result = applyMove(state, { from: "e2", to: "d2" });

    expect(result.ok).toBe(false);
  });

  it("allows legal king-side castling", () => {
    let state = createInitialGame();
    state = play(state, { from: "e2", to: "e4" });
    state = play(state, { from: "e7", to: "e5" });
    state = play(state, { from: "g1", to: "f3" });
    state = play(state, { from: "b8", to: "c6" });
    state = play(state, { from: "f1", to: "c4" });
    state = play(state, { from: "g8", to: "f6" });

    const result = applyMove(state, { from: "e1", to: "g1" });

    expect(result.ok).toBe(true);
    expect(result.move?.san).toBe("O-O");
  });

  it("allows legal queen-side castling", () => {
    let state = createInitialGame();
    state = play(state, { from: "d2", to: "d4" });
    state = play(state, { from: "d7", to: "d5" });
    state = play(state, { from: "b1", to: "c3" });
    state = play(state, { from: "g8", to: "f6" });
    state = play(state, { from: "c1", to: "f4" });
    state = play(state, { from: "c8", to: "f5" });
    state = play(state, { from: "d1", to: "d2" });
    state = play(state, { from: "b8", to: "c6" });

    const result = applyMove(state, { from: "e1", to: "c1" });

    expect(result.ok).toBe(true);
    expect(result.move?.san).toBe("O-O-O");
  });

  it("rejects blocked castling", () => {
    const result = applyMove(createInitialGame(), { from: "e1", to: "g1" });

    expect(result.ok).toBe(false);
  });

  it("supports en passant on the immediate next move", () => {
    let state = createInitialGame();
    state = play(state, { from: "e2", to: "e4" });
    state = play(state, { from: "h7", to: "h6" });
    state = play(state, { from: "e4", to: "e5" });
    state = play(state, { from: "d7", to: "d5" });

    const result = applyMove(state, { from: "e5", to: "d6" });

    expect(result.ok).toBe(true);
    expect(result.move?.san).toBe("exd6");
  });

  it("supports promotion", () => {
    const state = snapshotFromChess(new Chess("8/P7/8/8/8/8/8/k6K w - - 0 1"));
    const result = applyMove(state, { from: "a7", to: "a8", promotion: "q" });

    expect(result.ok).toBe(true);
    expect(result.move?.san).toContain("=Q");
  });

  it("detects checkmate", () => {
    let state = createInitialGame();
    state = play(state, { from: "f2", to: "f3" });
    state = play(state, { from: "e7", to: "e5" });
    state = play(state, { from: "g2", to: "g4" });
    state = play(state, { from: "d8", to: "h4" });

    expect(state.status).toBe("checkmate");
  });

  it("detects stalemate", () => {
    const state = snapshotFromChess(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"));

    expect(state.status).toBe("stalemate");
  });
});
