# Codex Implementation Guide - Chess AI Coach Arena

## 1. Implementation Goal

Build **Chess AI Coach Arena**, a modern web application for playing chess online, training against AI and receiving post-game coaching. The target is an MVP that demonstrates the "Great" level from the assignment: multiplayer by link, AI opponent, AI Coach, social leaderboard, profiles, business layer and polished responsive UI.

The implementation should prioritize a working product over a broad but shallow demo. Every shipped feature must be usable, visually coherent and connected to the main product promise: play, learn, improve, compete.

## 2. Recommended Stack

Use this stack unless the repository already contains a different established stack:

- Frontend: Next.js, React, TypeScript.
- Styling: Tailwind CSS.
- Chess rules: `chess.js`.
- Board rendering: custom React board for full visual control; use `react-chessboard` only if speed is more important than custom animation.
- AI engine: Stockfish WASM or Stockfish running in a Web Worker.
- Backend, database, auth: Supabase.
- Realtime multiplayer: Supabase Realtime channels.
- Payments: Stripe-ready Pro UI placeholder for MVP; full Stripe checkout can be added later.
- Tests: Vitest or Jest for unit/component tests, Playwright for E2E.

Do not hand-roll chess rules. Use `chess.js` as the source of truth for legal moves, FEN, PGN and endgame status.

## 3. Product Modes

Implement these modes:

- `local`: two players on one screen.
- `friend`: online room by shareable link.
- `ai`: player vs Stockfish.
- `review`: replay and AI Coach report for completed games.

Each mode uses the same core game state model:

- current FEN;
- PGN/move history;
- active color;
- game status;
- captured pieces;
- timers where applicable;
- result when completed.

## 4. Public Types

Use these minimal TypeScript interfaces as the shared contract between UI, data layer and game services.

```ts
export type ChessColor = "white" | "black";

export type GameMode = "local" | "friend" | "ai";

export type GameStatus =
  | "waiting"
  | "active"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resigned"
  | "timeout"
  | "abandoned";

export type CoachClassification =
  | "best move"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export interface UserProfile {
  id: string;
  username: string;
  city: string;
  rating: number;
  avatarUrl: string | null;
  isPro: boolean;
}

export interface GameRecord {
  id: string;
  whiteId: string | null;
  blackId: string | null;
  pgn: string;
  finalFen: string;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  createdAt: string;
  durationSeconds: number;
}

export interface RoomClock {
  whiteSeconds: number;
  blackSeconds: number;
  incrementSeconds: number;
  lastTickAt: string | null;
}

export interface RoomState {
  id: string;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  fen: string;
  pgn: string;
  status: GameStatus;
  turn: ChessColor;
  clocks: RoomClock;
}

export interface CoachInsight {
  moveNumber: number;
  moveSan: string;
  classification: CoachClassification;
  explanation: string;
  bestMove: string;
  evalBefore: number;
  evalAfter: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  city: string;
  rating: number;
  wins: number;
  losses: number;
  rank: number;
}
```

## 5. Data Model

Use Supabase tables with this minimum shape.

### `profiles`

- `id`: uuid, primary key, references auth user.
- `username`: text, required.
- `city`: text, nullable until profile completion.
- `rating`: integer, default `1200`.
- `avatar_url`: text, nullable.
- `is_pro`: boolean, default `false`.
- `wins`: integer, default `0`.
- `losses`: integer, default `0`.
- `draws`: integer, default `0`.
- `current_streak`: integer, default `0`.
- `created_at`: timestamp.

### `rooms`

- `id`: text or uuid, primary key.
- `white_player_id`: uuid nullable.
- `black_player_id`: uuid nullable.
- `fen`: text.
- `pgn`: text.
- `status`: text.
- `turn`: text.
- `white_seconds`: integer.
- `black_seconds`: integer.
- `increment_seconds`: integer.
- `last_tick_at`: timestamp nullable.
- `created_at`: timestamp.
- `updated_at`: timestamp.

### `games`

- `id`: uuid, primary key.
- `white_id`: uuid nullable.
- `black_id`: uuid nullable.
- `mode`: text.
- `pgn`: text.
- `final_fen`: text.
- `result`: text.
- `duration_seconds`: integer.
- `analysis_summary`: jsonb nullable.
- `created_at`: timestamp.

### `coach_insights`

- `id`: uuid, primary key.
- `game_id`: uuid.
- `move_number`: integer.
- `move_san`: text.
- `classification`: text.
- `explanation`: text.
- `best_move`: text.
- `eval_before`: numeric.
- `eval_after`: numeric.
- `created_at`: timestamp.

Row-level security should allow users to read their own games and public leaderboard data. Multiplayer room write access must be restricted to the assigned room players.

