import type { Square } from "chess.js";
import type { MoveInput, PromotionPiece } from "@/domain/chess";

export interface ParsedEvaluation {
  centipawns: number;
  mate: number | null;
}

export function parseBestMove(line: string): MoveInput | null {
  const match = /^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line.trim());

  if (!match) {
    return null;
  }

  return uciToMoveInput(match[1]);
}

export function parseEvaluation(lines: string[]): ParsedEvaluation | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const cpMatch = /\bscore cp (-?\d+)/.exec(line);

    if (cpMatch) {
      return { centipawns: Number(cpMatch[1]), mate: null };
    }

    const mateMatch = /\bscore mate (-?\d+)/.exec(line);

    if (mateMatch) {
      const mate = Number(mateMatch[1]);
      return { centipawns: mate > 0 ? 100000 - mate : -100000 - mate, mate };
    }
  }

  return null;
}

export function uciToMoveInput(uci: string): MoveInput | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return null;
  }

  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci[4] as PromotionPiece | undefined,
  };
}
