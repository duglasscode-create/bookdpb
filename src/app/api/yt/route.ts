/* BookDPB — /api/yt
   Resuelve datos de YouTube desde el servidor (el navegador no puede leer
   youtube.com directamente por CORS):
   · ?video=<url|id>     → título, canal y miniatura vía oEmbed.
   · ?list=<url|id>      → videos de una playlist pública (hasta 100).
   · ?channel=<url>      → nombre y @handle de un canal.
   Requiere sesión iniciada (es un servicio de la app, no público). */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function ytIdOf(input: string): string | null {
  const s = (input || "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function ytPlaylistIdOf(input: string): string | null {
  const m = (input || "").match(/[?&]list=([\w-]+)/);
  if (m) return m[1];
  if (/^(PL|UU|OL|RD)[\w-]{10,}$/.test((input || "").trim())) return input.trim();
  return null;
}
function durToSec(txt: string | null | undefined): number {
  if (!txt) return 0;
  const parts = String(txt).split(":").map((x) => parseInt(x, 10) || 0);
  return parts.reduce((a, n) => a * 60 + n, 0);
}

/* Extrae el JSON de ytInitialData de una página de YouTube */
function extractInitialData(html: string): any | null {
  const marker = "var ytInitialData = ";
  const i = html.indexOf(marker);
  if (i < 0) return null;
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let j = i + marker.length; j < html.length; j++) {
    const ch = html[j];
    if (start < 0) { if (ch === "{") { start = j; depth = 1; } continue; }
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) {
      try { return JSON.parse(html.slice(start, j + 1)); } catch { return null; }
    } }
  }
  return null;
}

function findPlaylistItems(node: any, out: any[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => findPlaylistItems(n, out)); return; }
  if (node.playlistVideoRenderer) out.push(node.playlistVideoRenderer);
  Object.values(node).forEach((v) => findPlaylistItems(v, out));
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const q = req.nextUrl.searchParams;

  /* ---- un video ---- */
  const videoParam = q.get("video");
  if (videoParam) {
    const id = ytIdOf(videoParam);
    if (!id) return NextResponse.json({ error: "URL de video no válida" }, { status: 400 });
    const r = await fetch(
      "https://www.youtube.com/oembed?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + id) + "&format=json",
      { headers: { "User-Agent": UA } });
    if (!r.ok) return NextResponse.json({ error: "YouTube no devolvió datos de ese video" }, { status: 422 });
    const j: any = await r.json();
    return NextResponse.json({
      youtubeId: id,
      title: j.title || "Video de YouTube",
      channelName: j.author_name || "",
      channelUrl: j.author_url || "",
      thumbnail: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
    });
  }

  /* ---- una playlist entera ---- */
  const listParam = q.get("list");
  if (listParam) {
    const pid = ytPlaylistIdOf(listParam);
    if (!pid) return NextResponse.json({ error: "URL de playlist no válida" }, { status: 400 });
    const r = await fetch("https://www.youtube.com/playlist?list=" + encodeURIComponent(pid) + "&hl=es", {
      headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
    });
    if (!r.ok) return NextResponse.json({ error: "No se pudo leer la playlist" }, { status: 422 });
    const html = await r.text();
    const data = extractInitialData(html);
    if (!data) return NextResponse.json({ error: "No se pudo interpretar la playlist (¿es pública?)" }, { status: 422 });
    const raw: any[] = [];
    findPlaylistItems(data, raw);
    const seen = new Set<string>();
    const items = raw
      .filter((v) => v.videoId && !seen.has(v.videoId) && seen.add(v.videoId))
      .slice(0, 100)
      .map((v) => ({
        youtubeId: v.videoId as string,
        title: (v.title && v.title.runs && v.title.runs[0] && v.title.runs[0].text) || "Video de YouTube",
        channelName: (v.shortBylineText && v.shortBylineText.runs && v.shortBylineText.runs[0] && v.shortBylineText.runs[0].text) || "",
        durationSec: v.lengthSeconds ? parseInt(v.lengthSeconds, 10) || 0 : durToSec(v.lengthText && v.lengthText.simpleText),
      }));
    if (!items.length) return NextResponse.json({ error: "La playlist no devolvió videos (¿es pública?)" }, { status: 422 });
    let listTitle = "";
    try {
      const m = html.match(/<meta property="og:title" content="([^"]+)"/);
      if (m) listTitle = m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    } catch { /* sin título */ }
    return NextResponse.json({ playlistId: pid, title: listTitle, items });
  }

  /* ---- un canal ---- */
  const chanParam = q.get("channel");
  if (chanParam) {
    const url = chanParam.trim();
    if (!/youtube\.com\//i.test(url)) return NextResponse.json({ error: "URL de canal no válida" }, { status: 400 });
    const handleM = url.match(/@([\w.-]+)/);
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" } });
    if (!r.ok) return NextResponse.json({ error: "No se pudo leer el canal" }, { status: 422 });
    const html = await r.text();
    let name = "";
    const og = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (og) name = og[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/ - YouTube$/, "");
    if (!name && handleM) name = handleM[1];
    return NextResponse.json({ name, handle: handleM ? "@" + handleM[1] : "", url });
  }

  return NextResponse.json({ error: "Falta el parámetro video, list o channel" }, { status: 400 });
}
