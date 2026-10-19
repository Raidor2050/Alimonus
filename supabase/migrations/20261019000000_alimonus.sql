-- Alimonus schema: two people, one shared Chordbook, personal + shared state.
-- Access model (deliberately simple): every signed-in user can read shared data;
-- personal rows are writable only by their owner; explicitly shared rows are writable by both.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username in ('raiyan', 'afra')),
  display_name text not null,
  tagline text not null default '',
  bio text not null default '',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- songs (shared catalog)
create table if not exists public.songs (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  artist text not null,
  album text,
  alt_titles text[] not null default '{}',
  artwork_url text,
  duration_ms integer,
  release_year integer,
  genre text,
  key text,
  bpm integer,
  description text,
  credits text,
  spotify_id text,
  youtube_id text,
  chord_sheet text,
  progression text,
  chord_source text check (chord_source in ('verified', 'suggested', 'imported', 'user', 'sample')),
  provenance text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One Chordbook entry per Spotify track keeps imports from duplicating songs.
create unique index if not exists songs_spotify_id_key on public.songs (spotify_id) where spotify_id is not null;
create index if not exists songs_title_idx on public.songs (lower(title));

-- ---------------------------------------------------------------- per-user song state
create table if not exists public.user_song_states (
  user_id uuid not null references auth.users (id) on delete cascade,
  song_id text not null references public.songs (id) on delete cascade,
  wishlist boolean not null default false,
  covered boolean not null default false,
  covered_at timestamptz,
  notes text not null default '',
  last_opened_at timestamptz,
  transpose integer not null default 0,
  capo integer not null default 0,
  primary key (user_id, song_id)
);

-- ---------------------------------------------------------------- playlists
create table if not exists public.playlists (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  shared boolean not null default false,
  kind text not null default 'playlist' check (kind in ('playlist', 'setlist')),
  color text not null default '#b6ff3b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_items (
  id text primary key default gen_random_uuid()::text,
  playlist_id text not null references public.playlists (id) on delete cascade,
  song_id text not null references public.songs (id) on delete cascade,
  position integer not null default 0,
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (playlist_id, song_id)
);
create index if not exists playlist_items_playlist_idx on public.playlist_items (playlist_id, position);

-- ---------------------------------------------------------------- roadmap
create table if not exists public.roadmap_items (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shared boolean not null default false,
  title text not null,
  description text not null default '',
  status text not null default 'todo' check (status in ('idea', 'todo', 'doing', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  category text not null default 'task' check (category in ('goal', 'task', 'learning', 'music', 'coding', 'creative', 'milestone')),
  start_date date,
  due_date date,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- activity feed
create table if not exists public.activity (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  text text not null,
  song_id text references public.songs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on public.activity (created_at desc);

-- ---------------------------------------------------------------- spotify (per user, private)
create table if not exists public.spotify_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  scope text,
  display_name text,
  spotify_user_id text,
  updated_at timestamptz not null default now()
);

-- ================================================================ Row Level Security
alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.user_song_states enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.roadmap_items enable row level security;
alter table public.activity enable row level security;
alter table public.spotify_connections enable row level security;

-- profiles: both can see both; you edit yourself
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- songs: one shared catalog; either of you can add/edit; delete what you added
create policy "songs readable" on public.songs for select to authenticated using (true);
create policy "songs insert" on public.songs for insert to authenticated with check (true);
create policy "songs update" on public.songs for update to authenticated using (true) with check (true);
create policy "songs delete own" on public.songs for delete to authenticated using (created_by = auth.uid());

-- song states: readable by both (for duet achievements), writable only by the owner
create policy "states readable" on public.user_song_states for select to authenticated using (true);
create policy "states own insert" on public.user_song_states for insert to authenticated with check (user_id = auth.uid());
create policy "states own update" on public.user_song_states for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "states own delete" on public.user_song_states for delete to authenticated using (user_id = auth.uid());

-- playlists: personal ones are private; shared ones are visible and editable by both
create policy "playlists visible" on public.playlists for select to authenticated using (owner_id = auth.uid() or shared);
create policy "playlists insert own" on public.playlists for insert to authenticated with check (owner_id = auth.uid());
create policy "playlists update" on public.playlists for update to authenticated using (owner_id = auth.uid() or shared) with check (owner_id = auth.uid() or shared);
create policy "playlists delete own" on public.playlists for delete to authenticated using (owner_id = auth.uid());

create or replace function public.can_edit_playlist(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.playlists p where p.id = pid and (p.owner_id = auth.uid() or p.shared));
$$;

create policy "items visible" on public.playlist_items for select to authenticated using (public.can_edit_playlist(playlist_id));
create policy "items insert" on public.playlist_items for insert to authenticated with check (public.can_edit_playlist(playlist_id));
create policy "items update" on public.playlist_items for update to authenticated using (public.can_edit_playlist(playlist_id)) with check (public.can_edit_playlist(playlist_id));
create policy "items delete" on public.playlist_items for delete to authenticated using (public.can_edit_playlist(playlist_id));

-- roadmap: both lanes visible to both; edit your own; shared items editable by both; delete own
create policy "roadmap readable" on public.roadmap_items for select to authenticated using (true);
create policy "roadmap insert own" on public.roadmap_items for insert to authenticated with check (owner_id = auth.uid());
create policy "roadmap update" on public.roadmap_items for update to authenticated using (owner_id = auth.uid() or shared) with check (owner_id = auth.uid() or shared);
create policy "roadmap delete own" on public.roadmap_items for delete to authenticated using (owner_id = auth.uid());

-- activity: shared feed, you post as yourself
create policy "activity readable" on public.activity for select to authenticated using (true);
create policy "activity insert own" on public.activity for insert to authenticated with check (user_id = auth.uid());

-- spotify tokens: only yours
create policy "spotify own" on public.spotify_connections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ================================================================ Realtime
-- Shared changes appear on the other person's screen without refreshing.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'songs', 'user_song_states', 'playlists', 'playlist_items', 'roadmap_items', 'activity'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