## 6. Architecture

### Core Modules

- Game engine wrapper:
  - owns `chess.js` integration;
  - exposes legal moves, move execution, undo/replay helpers;
  - converts between FEN, PGN and UI board state.

- Board UI:
  - renders board and pieces;
  - handles drag/drop and click-to-move;
  - delegates move validation to the engine wrapper;
  - never mutates authoritative state directly.

- Multiplayer service:
  - creates rooms;
  - joins rooms;
  - syncs room state through Supabase Realtime;
  - prevents out-of-turn and wrong-color moves.

- AI service:
  - starts Stockfish worker;
  - requests best move for current FEN;
  - limits thinking time based on difficulty;
  - returns move in UCI/SAN-compatible format.

- Coach service:
  - replays completed PGN;
  - evaluates key positions;
  - classifies move quality;
  - generates concise explanations.

- Persistence service:
  - saves games;
  - loads history;
  - stores coach insights;
  - updates ratings and profile stats.

### State Ownership

- `chess.js` is the local rules authority.
- Supabase room row is the multiplayer authority.
- React state is only the rendering/cache layer.
- Completed game records are immutable except for adding analysis.

## 7. Build Phases

### Phase 1 - Chess Board and Rules

Implement:

- 8x8 board;
- pieces rendered from FEN;
- legal move validation through `chess.js`;
- drag/drop and click-to-move;
- legal move hints;
- last move highlight;
- check highlight;
- promotion modal;
- game-over detection.

Acceptance:

- illegal moves do not change state;
- castling, en passant and promotion work;
- checkmate and stalemate end the game.

### Phase 2 - Game Shell and Responsive UI

Implement:

- player cards;
- timers UI;
- move list;
- captured pieces;
- resign/rematch controls;
- dark/light/system theme;
- desktop layout with side panel;
- mobile layout with bottom sheets/tabs;
- reduced motion support.

Acceptance:

- desktop and mobile are both playable;
- text does not overlap;
- board remains square and stable;
- decorative animations respect reduced motion.

### Phase 3 - Auth, Profiles and Saved Games

Implement:

- Supabase auth;
- guest mode;
- profile creation;
- city field;
- rating and stats fields;
- save completed games;
- game history screen;
- replay from PGN.

Acceptance:

- guest can play without auth;
- authenticated user sees saved history;
- completed games store PGN, final FEN, result and duration.

### Phase 4 - Multiplayer Rooms by Link

Implement:

- create room;
- copy room link;
- join room by URL;
- assign white/black;
- synchronize moves in real time;
- reconnect to existing room;
- room status states;
- resign and abandoned handling.

Acceptance:

- first user creates a room;
- second user opens the link and gets the opposite color;
- both clients stay in sync after each move;
- reconnect restores current FEN and PGN;
- user cannot move opponent pieces.

### Phase 5 - Stockfish Opponent

Implement:

- Stockfish worker;
- difficulty settings;
- AI move selection;
- "AI thinking" state;
- timeout/fallback if engine is slow;
- save AI games to history.

Acceptance:

- AI only moves after the player makes a legal move;
- AI never makes illegal moves;
- UI remains responsive while engine thinks.

### Phase 6 - AI Coach Analysis

Implement:

- post-game analysis trigger;
- replay completed PGN;
- evaluate selected positions before/after moves;
- classify key moves;
- generate at least 3 insights;
- coach report screen;
- save insights to database.

Acceptance:

- every completed game can show a basic coach report;
- report includes best move, biggest mistake and main lesson;
- Pro UI offers deeper analysis.

### Phase 7 - Leaderboards, Pro UI and Polish

Implement:

- global leaderboard;
- city leaderboard;
- seasonal leaderboard placeholder;
- current user pinned row;
- Upgrade to Pro modal;
- premium skin picker UI;
- share card UI;
- achievement/rating milestone animation.

Acceptance:

- leaderboard displays ranked users;
- city filter works;
- Pro layer is visible and coherent;
- premium skins can be previewed even if checkout is deferred.

## 8. UI Requirements

### First Screen

The first screen must show the usable app:

- chess board or quick play panel;
- create friend room;
- play vs AI;
- local game;
- profile/progress preview;
- Upgrade to Pro entry point.

Do not build a generic marketing landing page as the primary experience.

### Desktop Game Layout

- Board centered and large.
- Player timer above and below board.
- Right panel with move list, captured pieces, game actions and coach preview.
- Header with profile, theme toggle and Pro button.
- Room link visible in multiplayer waiting state.

### Mobile Game Layout

- Board fills available width.
- Timers remain visible.
- Move list and coach panel move into bottom sheet or tabs.
- Buttons are large enough for touch.
- No text or panels overlap the board.

