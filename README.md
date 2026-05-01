# Chess AI Coach Arena

Chess AI Coach Arena is a startup-style chess learning platform, not just a chessboard. The product combines fast friend-link games, local play, Stockfish AI, post-game AI Coach insights, progress surfaces, a city leaderboard prototype, Pro monetization UI, and a premium 3D arena interface.

## Who It Is For

- Beginners who know the rules but need simple explanations after mistakes.
- Casual and intermediate players who want fast games with friends.
- Students and competitive players who care about progress, rating, streaks, and leaderboards.
- Users who want a polished chess experience that works on desktop and mobile.

## Why It Is Valuable

Most chess apps either focus only on playing or overwhelm users with engine notation. Chess AI Coach Arena turns every game into a short training loop: play quickly, save the result, review key mistakes, compare progress, and return for the next game. The Pro layer and premium skins show how the prototype can become a real service.

## Key Features

- Legal chess board powered by `chess.js`.
- Local two-player mode on one screen.
- Friend-link multiplayer with WebSocket sync and reconnect restore.
- Room setup before friend games:
  - choose White, Black, or Random;
  - choose Bullet 1+0, Blitz 5+0, or Rapid 10+0;
  - player-side board orientation so your pieces start at the bottom.
- Board flip control during play.
- Resignation flow with a clear in-game notice.
- Stockfish-backed AI opponent with selectable difficulty.
- AI Coach report with engine-backed insights and template fallback.
- Saved game history with PGN preview.
- Editable guest profile and rating display.
- Global/city-style leaderboard prototype.
- Light and dark themes.
- Upgrade to Pro modal for monetization:
  - deeper analysis;
  - premium skins;
  - unlimited archive;
  - watermark-free share cards.
- Premium responsive UI with a live Three.js/WebGL 3D arena background.
- Mobile-first layout with the board visible and playable on small screens.

## Tech Stack

- Next.js, React, TypeScript
- Tailwind CSS
- Three.js for the live 3D arena
- `chess.js` for legal chess rules
- Stockfish 18 lite WASM worker for AI play and coach analysis
- WebSocket room server for mock friend-link multiplayer
- Supabase-ready service adapter and SQL migration
- Local mock persistence for demo mode
- Vitest, Testing Library, and Playwright

## Setup

```bash
npm install
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Environment Variables

The app works without credentials using the mock local adapter.

To enable the Supabase adapter:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Run:

```bash
supabase/migrations/0001_initial_schema.sql
```

For guest friend-room play in Supabase mode, enable anonymous auth in the Supabase project.

## Scripts

```bash
npm run dev
npm run build
npm test
npm run lint
npm run test:e2e
```

## Quality Checks

Current verification:

- Unit/component tests: `41 passed`
- Playwright e2e tests: `10 passed`
- Build: passes with `next build`
- Lint: passes with `eslint`

The e2e suite covers local moves, AI response, friend room create/join/sync/reconnect, Pro modal, profile persistence, mobile layout, nonblank 3D canvas, reduced motion, board flip, time-control setup, side selection, and resignation notice.

## Screenshots

Local screenshot files are included for demo notes:

- `desktop-redesign.png`
- `mobile-redesign.png`

## Current Limitations

- Stripe checkout is represented by Pro-ready UI only.
- Supabase live mode requires real project credentials, the SQL migration, and Realtime enabled for the `rooms` table.
- AI Coach is a prototype: it uses engine-backed analysis where available and falls back to readable template insights.
- The leaderboard is a product prototype backed by mock/Supabase profile data, not a full ranked matchmaking system.

## Submission Notes

This project targets the "Great" level of the challenge:

- It is a web application, not a static board.
- It supports legal chess, local play, AI play, themes, and responsive UI.
- It includes friend-link multiplayer with WebSockets.
- It includes an AI Coach concept after games.
- It includes profile, history, leaderboard, and retention surfaces.
- It includes a visible Pro monetization path.
- It has a unique visual identity with a live 3D chess arena.

For final submission, provide:

1. A deployed project link.
2. A GitHub repository link.
3. This README as the short product description.
