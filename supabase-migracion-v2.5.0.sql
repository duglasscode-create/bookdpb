-- BookDPB v2.5.0 — Bloque Hábitos: hábitos de la rutina diaria y su
-- registro por días (hecho + segundos de tiempo dedicado).
-- Ejecutar UNA vez en Supabase: SQL Editor → pegar → Run.
-- Es SEGURO y re-ejecutable: solo CREA tablas si faltan (no borra nada
-- ni toca ningún dato existente).

-- 1) Hábitos: nombre, color e icono (Emoji / Iconos UI / Imagen, como
--    las categorías), nota libre, categoría de listas de Youtube
--    Manager vinculada (su tiempo de vídeo suma al hábito) y archivado.
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#22c55e',
  icon text,
  icon_type text default 'emoji',
  note text default '',
  yt_cat_id uuid references yt_list_cats(id) on delete set null,
  archived boolean default false,
  position int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- 2) Registro por día: si se hizo el hábito y cuántos segundos se le
--    dedicaron ese día (cronómetro de la app o vídeos vinculados).
create table if not exists habit_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  day date not null,
  done boolean default false,
  seconds int default 0,
  created_at timestamptz default now(),
  unique (habit_id, day)
);

alter table habits enable row level security;
alter table habit_days enable row level security;

drop policy if exists "owner_all" on habits;
create policy "owner_all" on habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on habit_days;
create policy "owner_all" on habit_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
