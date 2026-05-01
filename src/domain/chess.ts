import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import type { ChessColor, GameStatus } from "./types";

export type PromotionPiece = "q" | "r" | "b" | "n";

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export interface MoveRecord {
  from: Square;
  to: Square;
  san: string;
  color: ChessColor;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
}

export interface ChessGameState {
  fen: string;
  pgn: string;
  turn: ChessColor;
  status: GameStatus;
  lastMove: MoveRecord | null;
  moves: MoveRecord[];
}

export interface BoardPiece {
  color: ChessColor;
  type: PieceSymbol;
  symbol: string;
}

export interface BoardSquare {
  square: Square;
  file: string;
  rank: string;
  piece: BoardPiece | null;
}

export interface MoveResult {
  ok: boolean;
  state: ChessGameState;
  move: MoveRecord | null;
  error?: string;
}

const pieceSymbols: Record<`${"w" | "b"}${PieceSymbol}`, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};

export const initialFen = new Chess().fen();

export function createInitialGame(): ChessGameState {
  return snapshotFromChess(new Chess());
}

export function colorFromTurn(turn: "w" | "b"): ChessColor {
  return turn === "w" ? "white" : "black";
}

export function oppositeColor(color: ChessColor): ChessColor {
  return color === "white" ? "black" : "white";
}

export function createChessFromState(fen: string, pgn?: string): Chess {
  if (!pgn?.trim()) {
    return new Chess(fen);
  }

  const chess = new Chess();
  chess.loadPgn(pgn);
  return chess;
}

export function snapshotFromChess(chess: Chess): ChessGameState {
  const history = chess.history({ verbose: true }).map(toMoveRecord);

  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: colorFromTurn(chess.turn()),
    status: getGameStatus(chess),
    lastMove: history.at(-1) ?? null,
    moves: history,
  };
}

export function applyMove(
  current: Pick<ChessGameState, "fen" | "pgn">,
  input: MoveInput,
): MoveResult {
  const chess = createChessFromState(current.fen, current.pgn);
  const previous = snapshotFromChess(chess);

  try {
    const move = chess.move(input);

    if (!move) {
      return {
        ok: false,
        state: previous,
        move: null,
        error: "Illegal move",
      };
    }

    return {
      ok: true,
      state: snapshotFromChess(chess),
      move: toMoveRecord(move),
    };
  } catch (error) {
    return {
      ok: false,
      state: previous,
      move: null,
      error: error instanceof Error ? error.message : "Illegal move",
    };
  }
}

export function getGameStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) {
    return "checkmate";
  }

  if (chess.isStalemate()) {
    return "stalemate";
  }

  if (chess.isDraw()) {
    return "draw";
  }

  return "active";
}

export function getBoardSquares(fen: string): BoardSquare[] {
  const chess = new Chess(fen);

  return chess.board().flatMap((rank, rankIndex) =>
    rank.map((piece, fileIndex) => {
      const file = String.fromCharCode("a".charCodeAt(0) + fileIndex);
      const rankLabel = String(8 - rankIndex);
      const square = `${file}${rankLabel}` as Square;

      return {
        square,
        file,
        rank: rankLabel,
        piece: piece
          ? {
              color: piece.color === "w" ? "white" : "black",
              type: piece.type,
              symbol: pieceSymbols[`${piece.color}${piece.type}`],
            }
          : null,
      };
    }),
  );
}

export function getLegalMovesForSquare(
  state: Pick<ChessGameState, "fen" | "pgn">,
  square: Square,
): MoveInput[] {
  const chess = createChessFromState(state.fen, state.pgn);

  return chess.moves({ square, verbose: true }).map((move) => ({
    from: move.from,
    to: move.to,
    promotion: move.promotion as PromotionPiece | undefined,
  }));
}

export function getPieceAt(fen: string, square: Square): BoardPiece | null {
  const chess = new Chess(fen);
  const piece = chess.get(square);

  if (!piece) {
    return null;
  }

  return {
    color: piece.color === "w" ? "white" : "black",
    type: piece.type,
    symbol: pieceSymbols[`${piece.color}${piece.type}`],
  };
}

export function isPromotionMove(
  state: Pick<ChessGameState, "fen" | "pgn">,
  from: Square,
  to: Square,
): boolean {
  const chess = createChessFromState(state.fen, state.pgn);

  return chess
    .moves({ square: from, verbose: true })
    .some((move) => move.from === from && move.to === to && move.flags.includes("p"));
}

export function getCheckSquare(fen: string): Square | null {
  const chess = new Chess(fen);

  if (!chess.isCheck()) {
    return null;
  }

  const turn = chess.turn();

  for (const square of getBoardSquares(fen)) {
    const piece = square.piece;

    if (piece?.type === "k" && (piece.color === "white" ? "w" : "b") === turn) {
      return square.square;
    }
  }

  return null;
}

export function getCapturedPieces(moves: MoveRecord[]): Record<ChessColor, PieceSymbol[]> {
  return moves.reduce<Record<ChessColor, PieceSymbol[]>>(
    (captured, move) => {
      if (move.captured) {
        captured[move.color].push(move.captured);
      }

      return captured;
    },
    { white: [], black: [] },
  );
}

export function resultFromState(state: ChessGameState): "1-0" | "0-1" | "1/2-1/2" | "*" {
  if (state.status === "checkmate") {
    return state.turn === "white" ? "0-1" : "1-0";
  }

  if (state.status === "stalemate" || state.status === "draw") {
    return "1/2-1/2";
  }

  return "*";
}

export function legalRandomMove(state: ChessGameState): MoveInput | null {
  const chess = createChessFromState(state.fen, state.pgn);
  const moves = chess.moves({ verbose: true });

  if (moves.length === 0) {
    return null;
  }

  const scored = moves.map((move) => ({
    move,
    score: (move.captured ? 30 : 0) + (move.san.includes("+") ? 10 : 0) + move.san.length,
  }));
  scored.sort((a, b) => b.score - a.score || a.move.san.localeCompare(b.move.san));

  const selected = scored[0].move;

  return {
    from: selected.from,
    to: selected.to,
    promotion: (selected.promotion as PromotionPiece | undefined) ?? "q",
  };
}

function toMoveRecord(move: Move): MoveRecord {
  return {
    from: move.from,
    to: move.to,
    san: move.san,
    color: move.color === "w" ? "white" : "black",
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
  };
}
