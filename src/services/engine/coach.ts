import { Chess, type Move } from "chess.js";
import type { CoachClassification, CoachInsight, GameRecord } from "@/domain/types";
import { createTemplateInsights } from "./template-coach";
import { StockfishEngineClient, type EngineClient } from "./stockfish";

interface ReplayPoint {
  index: number;
  moveNumber: number;
  move: Move;
  beforeFen: string;
  afterFen: string;
}

interface AnalyzedPoint {
  point: ReplayPoint;
  insight: CoachInsight;
  drop: number;
}

const coachSearchOptions = { depth: 6, movetimeMs: 350, timeoutMs: 2200 };
const maxCandidatePoints = 8;
const maxInsights = 5;

export async function createEngineCoachInsights(
  game: GameRecord,
  createEngine: () => EngineClient = () => new StockfishEngineClient(),
): Promise<CoachInsight[]> {
  const points = replayGame(game.pgn);

  if (points.length === 0) {
    return createTemplateInsights(game);
  }

  let engine: EngineClient | null = null;

  try {
    engine = createEngine();
    const candidates = selectCandidatePoints(points);
    const analyzed: AnalyzedPoint[] = [];

    for (const point of candidates) {
      analyzed.push(await analyzePoint(engine, point));
    }

    return selectInsights(analyzed);
  } catch {
    return createTemplateInsights(game);
  } finally {
    engine?.dispose();
  }
}

export function classifyDrop(
  drop: number,
  san: string,
  bestMove: { from: string; to: string; promotion?: string },
  playedMove?: { from: string; to: string; promotion?: string },
): CoachClassification {
  const matchedBest =
    Boolean(playedMove) &&
    playedMove?.from === bestMove.from &&
    playedMove?.to === bestMove.to &&
    (!bestMove.promotion || playedMove?.promotion === bestMove.promotion);

  if (drop <= 20 && (matchedBest || san.includes("#"))) {
    return "best move";
  }

  if (drop <= 50) {
    return "good";
  }

  if (drop <= 150) {
    return "inaccuracy";
  }

  if (drop <= 300) {
    return "mistake";
  }

  return "blunder";
}

function replayGame(pgn: string): ReplayPoint[] {
  const source = new Chess();

  try {
    source.loadPgn(pgn);
  } catch {
    return [];
  }

  const moves = source.history({ verbose: true });
  const replay = new Chess();
  const points: ReplayPoint[] = [];

  for (const move of moves) {
    const beforeFen = replay.fen();
    const applied = replay.move(move.san);

    if (!applied) {
      return [];
    }

    points.push({
      index: points.length,
      moveNumber: Math.floor((points.length + 2) / 2),
      move,
      beforeFen,
      afterFen: replay.fen(),
    });
  }

  return points;
}

async function analyzePoint(engine: EngineClient, point: ReplayPoint): Promise<AnalyzedPoint> {
  const [before, after, bestMove] = await Promise.all([
    engine.evaluatePosition(point.beforeFen, coachSearchOptions),
    engine.evaluatePosition(point.afterFen, coachSearchOptions),
    engine.getBestMove(point.beforeFen, coachSearchOptions),
  ]);
  const evalBefore = before.centipawns;
  const evalAfter = -after.centipawns;
  const drop = evalBefore - evalAfter;
  const classification = classifyDrop(drop, point.move.san, bestMove, point.move);
  const bestMoveUci = bestMove.from + bestMove.to + (bestMove.promotion ?? "");

  return {
    point,
    drop,
    insight: {
      moveNumber: point.moveNumber,
      moveSan: point.move.san,
      classification,
      explanation: explanationFor(classification, point.move.san, bestMoveUci),
      bestMove: bestMoveUci,
      evalBefore,
      evalAfter,
      practiceFen: point.beforeFen,
    },
  };
}

function selectCandidatePoints(points: ReplayPoint[]): ReplayPoint[] {
  if (points.length <= maxCandidatePoints) {
    return points;
  }

  const indexes = new Set<number>();
  const add = (index: number) => indexes.add(Math.max(0, Math.min(points.length - 1, index)));

  add(0);
  add(1);
  add(Math.floor(points.length * 0.25));
  add(Math.floor(points.length * 0.5));
  add(Math.floor(points.length * 0.75));
  add(points.length - 3);
  add(points.length - 2);
  add(points.length - 1);

  return [...indexes]
    .sort((a, b) => a - b)
    .slice(0, maxCandidatePoints)
    .map((index) => points[index]);
}

function selectInsights(analyzed: AnalyzedPoint[]): CoachInsight[] {
  if (analyzed.length <= 3) {
    return analyzed.map((item) => item.insight);
  }

  const selected = new Map<number, AnalyzedPoint>();
  const add = (item: AnalyzedPoint | undefined) => {
    if (item) {
      selected.set(item.point.index, item);
    }
  };

  const chronological = [...analyzed].sort((a, b) => a.point.index - b.point.index);
  const swingRanked = [...analyzed].sort((a, b) => Math.abs(b.drop) - Math.abs(a.drop));

  add(chronological[0]);
  add(chronological.at(-1));

  for (const item of swingRanked) {
    add(item);
    if (selected.size >= Math.min(maxInsights, analyzed.length)) {
      break;
    }
  }

  return [...selected.values()]
    .sort((a, b) => a.point.index - b.point.index)
    .map((item) => item.insight);
}

function explanationFor(classification: CoachClassification, san: string, bestMove: string): string {
  switch (classification) {
    case "best move":
      return `${san} matched the engine idea and kept the initiative.`;
    case "good":
      return `${san} keeps the position healthy. The engine also liked ${bestMove}.`;
    case "inaccuracy":
      return `${san} is playable, but ${bestMove} preserved more control.`;
    case "mistake":
      return `${san} gave up a clear tempo. ${bestMove} was a safer engine line.`;
    case "blunder":
      return `${san} allowed a major swing. Check forcing replies such as ${bestMove}.`;
  }
}
