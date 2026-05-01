"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthSession } from "@/domain/types";
import { getAppServices, type AppServices } from "@/services";
import LoginSignup from "@/components/ui/login-signup";

export function AuthPage({ initialMode }: { initialMode: "signin" | "signup" }) {
  const router = useRouter();
  const [services] = useState<AppServices>(() => getAppServices());
  const [session, setSession] = useState<AuthSession | null>(null);
  const [mode, setMode] = useState(initialMode);
  const [draft, setDraft] = useState({
    email: "",
    password: "",
    username: "Guest Player",
    city: "Local",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    services.auth.getSession().then((result) => {
      if (mounted && result.data) {
        setSession(result.data);
        setDraft((current) => ({ ...current, email: result.data?.email ?? current.email }));
      }
    });

    return () => {
      mounted = false;
    };
  }, [services]);

  async function submit() {
    setBusy(true);
    setMessage(null);

    const result =
      mode === "signup"
        ? await services.auth.signUp(draft)
        : await services.auth.signIn({ email: draft.email, password: draft.password });

    setBusy(false);

    if (!result.data) {
      setMessage(result.error ?? "Authentication failed.");
      return;
    }

    setSession(result.data);
    setMessage(mode === "signup" ? "Account created." : "Signed in.");
    router.push("/");
  }

  async function signOut() {
    setBusy(true);
    await services.auth.signOut();
    setBusy(false);
    setSession(null);
    setMessage("Signed out.");
  }

  return (
    <main className="min-h-svh px-3 py-4 sm:px-5 lg:px-7">
      <div className="mx-auto grid min-h-[calc(100svh-2rem)] max-w-[1120px] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          <Link className="arena-focus inline-flex min-h-10 items-center rounded-[8px] border border-[var(--line)] px-3 text-sm text-[var(--muted)] transition hover:text-[var(--text)]" href="/">
            Back to board
          </Link>
          <div className="mt-8 max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-arena-teal">Mahiru Arena</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              {mode === "signup" ? "Create your chess identity" : "Return to your arena"}
            </h1>
            <p className="mt-4 text-base text-[var(--muted)]">
              Guest games stay on this device. An account keeps your profile, friends, and game history available across sessions.
            </p>
          </div>
        </section>

        <LoginSignup
          session={session}
          mode={mode}
          email={draft.email}
          password={draft.password}
          username={draft.username}
          city={draft.city}
          busy={busy}
          message={message}
          onModeChange={setMode}
          onEmailChange={(value) => setDraft((current) => ({ ...current, email: value }))}
          onPasswordChange={(value) => setDraft((current) => ({ ...current, password: value }))}
          onUsernameChange={(value) => setDraft((current) => ({ ...current, username: value }))}
          onCityChange={(value) => setDraft((current) => ({ ...current, city: value }))}
          onSubmit={submit}
          onSignOut={signOut}
        />
      </div>
    </main>
  );
}
