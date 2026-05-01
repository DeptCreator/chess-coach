import type { GameRecord } from "@/domain/types";
import type { GameService, SaveGameInput, ServiceResult } from "./contracts";

const historyKey = "mahiru:device-history:v1";

export function createDeviceGameService(): GameService {
  return new DeviceGameService();
}

class DeviceGameService implements GameService {
  async saveCompletedGame(input: SaveGameInput): Promise<ServiceResult<GameRecord>> {
    const record: GameRecord = {
      id: createClientId("device-game"),
      whiteId: input.whiteId,
      blackId: input.blackId,
      pgn: input.pgn,
      finalFen: input.finalFen,
      result: input.result,
      durationSeconds: input.durationSeconds,
      createdAt: new Date().toISOString(),
    };
    const history = [record, ...readHistory()].slice(0, 50);
    writeHistory(history);

    return ok(record);
  }

  async listHistory(): Promise<ServiceResult<GameRecord[]>> {
    return ok(readHistory());
  }

  async loadReplay(gameId: string): Promise<ServiceResult<GameRecord>> {
    const record = readHistory().find((item) => item.id === gameId);
    return record ? ok(record) : fail("Game not found on this device.");
  }
}

function readHistory(): GameRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(historyKey);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as GameRecord[];
  } catch {
    return [];
  }
}

function writeHistory(history: GameRecord[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(historyKey, JSON.stringify(history));
}

function createClientId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}-${random}`;
}

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): ServiceResult<T> {
  return { data: null, error };
}
