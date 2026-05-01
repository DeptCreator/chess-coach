import { Chess } from "chess.js";
import type { CoachInsight, CoachClassification, GameRecord } from "@/domain/types";

const classificationCycle: CoachClassification[] = [
  "best move",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
];

export function createTemplateInsights(game: GameRecord): CoachInsight[] {
  const chess = new Chess();

  try {
    if (game.pgn.trim()) {
      chess.loadPgn(game.pgn);
    }
  } catch {
    return fallbackInsights();
  }

  const moves = chess.history({ verbose: true });

  if (moves.length === 0) {
    return fallbackInsights();
  }

  const selected = [
    moves[0],
    moves[Math.max(0, Math.floor(moves.length / 2))],
    moves[moves.length - 1],
  ];

  return selected.map((move, index) => {
    const classification = move.captured
      ? "good"
      : move.san.includes("#")
        ? "best move"
        : classificationCycle[Math.min(index + 1, classificationCycle.length - 1)];

    return {
      moveNumber: Math.floor((moves.indexOf(move) + 2) / 2),
      moveSan: move.san,
      classification,
      explanation: explanationFor(classification, move.san),
      bestMove: move.san,
      evalBefore: 20 - index * 40,
      evalAfter: classification === "blunder" ? -280 : 35 - index * 35,
    };
  });
}

function fallbackInsights(): CoachInsight[] {
  return [
    {
      moveNumber: 1,
      moveSan: "e4",
      classification: "good",
      explanation: "A central pawn move is a reliable way to open lines and develop quickly.",
      bestMove: "e4",
      evalBefore: 0,
      evalAfter: 20,
    },
    {
      moveNumber: 2,
      moveSan: "Nf3",
      classification: "best move",
      explanation: "Developing a knight improves activity and prepares castling.",
      bestMove: "Nf3",
      evalBefore: 15,
      evalAfter: 30,
    },
    {
      moveNumber: 3,
      moveSan: "Bc4",
      classification: "inaccuracy",
      explanation: "The idea is active, but checking king safety first would keep more control.",
      bestMove: "Be2",
      evalBefore: 25,
      evalAfter: -45,
    },
  ];
}

function explanationFor(classification: CoachClassification, san: string): string {
  switch (classification) {
    case "best move":
      return `Strong move. ${san} keeps your pieces active and protects the king.`;
    case "good":
      return `${san} improves the position without creating a clear weakness.`;
    case "inaccuracy":
      return `${san} is playable, but a quieter developing move would keep more control.`;
    case "mistake":
      return `${san} gives the opponent a useful tempo. Look for forcing replies first.`;
    case "blunder":
      return `${san} allows a tactic. Check captures, checks, and threats before committing.`;
  }
}
