-- BookDPB v2.1 — Migración para el porte fiel de TabmeCode v1.6.3
-- Ejecutar UNA vez en Supabase: SQL Editor → pegar → Run
-- Es SEGURO y re-ejecutable: no borra ni modifica ningún dato existente,
-- solo AÑADE columnas (ALTER TABLE ... ADD COLUMN IF NOT EXISTS) y crea
-- las tablas que falten (CREATE TABLE IF NOT EXISTS). Si ya se ejecutó
-- antes, no hace nada.
-- NO requiere haber ejecutado antes supabase-tablas-v2.sql: si las tablas
-- accounts / assistants / reminders no existen, las crea completas aquí.

-- Cuentas, Asistentes IA y Recordatorios (completas: v2.0 + columnas v2.1).
-- Si ya existen (se ejecutó supabase-tablas-v2.sql), no se tocan.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text,
  username text,
  email text,
  password text,
  note text,
  icon text,
  icon_type text default 'auto',
  position int default 0,
  is_favorite boolean default false,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists assistants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text,
  username text,
  email text,
  password text,
  note text,
  icon text,
  icon_type text default 'auto',
  position int default 0,
  is_favorite boolean default false,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  remind_at timestamptz,
  note text,
  url text,
  color text default 'default',
  icon text default '⏰',
  icon_type text default 'emoji',
  done boolean default false,
  position int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

alter table accounts enable row level security;
alter table assistants enable row level security;
alter table reminders enable row level security;

drop policy if exists "owner_all" on accounts;
create policy "owner_all" on accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "owner_all" on assistants;
create policy "owner_all" on assistants for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "owner_all" on reminders;
create policy "owner_all" on reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Iconos con imagen en spaces/carpetas + papelera para colecciones
alter table collections add column if not exists icon_type text default 'emoji';
alter table collections add column if not exists is_deleted boolean default false;
alter table collections add column if not exists deleted_at timestamptz;

-- Marcadores: orden de arrastre + última apertura
alter table bookmarks add column if not exists order_num int default 0;
alter table bookmarks add column if not exists last_opened timestamptz;

-- Notas enriquecidas: archivar, favorito, leer después, adjuntos, enlaces
alter table notes add column if not exists pinned boolean default false;
alter table notes add column if not exists archived boolean default false;
alter table notes add column if not exists fav boolean default false;
alter table notes add column if not exists read_later boolean default false;
alter table notes add column if not exists attachments jsonb default '[]'::jsonb;
alter table notes add column if not exists links_text text default '';
alter table notes add column if not exists deleted boolean default false;
alter table notes add column if not exists deleted_at timestamptz;

-- Por si las tablas ya existían de v2.0 sin estas columnas (idempotente)
alter table assistants add column if not exists username text;
alter table assistants add column if not exists email text;
alter table assistants add column if not exists password text;
alter table reminders add column if not exists note text;
alter table reminders add column if not exists url text;
alter table reminders add column if not exists icon_type text default 'emoji';
alter table reminders add column if not exists is_deleted boolean default false;
alter table reminders add column if not exists deleted_at timestamptz;
alter table accounts add column if not exists is_favorite boolean default false;
alter table assistants add column if not exists is_favorite boolean default false;

-- Etiquetas (las crea el campo «Etiquetas» del marcador)
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '',
  created_at timestamptz default now(),
  unique (user_id, name)
);
create table if not exists bookmark_tags (
  bookmark_id uuid not null references bookmarks(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (bookmark_id, tag_id)
);

-- Carpeta de cada marcador (un marcador vive en una carpeta)
create table if not exists bookmark_collections (
  bookmark_id uuid not null references bookmarks(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (bookmark_id, collection_id)
);

-- Historial de actividad (vista 🕘 Historial)
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null default 'create',
  entity_type text default '',
  entity_id uuid,
  entity_name text default '',
  details text default '',
  created_at timestamptz default now()
);

alter table tags enable row level security;
alter table bookmark_tags enable row level security;
alter table bookmark_collections enable row level security;
alter table activity_log enable row level security;

drop policy if exists "owner_all" on tags;
create policy "owner_all" on tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "owner_all" on bookmark_tags;
create policy "owner_all" on bookmark_tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "owner_all" on bookmark_collections;
create policy "owner_all" on bookmark_collections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "owner_all" on activity_log;
create policy "owner_all" on activity_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ajustes del usuario (tema, zoom, vistas, orden del sidebar, etc.)
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
drop policy if exists "owner_all" on user_settings;
create policy "owner_all" on user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
