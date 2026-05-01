"use client";

import { Crown, Sparkles, X } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose(): void;
}

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Upgrade to Pro">
      <div className="modal-surface w-full max-w-xl p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-[8px] border border-arena-gold/40 bg-arena-gold/[0.08] px-3 py-1 text-xs font-semibold text-arena-gold">
              <Crown size={14} aria-hidden />
              Pro Preview
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Deeper analysis, cleaner progress.</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Unlock full-game coach reports, premium boards, unlimited archive, and share cards without a watermark.
            </p>
          </div>
          <button type="button" className="arena-focus rounded-[8px] p-2 text-[var(--muted)] hover:bg-white/[0.08] hover:text-[var(--text)]" onClick={onClose}>
            <X size={18} aria-hidden />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {["Deep Coach", "Premium Skins", "Unlimited Archive"].map((item) => (
            <div key={item} className="rounded-[8px] border border-[var(--line)] bg-white/[0.045] p-3">
              <Sparkles size={16} className="mb-2 text-arena-gold" aria-hidden />
              <div className="text-sm font-semibold">{item}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="arena-focus mt-5 min-h-12 w-full rounded-[8px] bg-arena-gold px-4 text-sm font-bold text-graphite-950 shadow-[0_16px_42px_rgba(214,179,90,0.2)] transition hover:brightness-105"
        >
          Continue to checkout
        </button>
      </div>
    </div>
  );
}
