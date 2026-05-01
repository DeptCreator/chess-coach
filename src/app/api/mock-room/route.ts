import { NextResponse } from "next/server";
import type { Square } from "chess.js";
import type { MoveInput } from "@/domain/chess";
import type { RoomColorChoice, TimeControl } from "@/domain/types";
import { createMockServices } from "@/services/mock";
import { createMemoryStorage, type StorageLike } from "@/services/mock/storage";

interface MockRoomGlobal {
  storage?: StorageLike;
}

const globalStore = globalThis as typeof globalThis & { __arenaMockRooms?: MockRoomGlobal };

function getServices() {
  globalStore.__arenaMockRooms ??= {};
  globalStore.__arenaMockRooms.storage ??= createMemoryStorage();

  return createMockServices(globalStore.__arenaMockRooms.storage);
}

export async function POST(request: Request) {
  let payload: {
    action?: string;
    roomId?: string;
    playerId?: string | null;
    options?: { colorChoice?: RoomColorChoice; timeControl?: TimeControl };
    move?: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ data: null, error: "Invalid mock room request" }, { status: 400 });
  }

  const services = getServices();

  switch (payload.action) {
    case "create":
      return NextResponse.json(await services.rooms.createRoom(payload.playerId ?? null, {
        colorChoice: payload.options?.colorChoice ?? "white",
        timeControl: payload.options?.timeControl ?? "rapid",
      }));
    case "join":
      return NextResponse.json(await services.rooms.joinRoom(payload.roomId ?? "", payload.playerId ?? null));
    case "load":
      return NextResponse.json(await services.rooms.loadRoom(payload.roomId ?? ""));
    case "move":
      if (!payload.move) {
        return NextResponse.json({ data: null, error: "Move is required" }, { status: 400 });
      }

      return NextResponse.json(
        await services.rooms.submitMove(
          payload.roomId ?? "",
          payload.playerId ?? null,
          payload.move as MoveInput & { from: Square; to: Square },
        ),
      );
    case "resign":
      return NextResponse.json(await services.rooms.resign(payload.roomId ?? "", payload.playerId ?? null));
    default:
      return NextResponse.json({ data: null, error: "Unknown mock room action" }, { status: 400 });
  }
}
