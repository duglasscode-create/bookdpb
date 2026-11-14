-- BookDPB v2.6.0 — Mis Items: Tareas (To Do) con categorías propias.
-- Dos tablas nuevas: las categorías de tareas (nombre, color e icono
-- Emoji / Iconos UI / Imagen, como las demás categorías de la app) y
-- las tareas del día (con su categoría, si están hechas y qué día se
-- hicieron). Ejecutar UNA vez en Supabase: SQL Editor → pegar → Run.
-- Es SEGURO y re-ejecutable: solo CREA tablas si faltan (no borra
-- nada ni toca ningún dato existente).

create table if not exists todo_cats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#2dd4bf',
  icon text,
  icon_type text default 'emoji',
  position int default 0,
  created_at timestamptz default now()
);

create table if not exists todo_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cat_id uuid references todo_cats(id) on delete set null,
  title text not null,
  done boolean default false,
  day date not null,
  done_day date,
  position int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table todo_cats enable row level security;
alter table todo_tasks enable row level security;

drop policy if exists "owner_all" on todo_cats;
create policy "owner_all" on todo_cats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_all" on todo_tasks;
create policy "owner_all" on todo_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
