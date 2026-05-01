import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";
import { Chess } from "chess.js";

const args = process.argv.slice(2);
const port = Number(readArg("--port") ?? process.env.PORT ?? 3000);
const hostname = readArg("--hostname") ?? process.env.HOSTNAME ?? "127.0.0.1";
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const rooms = new Map();
const subscribers = new Map();

await app.prepare();

const server = createServer((request, response) => {
  handle(request, response);
});
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url ?? "", `http://${request.headers.host}`);

  if (pathname !== "/ws/rooms") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let message;

    try {
      message = JSON.parse(String(raw));
    } catch {
      send(ws, { type: "error", error: "Invalid WebSocket message" });
      return;
    }

    const result = handleRoomMessage(ws, message);
    if (message.requestId) {
      send(ws, { type: "response", requestId: message.requestId, result });
    }
  });

  ws.on("close", () => {
    for (const clients of subscribers.values()) {
      clients.delete(ws);
    }
  });
});

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
  console.log(`> Room WebSocket ready on ws://${hostname}:${port}/ws/rooms`);
});

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function handleRoomMessage(ws, message) {
  switch (message.action) {
    case "create":
      return createRoom(message.playerId ?? null, message.options);
    case "join":
      return joinRoom(message.roomId ?? "", message.playerId ?? null);
    case "load":
      return loadRoom(message.roomId ?? "");
    case "move":
      return submitMove(message.roomId ?? "", message.playerId ?? null, message.move);
    case "resign":
      return resign(message.roomId ?? "", message.playerId ?? null);
    case "subscribe":
      return subscribe(ws, message.roomId ?? "");
    default:
      return fail("Unknown room action");
  }
}

function createRoom(playerId, options = {}) {
  const chess = new Chess();
  const id = `room-${randomUUID()}`;
  const colorChoice = ["white", "black", "random"].includes(options.colorChoice) ? options.colorChoice : "white";
  const timeControl = ["bullet", "blitz", "rapid"].includes(options.timeControl) ? options.timeControl : "rapid";
  const hostColor = colorChoice === "random" ? (Math.random() >= 0.5 ? "white" : "black") : colorChoice;
  const seconds = timeControl === "bullet" ? 60 : timeControl === "blitz" ? 300 : 600;
  const room = {
    id,
    whitePlayerId: hostColor === "white" ? playerId : null,
    blackPlayerId: hostColor === "black" ? playerId : null,
    hostColor,
    timeControl,
    fen: chess.fen(),
    pgn: "",
    status: "waiting",
    turn: "white",
    clocks: {
      whiteSeconds: seconds,
      blackSeconds: seconds,
      incrementSeconds: 0,
      lastTickAt: null,
    },
  };

  rooms.set(id, room);
  broadcast(room);

  return ok(room);
}

function joinRoom(roomId, playerId) {
  const room = rooms.get(roomId);

  if (!room) {
    return fail("Room not found");
  }

  const actorId = playerId ?? `guest-${randomUUID()}`;

  if (room.whitePlayerId !== actorId && room.blackPlayerId !== actorId) {
    if (!room.whitePlayerId) {
      room.whitePlayerId = actorId;
    } else if (!room.blackPlayerId) {
      room.blackPlayerId = actorId;
    } else {
      return fail("Room is full");
    }
  }

  if (room.whitePlayerId && room.blackPlayerId && room.status === "waiting") {
    room.status = "active";
  }

  rooms.set(roomId, room);
  broadcast(room);

  return ok(room);
}

function loadRoom(roomId) {
  const room = rooms.get(roomId);
  return room ? ok(room) : fail("Room not found");
}

function subscribe(ws, roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return fail("Room not found");
  }

  if (!subscribers.has(roomId)) {
    subscribers.set(roomId, new Set());
  }
  subscribers.get(roomId).add(ws);
  send(ws, { type: "room", room });

  return ok(room);
}

function submitMove(roomId, playerId, move) {
  const room = rooms.get(roomId);

  if (!room) {
    return fail("Room not found");
  }

  if (room.status !== "active") {
    return fail("Room is not active");
  }

  const actorColor = room.whitePlayerId === playerId ? "white" : room.blackPlayerId === playerId ? "black" : null;

  if (!actorColor) {
    return fail("Player is not assigned to this room");
  }

  if (actorColor !== room.turn) {
    return fail("It is not this player's turn");
  }

  const chess = chessFromRoom(room);
  const piece = chess.get(move?.from);

  if (!piece || (piece.color === "w" ? "white" : "black") !== actorColor) {
    return fail("Player cannot move opponent pieces");
  }

  let applied;

  try {
    applied = chess.move(move);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Illegal move");
  }

  if (!applied) {
    return fail("Illegal move");
  }

  const updated = {
    ...room,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn() === "w" ? "white" : "black",
    status: gameStatus(chess),
    clocks: {
      ...room.clocks,
      lastTickAt: new Date().toISOString(),
    },
  };
  rooms.set(roomId, updated);
  broadcast(updated);

  return ok(updated);
}

function resign(roomId, playerId) {
  const room = rooms.get(roomId);

  if (!room) {
    return fail("Room not found");
  }

  if (room.whitePlayerId !== playerId && room.blackPlayerId !== playerId) {
    return fail("Player is not assigned to this room");
  }

  const updated = {
    ...room,
    status: "resigned",
    turn: room.turn === "white" ? "black" : "white",
    resignedBy: room.whitePlayerId === playerId ? "white" : "black",
  };
  rooms.set(roomId, updated);
  broadcast(updated);

  return ok(updated);
}

function chessFromRoom(room) {
  if (!room.pgn?.trim()) {
    return new Chess(room.fen);
  }

  const chess = new Chess();
  chess.loadPgn(room.pgn);
  return chess;
}

function gameStatus(chess) {
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

function broadcast(room) {
  const clients = subscribers.get(room.id);

  if (!clients) {
    return;
  }

  for (const client of clients) {
    send(client, { type: "room", room });
  }
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function ok(data) {
  return { data, error: null };
}

function fail(error) {
  return { data: null, error };
}
