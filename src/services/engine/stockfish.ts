import type { MoveInput } from "@/domain/chess";
import { parseBestMove, parseEvaluation, type ParsedEvaluation } from "./uci";

export interface EngineSearchOptions {
  depth?: number;
  movetimeMs?: number;
  timeoutMs?: number;
}

export interface EngineClient {
  getBestMove(fen: string, options?: EngineSearchOptions): Promise<MoveInput>;
  evaluatePosition(fen: string, options?: EngineSearchOptions): Promise<ParsedEvaluation>;
  dispose(): void;
}

const defaultTimeoutMs = 3500;
const workerUrl = "/stockfish/stockfish-18-lite-single.js#/stockfish/stockfish-18-lite-single.wasm,worker";

export class StockfishEngineClient implements EngineClient {
  private readonly worker: Worker;
  private ready: Promise<void>;
  private queue = Promise.resolve();

  constructor() {
    if (typeof Worker === "undefined") {
      throw new Error("Stockfish worker is not available in this environment");
    }

    this.worker = new Worker(workerUrl);
    this.ready = this.initialize();
  }

  async getBestMove(fen: string, options: EngineSearchOptions = {}): Promise<MoveInput> {
    return this.enqueue(async () => {
      const lines = await this.search(fen, options);
      const bestMove = parseBestMove(lines.find((line) => line.startsWith("bestmove")) ?? "");

      if (!bestMove) {
        throw new Error("Stockfish did not return a legal best move");
      }

      return bestMove;
    });
  }

  async evaluatePosition(fen: string, options: EngineSearchOptions = {}): Promise<ParsedEvaluation> {
    return this.enqueue(async () => {
      const lines = await this.search(fen, options);
      const evaluation = parseEvaluation(lines);

      if (!evaluation) {
        throw new Error("Stockfish did not return an evaluation");
      }

      return evaluation;
    });
  }

  dispose(): void {
    this.worker.postMessage("quit");
    this.worker.terminate();
  }

  private async initialize(): Promise<void> {
    this.worker.postMessage("uci");
    await this.waitFor((line) => line === "uciok", defaultTimeoutMs);
    this.worker.postMessage("isready");
    await this.waitFor((line) => line === "readyok", defaultTimeoutMs);
    this.worker.postMessage("setoption name UCI_LimitStrength value true");
    this.worker.postMessage("setoption name UCI_Elo value 1350");
  }

  private async search(fen: string, options: EngineSearchOptions): Promise<string[]> {
    await this.ready;

    const lines: string[] = [];
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const command = options.movetimeMs
      ? `go movetime ${options.movetimeMs}`
      : `go depth ${options.depth ?? 8}`;

    this.worker.postMessage("ucinewgame");
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(command);

    await this.waitFor(
      (line) => {
        lines.push(line);
        return line.startsWith("bestmove");
      },
      timeoutMs,
    );

    return lines;
  }

  private waitFor(predicate: (line: string) => boolean, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Stockfish timed out"));
      }, timeoutMs);

      const onMessage = (event: MessageEvent<string>) => {
        const line = String(event.data);

        if (predicate(line)) {
          cleanup();
          resolve();
        }
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        this.worker.removeEventListener("message", onMessage);
      };

      this.worker.addEventListener("message", onMessage);
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );

    return next;
  }
}
