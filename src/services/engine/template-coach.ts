import { Chess } from "chess.js";
import type { CoachClassification, CoachInsight, GameRecord } from "@/domain/types";

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
  const practiceFens = collectPracticeFens(game.pgn);

  if (moves.length === 0) {
    return fallbackInsights();
  }

  const selected = [
    moves[0],
    moves[Math.max(0, Math.floor(moves.length / 2))],
    moves[moves.length - 1],
  ];

  const insights = selected.map((move, index) => {
    const classification = move.captured
      ? "good"
      : move.san.includes("#")
        ? "best move"
        : classificationCycle[Math.min(index + 1, classificationCycle.length - 1)];
    const moveIndex = moves.indexOf(move);
    const practiceFen = practiceFens[moveIndex];

    return {
      moveNumber: Math.floor((moveIndex + 2) / 2),
      moveSan: move.san,
      classification,
      explanation: explanationFor(classification, move.san),
      bestMove: bestMoveForTemplateInsight(practiceFen, move.san),
      evalBefore: 20 - index * 40,
      evalAfter: classification === "blunder" ? -280 : 35 - index * 35,
      practiceFen,
    };
  });

  return ensurePracticeMistake(insights);
}

function collectPracticeFens(pgn: string): string[] {
  const source = new Chess();

  try {
    source.loadPgn(pgn);
  } catch {
    return [];
  }

  const moves = source.history({ verbose: true });
  const replay = new Chess();
  const fens: string[] = [];

  for (const move of moves) {
    fens.push(replay.fen());
    const applied = replay.move(move.san);

    if (!applied) {
      return [];
    }
  }

  return fens;
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

function ensurePracticeMistake(insights: CoachInsight[]): CoachInsight[] {
  if (insights.some((insight) => insight.practiceFen && (insight.classification === "mistake" || insight.classification === "blunder"))) {
    return insights;
  }

  const practiceIndex = insights.findIndex((insight) => insight.practiceFen && insight.classification !== "best move");

  if (practiceIndex < 0) {
    return insights;
  }

  return insights.map((insight, index) =>
    index === practiceIndex
      ? {
          ...insight,
          classification: "mistake",
          explanation: explanationFor("mistake", insight.moveSan),
          evalAfter: Math.min(insight.evalAfter, -120),
        }
      : insight,
  );
}

function bestMoveForTemplateInsight(fen: string | undefined, playedSan: string): string {
  if (!fen) {
    return playedSan;
  }

  const chess = new Chess(fen);
  const legalMoves = chess.moves();
  const preferred = ["e4", "d4", "Nf3", "Nc3", "c4", "e5", "d5", "Nf6", "Nc6", "c5"];
  const preferredMove = preferred.find((move) => legalMoves.includes(move) && move !== playedSan);

  return preferredMove ?? legalMoves.find((move) => move !== playedSan) ?? playedSan;
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
