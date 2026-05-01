"use client";

import type { Square } from "chess.js";
import { getBoardSquares, type BoardSquare as BoardSquareState, type MoveRecord } from "@/domain/chess";

interface ChessBoardProps {
  fen: string;
  selectedSquare: Square | null;
  legalTargets: Square[];
  lastMove: MoveRecord | null;
  checkSquare: Square | null;
  orientation?: "white" | "black";
  onSquareClick(square: Square): void;
}

export function ChessBoard({
  fen,
  selectedSquare,
  legalTargets,
  lastMove,
  checkSquare,
  orientation = "white",
  onSquareClick,
}: ChessBoardProps) {
  const squares = orientation === "black" ? [...getBoardSquares(fen)].reverse() : getBoardSquares(fen);

  return (
    <div className="chess-board-stage">
      <div
        className="grid aspect-square w-full max-w-[min(88vw,720px)] grid-cols-8 overflow-hidden rounded-[12px] border border-white/[0.16] bg-graphite-900 shadow-board"
        aria-label="Chess board"
        data-testid="chess-board"
      >
        {squares.map((square) => (
          <BoardSquare
            key={square.square}
            squareState={square}
            isSelected={selectedSquare === square.square}
            isLegalTarget={legalTargets.includes(square.square)}
            isLastMove={lastMove?.from === square.square || lastMove?.to === square.square}
            isCheck={checkSquare === square.square}
            orientation={orientation}
            onClick={() => onSquareClick(square.square)}
          />
        ))}
      </div>
    </div>
  );
}

interface BoardSquareProps {
  squareState: BoardSquareState;
  isSelected: boolean;
  isLegalTarget: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  orientation: "white" | "black";
  onClick(): void;
}

function BoardSquare({
  squareState,
  isSelected,
  isLegalTarget,
  isLastMove,
  isCheck,
  orientation,
  onClick,
}: BoardSquareProps) {
  const fileIndex = squareState.file.charCodeAt(0) - "a".charCodeAt(0);
  const rankIndex = Number(squareState.rank);
  const isLight = (fileIndex + rankIndex) % 2 === 1;

  return (
    <button
      type="button"
      aria-label={`${squareState.square}${squareState.piece ? ` ${squareState.piece.color} ${squareState.piece.type}` : ""}`}
      data-square={squareState.square}
      data-testid={`square-${squareState.square}`}
      onClick={onClick}
      className={[
        "arena-focus board-square relative flex aspect-square items-center justify-center overflow-hidden transition-colors",
        isLight ? "bg-[#d8c9a5]" : "bg-[#486d5b]",
        isSelected ? "ring-4 ring-inset ring-arena-teal" : "",
        isLastMove ? "last-move-highlight" : "",
        isCheck ? "king-check bg-arena-coral/80" : "",
      ].join(" ")}
    >
      {shouldShowRankLabel(squareState.file, orientation) ? (
        <span className="pointer-events-none absolute left-1 top-1 text-[10px] font-bold text-black/55">
          {squareState.rank}
        </span>
      ) : null}
      {shouldShowFileLabel(squareState.rank, orientation) ? (
        <span className="pointer-events-none absolute bottom-1 right-1 text-[10px] font-bold text-black/55">
          {squareState.file}
        </span>
      ) : null}
      {isLegalTarget ? (
        <span
          className={[
            "legal-move-hint pointer-events-none absolute rounded-full transition-opacity",
            squareState.piece ? "h-4/5 w-4/5 border-[5px] border-black/25" : "h-4 w-4 bg-black/[0.28]",
          ].join(" ")}
          data-testid={`hint-${squareState.square}`}
        />
      ) : null}
      {squareState.piece ? (
        <span
          className={[
            "chess-piece relative z-10 select-none text-[clamp(2rem,8vw,4.9rem)] leading-none drop-shadow-[0_7px_14px_rgba(0,0,0,0.42)] transition-transform",
            squareState.piece.color === "white" ? "text-stone-50" : "text-neutral-950",
            isSelected ? "scale-110" : "",
          ].join(" ")}
        >
          {squareState.piece.symbol}
        </span>
      ) : null}
    </button>
  );
}

function shouldShowRankLabel(file: string, orientation: "white" | "black") {
  return orientation === "white" ? file === "a" : file === "h";
}

function shouldShowFileLabel(rank: string, orientation: "white" | "black") {
  return orientation === "white" ? rank === "1" : rank === "8";
}
