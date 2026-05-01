import type { AuthSession } from "@/domain/types";
import LoginSignup from "@/components/ui/login-signup";

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
    <LoginSignup
      session={session}
      mode={mode}
      email={email}
      password={password}
      username={username}
      city={city}
      busy={busy}
      message={message}
      onModeChange={onModeChange}
      onEmailChange={onEmailChange}
      onPasswordChange={onPasswordChange}
      onUsernameChange={onUsernameChange}
      onCityChange={onCityChange}
      onSubmit={onSubmit}
      onSignOut={onSignOut}
    />
  );
}
