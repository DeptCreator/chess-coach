create index if not exists rooms_white_player_id_idx on public.rooms (white_player_id);
create index if not exists rooms_black_player_id_idx on public.rooms (black_player_id);

drop policy if exists "profiles_owner_insert" on public.profiles;
drop policy if exists "profiles_owner_update" on public.profiles;
drop policy if exists "rooms_read_open_or_assigned" on public.rooms;
drop policy if exists "rooms_authenticated_insert" on public.rooms;
drop policy if exists "rooms_assigned_players_update" on public.rooms;
drop policy if exists "games_owner_read" on public.games;
drop policy if exists "games_owner_insert" on public.games;
drop policy if exists "coach_insights_game_owner_read" on public.coach_insights;
drop policy if exists "coach_insights_game_owner_insert" on public.coach_insights;

create policy "profiles_owner_insert"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "profiles_owner_update"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "rooms_read_open_or_assigned"
  on public.rooms for select
  using (
    white_player_id is null
    or black_player_id is null
    or (select auth.uid()) = white_player_id
    or (select auth.uid()) = black_player_id
  );

create policy "rooms_authenticated_insert"
  on public.rooms for insert
  with check (
    (select auth.role()) = 'authenticated'
    and (white_player_id is null or white_player_id = (select auth.uid()))
    and (black_player_id is null or black_player_id = (select auth.uid()))
  );

create policy "rooms_assigned_players_update"
  on public.rooms for update
  using (
    (select auth.uid()) = white_player_id
    or (select auth.uid()) = black_player_id
    or white_player_id is null
    or black_player_id is null
  )
  with check (
    (select auth.uid()) = white_player_id
    or (select auth.uid()) = black_player_id
  );

create policy "games_owner_read"
  on public.games for select
  using ((select auth.uid()) = white_id or (select auth.uid()) = black_id);

create policy "games_owner_insert"
  on public.games for insert
  with check (
    (select auth.role()) = 'authenticated'
    and (white_id is null or white_id = (select auth.uid()))
    and (black_id is null or black_id = (select auth.uid()))
  );

create policy "coach_insights_game_owner_read"
  on public.coach_insights for select
  using (
    exists (
      select 1 from public.games
      where games.id = coach_insights.game_id
        and (games.white_id = (select auth.uid()) or games.black_id = (select auth.uid()))
    )
  );

create policy "coach_insights_game_owner_insert"
  on public.coach_insights for insert
  with check (
    exists (
      select 1 from public.games
      where games.id = coach_insights.game_id
        and (games.white_id = (select auth.uid()) or games.black_id = (select auth.uid()))
    )
  );
