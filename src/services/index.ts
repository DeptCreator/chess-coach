import type { AppServices } from "./contracts";
import { createDemoServices } from "./demo";
import { hasSupabaseEnv } from "./supabase/client";
import { createSupabaseServices } from "./supabase";

let browserServices: AppServices | null = null;

export function getAppServices(): AppServices {
  if (browserServices) {
    return browserServices;
  }

  browserServices = hasSupabaseEnv() ? createSupabaseServices() : createDemoServices();

  return browserServices;
}

export type {
  AppServices,
  AuthService,
  AiDifficulty,
  AiMoveResult,
  AiService,
  CoachService,
  FriendsService,
  GameService,
  IdentityService,
  ProfileService,
  RoomService,
  SaveGameInput,
  ServiceResult,
} from "./contracts";
