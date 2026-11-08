-- BookDPB v2.5.1 — carpeta de recursos vinculada en Hábitos
-- Seguro y re-ejecutable: añade una columna nullable a habits;
-- no borra nada ni toca tus datos.
-- (Las carpetas de Spaces viven en la tabla collections.)
alter table public.habits
  add column if not exists folder_id uuid references public.collections(id) on delete set null;
