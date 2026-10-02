-- BookDPB v2.2 — Migración para el orden propio de Favoritos
-- Ejecutar UNA vez en Supabase: SQL Editor → pegar → Run.
-- Es SEGURO y re-ejecutable: solo AÑADE la columna si falta (no borra nada).
-- (Requiere haber ejecutado antes supabase-migracion-v2.1.sql.)

alter table bookmarks add column if not exists fav_order integer default 0;
