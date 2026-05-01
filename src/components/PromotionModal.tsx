"use client";

import type { PromotionPiece } from "@/domain/chess";

interface PromotionModalProps {
  open: boolean;
  onChoose(piece: PromotionPiece): void;
  onCancel(): void;
}

const options: Array<{ value: PromotionPiece; label: string; symbol: string }> = [
  { value: "q", label: "Queen", symbol: "♕" },
  { value: "r", label: "Rook", symbol: "♖" },
  { value: "b", label: "Bishop", symbol: "♗" },
  { value: "n", label: "Knight", symbol: "♘" },
];

export function PromotionModal({ open, onChoose, onCancel }: PromotionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/[0.62] p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
    >
      <div className="modal-surface w-full max-w-sm p-5 shadow-2xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Promote pawn</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Choose the piece for the final square.</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="arena-focus rounded-[8px] border border-[var(--line)] bg-white/[0.07] px-2 py-4 text-center transition hover:border-arena-teal hover:bg-arena-teal/[0.14] hover:shadow-[0_12px_32px_rgba(39,199,163,0.16)]"
              onClick={() => onChoose(option.value)}
            >
              <span className="block text-4xl leading-none">{option.symbol}</span>
              <span className="mt-2 block text-xs text-[var(--muted)]">{option.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="arena-focus mt-4 min-h-10 w-full rounded-[8px] border border-[var(--line)] px-3 text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
