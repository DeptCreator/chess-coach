create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles (lower(username));

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_status_check check (status in ('pending', 'accepted')),
  constraint friendships_not_self_check check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_unique_idx
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index if not exists friendships_requester_status_idx
  on public.friendships (requester_id, status);

create index if not exists friendships_addressee_status_idx
  on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;

drop policy if exists "friendships_participants_read" on public.friendships;
drop policy if exists "friendships_requester_insert" on public.friendships;
drop policy if exists "friendships_addressee_accept" on public.friendships;
drop policy if exists "friendships_participants_delete" on public.friendships;

create policy "friendships_participants_read"
  on public.friendships for select
  to authenticated
  using (
    (select auth.uid()) = requester_id
    or (select auth.uid()) = addressee_id
  );

create policy "friendships_requester_insert"
  on public.friendships for insert
  to authenticated
  with check (
    (select auth.uid()) = requester_id
    and requester_id <> addressee_id
    and status = 'pending'
  );

create policy "friendships_addressee_accept"
  on public.friendships for update
  to authenticated
  using ((select auth.uid()) = addressee_id)
  with check ((select auth.uid()) = addressee_id and status = 'accepted');

create policy "friendships_participants_delete"
  on public.friendships for delete
  to authenticated
  using (
    (select auth.uid()) = requester_id
    or (select auth.uid()) = addressee_id
  );
