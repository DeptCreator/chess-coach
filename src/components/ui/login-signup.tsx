"use client";

import { Crown, Eye, EyeOff, KeyRound, LogIn, MapPin, ShieldCheck, Swords, User, UserPlus } from "lucide-react";
import { useState } from "react";
import type { AuthSession } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface LoginSignupProps {
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

export default function LoginSignup({
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
}: LoginSignupProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(true);
  const isSignup = mode === "signup";

  if (session) {
    return (
      <Card className="overflow-hidden border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur">
        <CardHeader className="space-y-4 p-4">
          <MahiruMark />
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Mahiru ID</p>
            <h2 className="text-xl font-semibold">Account active</h2>
            <p className="truncate text-sm text-muted-foreground">{session.email}</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 pb-4">
          {message ? <StatusMessage message={message} /> : null}
          <Button type="button" variant="outline" className="w-full" onClick={onSignOut} disabled={busy}>
            {busy ? "Working..." : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] pb-0 shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur">
      <CardHeader className="space-y-4 px-4 pb-4 pt-5">
        <MahiruMark />
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Mahiru ID</p>
          <h2 className="text-xl font-semibold">{isSignup ? "Create your player profile" : "Sign in to Mahiru"}</h2>
          <p className="text-sm text-muted-foreground">
            {isSignup ? "Save games, ratings, and friend rooms." : "Return to your board, history, and coach notes."}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--line)] bg-black/[0.12] p-1">
          <button type="button" className={modeClass(!isSignup)} onClick={() => onModeChange("signin")}>
            <LogIn size={15} aria-hidden />
            Login
          </button>
          <button type="button" className={modeClass(isSignup)} onClick={() => onModeChange("signup")}>
            <UserPlus size={15} aria-hidden />
            Register
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {isSignup ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="mahiru-role">Player style</Label>
                <Select defaultValue="tactician">
                  <SelectTrigger id="mahiru-role">
                    <SelectValue placeholder="Choose style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tactician">
                      <span className="flex items-center gap-2">
                        <Swords size={16} aria-hidden />
                        Tactician
                      </span>
                    </SelectItem>
                    <SelectItem value="guardian">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={16} aria-hidden />
                        Guardian
                      </span>
                    </SelectItem>
                    <SelectItem value="champion">
                      <span className="flex items-center gap-2">
                        <Crown size={16} aria-hidden />
                        Champion
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mahiru-username">Username</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="mahiru-username"
                      className="pl-9"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => onUsernameChange(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mahiru-city">City</Label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="mahiru-city"
                      className="pl-9"
                      autoComplete="address-level2"
                      value={city}
                      onChange={(event) => onCityChange(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="mahiru-email">Email address</Label>
            <Input
              id="mahiru-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mahiru-password">Password</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="mahiru-password"
                className="px-9"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full text-muted-foreground hover:bg-transparent"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {isSignup ? (
            <div className="flex items-start gap-2">
              <Checkbox id="mahiru-terms" checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} />
              <Label htmlFor="mahiru-terms" className="text-sm font-normal leading-5 text-muted-foreground">
                I agree to Mahiru fair play and account rules.
              </Label>
            </div>
          ) : null}

          {message ? <StatusMessage message={message} /> : null}

          <Button className="w-full font-semibold" type="submit" disabled={busy || (isSignup && !accepted)}>
            {busy ? "Working..." : isSignup ? "Create Mahiru ID" : "Enter arena"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="mt-4 justify-center border-t border-[var(--line)] px-4 !py-3">
        <button
          type="button"
          className="text-center text-sm text-muted-foreground transition hover:text-foreground"
          onClick={() => onModeChange(isSignup ? "signin" : "signup")}
        >
          {isSignup ? "Already have an account? Sign in" : "New to Mahiru? Create an account"}
        </button>
      </CardFooter>
    </Card>
  );
}

function MahiruMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-primary/35 bg-primary/[0.12] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
        <Swords size={22} aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-base font-semibold leading-5">Mahiru Arena</div>
        <div className="text-xs text-muted-foreground">Chess account</div>
      </div>
    </div>
  );
}

function StatusMessage({ message }: { message: string }) {
  return <div className="rounded-lg border border-[var(--line)] bg-black/[0.14] px-3 py-2 text-sm text-muted-foreground">{message}</div>;
}

function modeClass(active: boolean): string {
  return [
    "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold transition",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
  ].join(" ");
}
