-- ============================================================
-- BookDPB v2.5.2 — Hábitos: vincular también a Vídeos sueltos
-- Añade a la tabla habits la columna del vínculo con una
-- categoría de vídeos sueltos (yt_vid_cats), para que el tiempo
-- de esos vídeos sume al hábito igual que el de las listas.
-- Ejecutar UNA vez en Supabase → SQL Editor. No toca tus datos.
-- ============================================================

alter table public.habits
  add column if not exists yt_vid_cat_id uuid references public.yt_vid_cats(id) on delete set null;