### Animations

Required:

- piece movement;
- legal move hint fade;
- last move highlight;
- check pulse;
- promotion modal transition;
- AI thinking indicator;
- coach insight reveal;
- skeleton loading;
- win/rating milestone confetti.

Implementation rule:

- all decorative animations must be disabled or simplified under `prefers-reduced-motion`.

## 9. AI Coach Rules

The MVP coach can use a practical approach:

1. Parse PGN into positions.
2. Evaluate positions with Stockfish at a fixed shallow depth or time budget.
3. Compare evaluation before and after the played move.
4. Classify the move by evaluation drop.
5. Ask Stockfish for the best alternative move.
6. Generate a short explanation from a template.

Suggested thresholds:

- `best move`: evaluation drop <= 20 centipawns and matches engine best move.
- `good`: drop <= 50 centipawns.
- `inaccuracy`: drop > 50 and <= 150 centipawns.
- `mistake`: drop > 150 and <= 300 centipawns.
- `blunder`: drop > 300 centipawns or forced mate swing.

Template examples:

- "This move gave up control of the center. A safer plan was `{bestMove}`."
- "The position was balanced, but `{moveSan}` allowed a tactic. `{bestMove}` kept the pressure."
- "Strong move. It improves your piece activity and keeps the king safe."

Keep explanations concise. Do not show raw engine complexity as the main content.

## 10. Rating and Leaderboards

Use a simple Elo-style update for MVP:

- default rating: `1200`;
- update only rated games;
- local games are unrated;
- friend and AI games can be marked rated/unrated;
- city leaderboard sorts by rating, then wins.

The leaderboard should support:

- global rank;
- city rank;
- season rank placeholder;
- current user highlighted/pinned.

## 11. Acceptance Criteria

The implementation is acceptable when:

- a player cannot make an illegal move;
- castling works only under legal conditions;
- en passant works only on the immediate next move;
- promotion asks the user to choose a piece;
- checkmate, stalemate, resignation and timeout end the game;
- a friend can join by room link and play the opposite color;
- room reconnect restores FEN, PGN, turn and clocks;
- authenticated users can see saved completed games;
- AI opponent makes legal moves without freezing the UI;
- AI Coach shows at least 3 useful post-game insights;
- desktop and mobile layouts are both playable;
- dark and light themes work;
- Upgrade to Pro and premium skins are visible;
- reduced motion disables decorative movement.

## 12. Test Plan

### Unit Tests

Test the game engine wrapper:

- legal pawn move;
- illegal piece move;
- move that exposes king is rejected;
- castling king side;
- castling queen side;
- blocked castling rejected;
- en passant;
- promotion;
- checkmate detection;
- stalemate detection.

### Component Tests

Test:

- board renders from FEN;
- selecting a piece shows legal hints;
- invalid target does not call move commit;
- promotion modal appears;
- move list updates after legal move;
- theme toggle changes visual state;
- Upgrade modal opens.

### E2E Tests

Use Playwright for:

- local game first legal move;
- illegal move blocked;
- promotion flow;
- known checkmate sequence;
- create multiplayer room;
- second browser joins room;
- move sync between two clients;
- reconnect restores room state;
- AI game produces AI response;
- completed game opens coach report.

### Manual QA

Check:

- desktop at 1440px and 1024px;
- mobile at 390px and 430px;
- dark/light themes;
- reduced motion;
- keyboard navigation for modals;
- no layout overlap in long usernames;
- slow network loading states;
- empty history and empty leaderboard states.

## 13. README Requirements

The final project must include a concise `README.md` before submission. It should explain:

- what was built;
- who the product is for;
- why it is valuable;
- key features;
- tech stack;
- setup instructions;
- environment variables;
- deployed link;
- GitHub repository link;
- known limitations;
- future improvements.

The README must explicitly state that the project is a startup-style chess learning platform, not just a chessboard.

## 14. Implementation Constraints

- Use TypeScript for app code.
- Keep chess rules centralized.
- Keep multiplayer state deterministic.
- Do not rely on client-only trust for multiplayer moves.
- Do not block gameplay on Pro/payment features.
- Do not make the first screen a marketing-only landing page.
- Prefer clear product polish over adding many unfinished features.
- Keep animations stable and avoid layout shifts.
- Make the app usable on mobile from the beginning.

## 15. Definition of Done

The project is ready for submission when:

- the app is deployed;
- the GitHub repository is public or shareable;
- README is complete;
- the core game works;
- at least one advanced differentiator works end to end: multiplayer by link or AI Coach;
- business layer is visible through Pro UI;
- visual design feels intentional and polished;
- tests or a documented manual QA checklist cover the critical flows.
