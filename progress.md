Original prompt: PLEASE IMPLEMENT THIS PLAN: Backend-First Plan For Chess AI Coach Arena

## Progress

- Started a backend-first Next.js implementation from an empty repository.
- Added project config, Supabase migration, domain chess wrapper, service interfaces, mock/Supabase adapters, UI shell, and focused tests.
- `npm run build` passed. First `npm test` showed Vitest was collecting Playwright specs and JSX tests needed an explicit React import; fixing that now.
- `npm test`, `npm run test:e2e`, and `npm run build` passed after test config fixes.
- Visual check at 1440px desktop and 390px mobile showed stable board sizing and no obvious text/panel overlap.
- Restarted the dev server cleanly after build cache invalidation; final browser check had zero console errors.
- Final verification passed: `npm test`, `npm run build`, and `npm run test:e2e`.
- Found `next lint` prompted interactively; migrated lint script to `eslint .` with a flat ESLint config.
- Final dev server is running on `http://127.0.0.1:3000` with zero browser console errors after reload.
- Implemented friend-link multiplayer through `RoomService`: URL join, stable guest identity, color assignment, authoritative room-state rendering, wrong-turn/wrong-color move guards, and reconnect restore.
- Added a browser mock room adapter backed by a Next API route so two local browser contexts can share room state without Supabase credentials.
- Added Supabase Realtime room row subscriptions with cleanup and anonymous-auth identity fallback for guest room play.
- Expanded room unit tests and added Playwright two-context multiplayer sync/reconnect coverage.
- Added bundled Stockfish 18 lite worker assets and a UCI engine client with best-move, evaluation, timeout, and fallback behavior.
- Replaced deterministic AI replies with `AiService` difficulty-based Stockfish play and visible fallback status.
- Upgraded coach generation to engine-backed PGN replay/evaluation with template fallback.
- Added editable profile UI, service source display, history PGN previews, and mock profile persistence tests.
- Expanded unit/component/e2e coverage for AI, coach, profile persistence, and multiplayer.

## TODO

- Add auth/profile screens once Supabase credentials are available.
- Verify Supabase Realtime/auth manually against a configured project with anonymous auth and `rooms` Realtime enabled.
