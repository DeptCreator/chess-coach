import type { AppServices } from "./contracts";
import { createBrowserMockServices, createMockServices } from "./mock";
import { hasSupabaseEnv } from "./supabase/client";
import { createSupabaseServices } from "./supabase";

let browserServices: AppServices | null = null;

export function getAppServices(): AppServices {
  if (browserServices) {
    return browserServices;
  }

  const mockServices =
    process.env.NODE_ENV === "test" ? createMockServices() : createBrowserMockServices();
  browserServices = hasSupabaseEnv() ? createSupabaseServices() : mockServices;

  return browserServices;
}

export type {
  AppServices,
  AuthService,
  AiDifficulty,
  AiMoveResult,
  AiService,
  CoachService,
  GameService,
  IdentityService,
  ProfileService,
  RoomService,
  SaveGameInput,
  ServiceResult,
} from "./contracts";
