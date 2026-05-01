"use client";

import type { MoveRecord } from "@/domain/chess";

interface MoveListProps {
  moves: MoveRecord[];
}

export function MoveList({ moves }: MoveListProps) {
  const rows: Array<{ moveNumber: number; white?: string; black?: string }> = [];

  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      moveNumber: index / 2 + 1,
      white: moves[index]?.san,
      black: moves[index + 1]?.san,
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Moves</h2>
        <span className="rounded-[8px] bg-black/20 px-2 py-1 text-xs text-[var(--muted)]">{moves.length} plies</span>
      </div>
      <div className="max-h-56 overflow-auto rounded-[8px] border border-[var(--line)] bg-black/[0.12]">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[var(--muted)]">No moves yet.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row) => (
                <tr key={row.moveNumber} className="border-b border-white/[0.08] transition last:border-0 hover:bg-white/[0.04]">
                  <td className="w-10 px-3 py-2 text-[var(--muted)]">{row.moveNumber}.</td>
                  <td className="px-3 py-2 font-medium">{row.white}</td>
                  <td className="px-3 py-2 font-medium">{row.black}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
