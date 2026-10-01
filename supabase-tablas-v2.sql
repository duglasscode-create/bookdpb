-- BookDPB v2.0 — Tablas nuevas para Cuentas, Asistentes IA y Recordatorios
-- Ejecutar UNA vez en Supabase: SQL Editor → pegar → Run
-- No toca ninguna tabla existente ni ningún dato.

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
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists assistants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text,
  note text,
  icon text,
  icon_type text default 'auto',
  position int default 0,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  remind_at timestamptz,
  color text default 'default',
  icon text default '⏰',
  done boolean default false,
  position int default 0,
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
