import { createChessFromState, legalRandomMove, type ChessGameState, type MoveInput } from "@/domain/chess";
import type { AiDifficulty, AiMoveResult, AiService } from "../contracts";
import { StockfishEngineClient, type EngineClient } from "./stockfish";

const difficultySettings: Record<AiDifficulty, { depth: number; movetimeMs: number; elo: string }> = {
  beginner: { depth: 4, movetimeMs: 250, elo: "Beginner" },
  casual: { depth: 6, movetimeMs: 450, elo: "Casual" },
  competitive: { depth: 8, movetimeMs: 750, elo: "Competitive" },
  expert: { depth: 10, movetimeMs: 1100, elo: "Expert" },
};

export class StockfishAiService implements AiService {
  constructor(private readonly createEngine: () => EngineClient = () => new StockfishEngineClient()) {}

  async chooseMove(state: ChessGameState, difficulty: AiDifficulty): Promise<AiMoveResult> {
    const fallback = legalRandomMove(state);

    if (state.status !== "active" || !fallback) {
      return { move: null, source: "fallback", message: "No legal AI move is available." };
    }

    let engine: EngineClient | null = null;

    try {
      engine = this.createEngine();
      const settings = difficultySettings[difficulty];
      const move = await engine.getBestMove(state.fen, {
        depth: settings.depth,
        movetimeMs: settings.movetimeMs,
        timeoutMs: Math.max(1600, settings.movetimeMs + 1800),
      });

      if (!isLegalMove(state, move)) {
        return { move: fallback, source: "fallback", message: "Stockfish returned an unusable move; fallback used." };
      }

      return { move, source: "stockfish", message: `Stockfish ${settings.elo} replied.` };
    } catch (error) {
      return {
        move: fallback,
        source: "fallback",
        message: error instanceof Error ? `AI fallback used: ${error.message}` : "AI fallback used.",
      };
    } finally {
      engine?.dispose();
    }
  }
}

function isLegalMove(state: ChessGameState, move: MoveInput): boolean {
  const chess = createChessFromState(state.fen, state.pgn);

  return chess
    .moves({ verbose: true })
    .some((legalMove) => legalMove.from === move.from && legalMove.to === move.to && (!legalMove.promotion || legalMove.promotion === move.promotion));
}
