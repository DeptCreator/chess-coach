"use client";

import { LogIn, LogOut, UserPlus } from "lucide-react";
import type { AuthSession } from "@/domain/types";

interface AuthPanelProps {
  session: AuthSession | null;
  mode: "signin" | "signup";
  email: string;
  password: string;
  username: string;
  city: string;
  busy: boolean;
  message: string | null;
  onModeChange(mode: "signin" | "signup"): void;
  onEmailChange(value: string): void;
  onPasswordChange(value: string): void;
  onUsernameChange(value: string): void;
  onCityChange(value: string): void;
  onSubmit(): void;
  onSignOut(): void;
}

export function AuthPanel({
  session,
  mode,
  email,
  password,
  username,
  city,
  busy,
  message,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onUsernameChange,
  onCityChange,
  onSubmit,
  onSignOut,
}: AuthPanelProps) {
  return (
    <section className="arena-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Account</div>
        {session ? <span className="rounded-[8px] bg-arena-teal/[0.12] px-2 py-1 text-xs font-semibold text-arena-teal">Signed in</span> : null}
      </div>

      {session ? (
        <div className="grid gap-3">
          <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 py-2 text-sm">
            <span className="block text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Email</span>
            <span className="block truncate font-semibold">{session.email}</span>
          </div>
          {message ? <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 py-2 text-sm text-[var(--muted)]">{message}</div> : null}
          <button
            type="button"
            className="arena-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[var(--line)] px-3 text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
            onClick={onSignOut}
            disabled={busy}
          >
            <LogOut size={15} aria-hidden />
            Sign out
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={modeButtonClass(mode === "signin")}
              onClick={() => onModeChange("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={modeButtonClass(mode === "signup")}
              onClick={() => onModeChange("signup")}
            >
              Register
            </button>
          </div>

          {mode === "signup" ? (
            <>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Username
                <input className="arena-input" value={username} onChange={(event) => onUsernameChange(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                City
                <input className="arena-input" value={city} onChange={(event) => onCityChange(event.target.value)} />
              </label>
            </>
          ) : null}

          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Email
            <input className="arena-input" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Password
            <input className="arena-input" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} />
          </label>

          {message ? <div className="rounded-[8px] border border-[var(--line)] bg-black/[0.14] px-3 py-2 text-sm text-[var(--muted)]">{message}</div> : null}

          <button
            type="button"
            className="arena-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-arena-teal px-3 text-sm font-semibold text-graphite-950 transition hover:brightness-105"
            onClick={onSubmit}
            disabled={busy}
          >
            {mode === "signup" ? <UserPlus size={15} aria-hidden /> : <LogIn size={15} aria-hidden />}
            {busy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>
      )}
    </section>
  );
}

function modeButtonClass(active: boolean): string {
  return [
    "arena-focus min-h-10 rounded-[8px] border px-3 text-sm font-semibold transition",
    active ? "border-arena-teal bg-arena-teal text-graphite-950" : "border-[var(--line)] bg-black/[0.12] text-[var(--muted)] hover:text-[var(--text)]",
  ].join(" ");
}
