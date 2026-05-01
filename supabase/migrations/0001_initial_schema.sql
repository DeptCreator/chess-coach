create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  city text,
  rating integer not null default 1200,
  avatar_url text,
  is_pro boolean not null default false,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  current_streak integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  white_player_id uuid references auth.users(id) on delete set null,
  black_player_id uuid references auth.users(id) on delete set null,
  fen text not null,
  pgn text not null default '',
  status text not null,
  turn text not null,
  white_seconds integer not null default 600,
  black_seconds integer not null default 600,
  increment_seconds integer not null default 0,
  last_tick_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_status_check check (status in ('waiting', 'active', 'checkmate', 'stalemate', 'draw', 'resigned', 'timeout', 'abandoned')),
  constraint rooms_turn_check check (turn in ('white', 'black'))
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid references auth.users(id) on delete set null,
  black_id uuid references auth.users(id) on delete set null,
  mode text not null,
  pgn text not null,
  final_fen text not null,
  result text not null,
  duration_seconds integer not null default 0,
  analysis_summary jsonb,
  created_at timestamptz not null default now(),
  constraint games_mode_check check (mode in ('local', 'friend', 'ai')),
  constraint games_result_check check (result in ('1-0', '0-1', '1/2-1/2', '*'))
);

create table if not exists public.coach_insights (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  move_number integer not null,
  move_san text not null,
  classification text not null,
  explanation text not null,
  best_move text not null,
  eval_before numeric not null,
  eval_after numeric not null,
  created_at timestamptz not null default now(),
  constraint coach_classification_check check (classification in ('best move', 'good', 'inaccuracy', 'mistake', 'blunder'))
);

create index if not exists profiles_rating_idx on public.profiles (rating desc, wins desc);
create index if not exists profiles_city_rating_idx on public.profiles (city, rating desc, wins desc);
create index if not exists games_white_created_idx on public.games (white_id, created_at desc);
create index if not exists games_black_created_idx on public.games (black_id, created_at desc);
create index if not exists coach_insights_game_idx on public.coach_insights (game_id, move_number);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.games enable row level security;
alter table public.coach_insights enable row level security;

create policy "profiles_public_leaderboard_read"
  on public.profiles for select
  using (true);

create policy "profiles_owner_insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_owner_update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "rooms_read_open_or_assigned"
  on public.rooms for select
  using (
    white_player_id is null
    or black_player_id is null
    or auth.uid() = white_player_id
    or auth.uid() = black_player_id
  );

create policy "rooms_authenticated_insert"
  on public.rooms for insert
  with check (
    auth.role() = 'authenticated'
    and (white_player_id is null or white_player_id = auth.uid())
    and (black_player_id is null or black_player_id = auth.uid())
  );

create policy "rooms_assigned_players_update"
  on public.rooms for update
  using (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
    or white_player_id is null
    or black_player_id is null
  )
  with check (
    auth.uid() = white_player_id
    or auth.uid() = black_player_id
  );

create policy "games_owner_read"
  on public.games for select
  using (auth.uid() = white_id or auth.uid() = black_id);

create policy "games_owner_insert"
  on public.games for insert
  with check (
    auth.role() = 'authenticated'
    and (white_id is null or white_id = auth.uid())
    and (black_id is null or black_id = auth.uid())
  );

create policy "coach_insights_game_owner_read"
  on public.coach_insights for select
  using (
    exists (
      select 1 from public.games
      where games.id = coach_insights.game_id
        and (games.white_id = auth.uid() or games.black_id = auth.uid())
    )
  );

create policy "coach_insights_game_owner_insert"
  on public.coach_insights for insert
  with check (
    exists (
      select 1 from public.games
      where games.id = coach_insights.game_id
        and (games.white_id = auth.uid() or games.black_id = auth.uid())
    )
  );
