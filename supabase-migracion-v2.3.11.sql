-- BookDPB v2.3.11 — Foto (avatar) de los canales de Youtube Manager
-- Ejecutar UNA vez en Supabase: SQL Editor → pegar → Run.
-- Es SEGURO y re-ejecutable: solo AÑADE una columna si falta (no borra
-- nada ni toca ningún dato existente).
-- Sin esta columna, los logos de los canales no se pueden guardar;
-- el resto de la app funciona igual.

alter table yt_channels add column if not exists avatar_url text;
