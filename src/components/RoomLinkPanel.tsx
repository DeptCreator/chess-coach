"use client";

import { Copy, Link2, Loader2 } from "lucide-react";
import type { ChessColor, RoomColorChoice, RoomState, TimeControl } from "@/domain/types";

interface RoomLinkPanelProps {
  room: RoomState | null;
  creating: boolean;
  playerColor: ChessColor | null;
  colorChoice: RoomColorChoice;
  timeControl: TimeControl;
  onColorChoiceChange(value: RoomColorChoice): void;
  onTimeControlChange(value: TimeControl): void;
  onCreate(): void;
}

const colorChoices: Array<{ value: RoomColorChoice; label: string }> = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
  { value: "random", label: "Random" },
];

const timeControls: Array<{ value: TimeControl; label: string }> = [
  { value: "bullet", label: "Bullet 1+0" },
  { value: "blitz", label: "Blitz 5+0" },
  { value: "rapid", label: "Rapid 10+0" },
];

export function RoomLinkPanel({
  room,
  creating,
  onCreate,
  playerColor,
  colorChoice,
  timeControl,
  onColorChoiceChange,
  onTimeControlChange,
}: RoomLinkPanelProps) {
  const roomUrl =
    typeof window !== "undefined" && room ? `${window.location.origin}?room=${room.id}` : "";

  return (
    <section className="arena-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <Link2 size={17} className="text-arena-teal" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Friend Room</h2>
      </div>
      {room ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 py-2">
              <span className="block uppercase tracking-[0.14em] text-[var(--muted)]">Your side</span>
              <span className="mt-1 block font-semibold text-[var(--text)]">{playerColor ? capitalize(playerColor) : "Spectator"}</span>
            </div>
            <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 py-2">
              <span className="block uppercase tracking-[0.14em] text-[var(--muted)]">Clock</span>
              <span className="mt-1 block font-semibold text-[var(--text)]">{timeControlLabel(room.timeControl)}</span>
            </div>
          </div>
          <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.18] px-3 py-2 text-xs text-[var(--muted)]">
            <span className="block truncate" title={roomUrl}>
              {roomUrl}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted)]">{roomStatusLabel(room, playerColor)}</span>
            <button
              type="button"
              className="arena-focus inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-arena-teal px-3 text-sm font-semibold text-graphite-950 transition hover:brightness-105"
              onClick={() => navigator.clipboard?.writeText(roomUrl)}
            >
              <Copy size={15} aria-hidden />
              Copy
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Choose side</div>
            <div className="grid grid-cols-3 gap-2">
              {colorChoices.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={[
                    "arena-focus min-h-10 rounded-[8px] border px-2 text-sm font-semibold transition",
                    colorChoice === item.value
                      ? "border-arena-teal bg-arena-teal text-graphite-950"
                      : "border-[var(--line)] bg-black/[0.12] text-[var(--muted)] hover:text-[var(--text)]",
                  ].join(" ")}
                  onClick={() => onColorChoiceChange(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Time control
            <select
              className="arena-input"
              value={timeControl}
              onChange={(event) => onTimeControlChange(event.target.value as TimeControl)}
            >
              {timeControls.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="arena-focus inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-arena-teal px-3 text-sm font-semibold text-graphite-950 shadow-[0_14px_38px_rgba(39,199,163,0.18)] transition hover:brightness-105"
            onClick={onCreate}
            disabled={creating}
          >
            {creating ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Link2 size={16} aria-hidden />}
            Create Room
          </button>
        </div>
      )}
    </section>
  );
}

function roomStatusLabel(room: RoomState, playerColor: ChessColor | null): string {
  if (room.status === "waiting") {
    return playerColor === "white" ? "Waiting for black" : "Waiting for opponent";
  }

  if (room.status === "active" && playerColor) {
    return `${playerColor} to play`;
  }

  return room.status;
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function timeControlLabel(value: TimeControl): string {
  if (value === "bullet") {
    return "Bullet 1+0";
  }

  if (value === "blitz") {
    return "Blitz 5+0";
  }

  return "Rapid 10+0";
}
