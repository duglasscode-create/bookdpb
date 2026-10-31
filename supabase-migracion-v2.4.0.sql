-- BookDPB v2.4.0 — Youtube Manager: categorías de listas, categorías de
-- vídeos y vídeos sueltos (vídeos que no pertenecen a ninguna lista).
-- Ejecutar UNA vez en Supabase: SQL Editor → pegar → Run.
-- Es SEGURO y re-ejecutable: solo AÑADE una columna y CREA tablas si
-- faltan (no borra nada ni toca ningún dato existente).

-- 1) Cada lista puede pertenecer a una categoría de listas
alter table yt_lists add column if not exists category_id uuid;

-- 2) Categorías de listas (agrupan listas por temas)
create table if not exists yt_list_cats (
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

-- 3) Categorías de vídeos sueltos (cada una es un «space» de vídeos)
create table if not exists yt_vid_cats (
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

-- 4) Vídeos sueltos: no cuelgan de ninguna lista, sino de una categoría
--    de vídeos (o de ninguna: «Sin clasificar»)
create table if not exists yt_loose_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cat_id uuid references yt_vid_cats(id) on delete set null,
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

alter table yt_list_cats enable row level security;
alter table yt_vid_cats enable row level security;
alter table yt_loose_videos enable row level security;

drop policy if exists "owner_all" on yt_list_cats;
create policy "owner_all" on yt_list_cats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on yt_vid_cats;
create policy "owner_all" on yt_vid_cats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on yt_loose_videos;
create policy "owner_all" on yt_loose_videos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
