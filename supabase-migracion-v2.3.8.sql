-- BookDPB v2.3.8 — Tablas de Youtube Manager
-- Ejecutar UNA vez en Supabase: SQL Editor → pegar → Run.
-- Es SEGURO y re-ejecutable: solo CREA tablas si faltan (no borra nada
-- ni toca ninguna tabla existente ni ningún dato).

create table if not exists yt_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references yt_lists(id) on delete cascade,
  name text not null,
  color text default '#0ea5a5',
  icon text,
  icon_type text default 'emoji',
  position int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists yt_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references yt_lists(id) on delete cascade,
  youtube_id text not null,
  title text not null,
  channel_name text,
  thumbnail text,
  duration_sec int default 0,
  watched boolean default false,
  progress_sec int default 0,
  seconds_watched int default 0,
  no_embed boolean default false,
  position int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists yt_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#0ea5a5',
  icon text,
  icon_type text default 'emoji',
  position int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists yt_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references yt_categories(id) on delete set null,
  name text not null,
  url text,
  handle text,
  icon text,
  icon_type text default 'auto',
  position int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table yt_lists enable row level security;
alter table yt_videos enable row level security;
alter table yt_categories enable row level security;
alter table yt_channels enable row level security;

drop policy if exists "owner_all" on yt_lists;
create policy "owner_all" on yt_lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on yt_videos;
create policy "owner_all" on yt_videos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on yt_categories;
create policy "owner_all" on yt_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on yt_channels;
create policy "owner_all" on yt_channels for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
