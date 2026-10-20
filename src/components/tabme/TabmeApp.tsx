/* BookDPB — TabmeApp.tsx
   Shell literal de TabmeCode v1.6.3 (newtab.html + newtab.js) en React:
   topbar (8 botones + buscador global), sidebar (secciones reordenables,
   árbol spaces/carpetas, Mis Items, etiquetas), dropdowns ⚙️👤❓,
   modales de ayuda propios (guide/shortcuts/changelog/feedback/spacepick/
   itempick) y toasts. Los datos vienen de tc-store (Supabase). */
"use client";
import React, { useState, useEffect, useRef, useCallback, CSSProperties } from "react";
import { TCProvider, useTC } from "@/lib/tc-store";
import { AppProvider, useApp, useDnD } from "./tc-ui";
import type { UiState, ModalState } from "./tc-ui";
import * as T from "@/lib/tc";
import { Views } from "./Views";
import { NotesView } from "./NotesView";
import { Modals } from "./Modals";

/* Tipos de arrastre propios del sidebar (no existen en tc.tsx) */
const DT_ITEMS = "application/x-tbc-itemrow";
const DT_SEC = "application/x-tbc-sec";

/* Estado de arrastre a nivel de módulo, como el `dragState` del original */
let dragState: { type: string; id: string } | null = null;
/* El mousedown se guarda (captura) porque en dragstart e.target es la <section> */
let downEl: HTMLElement | null = null;

const SEC_DEFAULT = ["spaces", "misitems", "youtube", "tags", "sessions"];
const ITEM_KEYS = ["accounts", "reminders", "favorites", "history", "trash", "readlater"];
const YT_KEYS = ["ytlists", "ytsubs", "ytdone"];
const YT_DEFS: Record<string, { label: string; icon: string; hint: string }> = {
  ytlists: { label: "Listas", icon: "🎬", hint: "Tus listas de videos de YouTube" },
  ytsubs: { label: "Suscripciones", icon: "📡", hint: "Tus canales de YouTube, por categorías" },
  ytdone: { label: "Completadas", icon: "🏁", hint: "Listas con todos los videos vistos" },
};
const HELP_KINDS = ["guide", "shortcuts", "changelog", "feedback", "spacepick", "itempick"];

const INITIAL_UI: UiState = {
  view: "home", spaceId: null, folderId: null, tag: null, notes: false,
  notesTab: "all", notesQuery: "", histFilter: "all",
  remindersTab: "all", trashTab: "all", ytListId: null,
};

export function TabmeApp({ userId }: { userId: string }) {
  const [ui, setUiRaw] = useState<UiState>(INITIAL_UI);
  const setUi = useCallback((p: Partial<UiState>) => setUiRaw((prev) => ({ ...prev, ...p })), []);
  const [modal, setModal] = useState<ModalState>(null);
  const openModal = useCallback((kind: string, props?: any) => setModal({ kind, props }), []);
  const closeModal = useCallback(() => setModal(null), []);
  const [openDd, setOpenDd] = useState<string | null>(null);
  return (
    <TCProvider userId={userId}>
      <AppProvider ui={ui} setUi={setUi} modal={modal} openModal={openModal} closeModal={closeModal}
        openDd={openDd} setOpenDd={setOpenDd}>
        <Shell />
      </AppProvider>
    </TCProvider>
  );
}

/* ================= Shell ================= */

function Shell() {
  const tc = useTC();
  const { ui, setUi, modal, closeModal, openDd, setOpenDd, getZoom, liveReminders, ytPlayer } = useApp();
  const restored = useRef(false);

  /* Restaurar selección guardada (vista folder solo si la carpeta existe) */
  useEffect(() => {
    if (tc.loading || restored.current) return;
    restored.current = true;
    const st = tc.db.settings;
    const sp = st.activeSpaceId && tc.db.spaces.find((s) => s.id === st.activeSpaceId && !s.deletedAt);
    const f = st.activeFolderId && tc.db.folders.find((x) => x.id === st.activeFolderId && !x.deletedAt);
    if (f) setUi({ spaceId: f.spaceId, folderId: f.id, view: "folder" });
    else if (sp) setUi({ spaceId: sp.id, view: "all" });
  }, [tc.loading, tc.db, setUi]);

  /* Tema, clases de body y zoom (applyTheme/applyPrefs/applyZoom del original) */
  useEffect(() => {
    const st = tc.db.settings;
    document.documentElement.dataset.theme = st.darkMode ? "dark" : "light";
    document.body.classList.toggle("compact", !!st.compactMode);
    document.body.classList.toggle("collapsed-folders", !!st.collapseFolders);
    document.body.classList.toggle("sb-pinned", !!st.sidebarPinned);
    document.documentElement.style.setProperty("--cardzoom", String(getZoom()));
  });

  /* Recordatorios: aviso al vencer mientras la app está abierta
     (adaptación web: el original usaba chrome.alarms) */
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      liveReminders().forEach((r) => {
        if (!r.done && r.when <= now && !notifiedRef.current.has(r.id)) {
          notifiedRef.current.add(r.id);
          tc.toast("⏰ " + r.title);
        }
      });
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tc.db.reminders]);



  /* Cerrar dropdowns con clic fuera */
  useEffect(() => {
    if (!openDd) return;
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".dd-wrap")) setOpenDd(null);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [openDd, setOpenDd]);

  /* Atajos globales: / o Ctrl+K buscar · Alt+Shift+D tema · Esc cierra */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modal) { closeModal(); return; }
        if (openDd) { setOpenDd(null); return; }
      }
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) ||
        !!(document.activeElement && (document.activeElement as HTMLElement).isContentEditable);
      if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        const inp = document.getElementById("search") as HTMLInputElement | null;
        if (inp) { inp.focus(); inp.select(); }
      } else if (e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        tc.updateSettings({ darkMode: !tc.db.settings.darkMode });
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [modal, closeModal, openDd, setOpenDd, tc]);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <img src="/icon48.png" alt="BookDPB" width={28} height={28} />
          <span>BookDPB</span>
        </div>
        <SearchBox />
        <TopActions />
      </header>
      <div className="layout">
        <Sidebar />
        <main className="main" id="main">
          {ui.notes ? <NotesView /> : <Views />}
        </main>
      </div>
      {ytPlayer ? <YtPlayerBar /> : null}
      <ModalSwitch />
      <div id="toastRoot" className="toasts">
        {tc.toasts.map((t) => (
          <div className="toast" key={t.id}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}

/* ================= Reproductor de Youtube Manager ================= */

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void; }
}

function YtPlayerBar() {
  const tc = useTC();
  const { ytPlayer, stopYt, playYt } = useApp();
  const yp = ytPlayer!;
  const cur = tc.db.ytVideos.find((v) => v.id === yp.videoId);
  const list = tc.db.ytLists.find((l) => l.id === yp.listId);
  const queue = (list ? tc.db.ytVideos.filter((v) => v.listId === list.id && !v.deletedAt) : [])
    .slice().sort(T.byOrder);

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [sleep, setSleep] = useState("Off");
  const [big, setBig] = useState(false);
  const accRef = useRef(0);
  const lastPosRef = useRef(0);
  const durSavedRef = useRef<string>("");
  const curRef = useRef(cur);
  curRef.current = cur;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;

  const flush = useCallback((finalPos?: number) => {
    const v = curRef.current;
    const p = playerRef.current;
    if (!v || !p || typeof p.getCurrentTime !== "function") return;
    const add = accRef.current;
    accRef.current = 0;
    const position = finalPos !== undefined ? finalPos : (p.getCurrentTime() || 0);
    if (add >= 1 || finalPos !== undefined) tc.addYtProgress(v.youtubeId, position, add);
  }, [tc]);

  const step = useCallback((dir: number) => {
    const v = curRef.current;
    if (!v) return false;
    const q = queueRef.current;
    const i = q.findIndex((x) => x.id === v.id);
    if (i < 0) return false;
    let n = shuffleRef.current && dir > 0
      ? Math.floor(Math.random() * q.length)
      : i + dir;
    if (n === i && q.length > 1) n = (i + 1) % q.length;
    if (n < 0 || n >= q.length) return false;
    playYt(v.listId, q[n].id);
    return true;
  }, [playYt]);

  const stepRef = useRef(step);
  stepRef.current = step;
  const flushRef = useRef(flush);
  flushRef.current = flush;

  /* Cargar la API de YouTube una sola vez */
  useEffect(() => {
    if (window.YT && window.YT.Player) { setApiReady(true); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); setApiReady(true); };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }, []);

  /* Crear el reproductor o cambiar de video */
  useEffect(() => {
    if (!apiReady || !hostRef.current || !cur) return;
    const startAt = cur.watched ? 0 : Math.floor(cur.progressSec || 0);
    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      accRef.current = 0; lastPosRef.current = 0;
      playerRef.current.loadVideoById({ videoId: cur.youtubeId, startSeconds: startAt });
      return;
    }
    const player = new window.YT.Player(hostRef.current, {
      videoId: cur.youtubeId,
      playerVars: { autoplay: 1, rel: 0, playsinline: 1, start: startAt },
      events: {
        onStateChange: (e: any) => {
          if (e.data === 1) setPlaying(true);
          else if (e.data === 2) { setPlaying(false); flushRef.current(); }
          else if (e.data === 0) {
            setPlaying(false);
            flushRef.current();
            const v = curRef.current;
            if (v) {
              tc.setYtWatched(v.youtubeId, true);
              tc.toast("Visto ✓ — se marca solo al terminar");
              if (!stepRef.current(1)) { /* fin de la lista */ }
            }
          }
        },
        onError: (e: any) => {
          if ([100, 101, 150, 153].includes(e.data)) {
            const v = curRef.current;
            if (v && !v.noEmbed) {
              tc.saveYtVideo({ ...v, noEmbed: true });
              tc.toast("Este video no permite inserción (⛔). Ábrelo en YouTube.");
            }
          }
        },
      },
    });
    playerRef.current = player;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, yp.videoId]);

  /* Reloj de progreso + tiempo invertido */
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      const v = curRef.current;
      if (!p || !v || typeof p.getCurrentTime !== "function") return;
      let state = -1;
      try { state = p.getPlayerState(); } catch { return; }
      const now = p.getCurrentTime() || 0;
      const d = p.getDuration() || 0;
      setPos(now); if (d) setDur(d);
      if (state === 1) {
        const delta = now - lastPosRef.current;
        if (delta > 0 && delta < 5) accRef.current += delta;
        if (accRef.current >= 5) flushRef.current(now);
        if (d > 0 && !v.durationSec && durSavedRef.current !== v.id) {
          durSavedRef.current = v.id;
          tc.saveYtVideo({ ...v, durationSec: Math.round(d) });
        }
      }
      lastPosRef.current = now;
    }, 1000);
    return () => clearInterval(t);
  }, [tc]);

  /* Sleep timer */
  useEffect(() => {
    if (sleep === "Off") return;
    const mins = parseInt(sleep, 10) || 0;
    const t = window.setTimeout(() => {
      if (playerRef.current && typeof playerRef.current.pauseVideo === "function") playerRef.current.pauseVideo();
      tc.toast("😴 Sleep timer: reproducción en pausa");
      setSleep("Off");
    }, mins * 60000);
    return () => window.clearTimeout(t);
  }, [sleep, tc]);

  /* Al cerrar la barra se destruye el reproductor */
  useEffect(() => {
    document.body.classList.add("yt-open");
    return () => {
      document.body.classList.remove("yt-open");
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try { playerRef.current.destroy(); } catch { /* noop */ }
      }
      playerRef.current = null;
    };
  }, []);

  /* Si el video o la lista se eliminan mientras suenan, se cierra el reproductor */
  useEffect(() => {
    if (!cur || !list) stopYt();
  }, [cur, list, stopYt]);

  /* Si el video resulta no incrustable, se destruye la instancia */
  useEffect(() => {
    if (cur && cur.noEmbed && playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* noop */ }
      playerRef.current = null;
    }
  }, [cur]);

  if (!cur || !list) return null;
  const idx = queue.findIndex((v) => v.id === cur.id);
  const next = queue[idx + 1];
  const total = dur || cur.durationSec || 0;
  const pct = total ? Math.min(100, (pos / total) * 100) : 0;
  const sleepOpts = ["Off", "5 min", "10 min", "20 min", "30 min"];

  return (
    <>
      <div className={"yt-panel" + (big ? " big" : "")}>
        {cur.noEmbed ? (
          <div className="yt-noembed">
            <div className="yt-noembed-ico">⛔</div>
            <p>Este video no permite verse dentro de la app.</p>
            <a className="btn primary" href={"https://www.youtube.com/watch?v=" + cur.youtubeId}
              target="_blank" rel="noopener">▶ Abrir en YouTube</a>
          </div>
        ) : (
          <div className="yt-frame"><div ref={hostRef} className="yt-frame-host"></div></div>
        )}
        <button className="yt-panel-btn" title={big ? "Reducir" : "Ampliar"}
          onClick={() => setBig(!big)}>{big ? "🗗" : "⛶"}</button>
      </div>
      <div className="yt-bar">
        <div className="yt-bar-left">
          <img className="yt-bar-thumb" src={cur.thumbnail || T.ytThumb(cur.youtubeId)} alt="" />
          <div className="yt-bar-meta">
            <div className="yt-bar-title" title={cur.title}>{cur.title}</div>
            <div className="yt-bar-sub">{cur.channelName} · {list.name}</div>
          </div>
        </div>
        <div className="yt-bar-center">
          <div className="yt-bar-btns">
            <button className={"yt-ibtn" + (shuffle ? " on" : "")} title="Aleatorio"
              onClick={() => setShuffle(!shuffle)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>
            </button>
            <button className="yt-ibtn" title="Anterior" onClick={() => step(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2.5v14H6zM19.5 5v14L10 12z" /></svg>
            </button>
            <button className="yt-ibtn yt-play" title={playing ? "Pausa" : "Reproducir"}
              onClick={() => {
                const p = playerRef.current; if (!p) return;
                if (playing) p.pauseVideo(); else p.playVideo();
              }}>{playing
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 5h3.8v14H6.5zM13.7 5h3.8v14h-3.8z" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10-6.86a1.03 1.03 0 0 0 0-1.76l-10-6.86A1.03 1.03 0 0 0 8 5.14z" /></svg>}</button>
            <button className="yt-ibtn" title="Siguiente" onClick={() => step(1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 5H18v14h-2.5zM4.5 5v14L14 12z" /></svg>
            </button>
          </div>
          <div className="yt-track">
            <span>{T.fmtDur(pos)}</span>
            <div className="yt-progress" onClick={(e) => {
              const p = playerRef.current; if (!p || !total) return;
              const r = e.currentTarget.getBoundingClientRect();
              const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
              p.seekTo(frac * total, true);
              setPos(frac * total);
            }}><i style={{ width: pct + "%" }}></i></div>
            <span>{T.fmtDur(total)}</span>
          </div>
        </div>
        <div className="yt-bar-right">
          <button className={"chip-btn" + (cur.watched ? " on" : "")}
            title="Marcar / desmarcar como visto"
            onClick={() => tc.setYtWatched(cur.youtubeId, !cur.watched)}>
            {cur.watched ? "✓ Visto" : "○ Marcar visto"}</button>
          <button className={"chip-btn" + (sleep !== "Off" ? " on" : "")}
            title="Sleep timer: pausar dentro de…"
            onClick={() => setSleep(sleepOpts[(sleepOpts.indexOf(sleep) + 1) % sleepOpts.length])}>
            😴 {sleep}</button>
          <span className="yt-next" title={next ? next.title : ""}>
            {next ? "Siguiente: " + next.title : "Fin de la lista"}</span>
          <button className="yt-ibtn" title="Cerrar reproductor"
            onClick={() => { flush(); stopYt(); }}>✕</button>
        </div>
      </div>
    </>
  );
}

/* ================= Buscador global ================= */

type SRItem = { kind: string; title: string; url: string; fav: string; sub: string; data: any };

function SearchBox() {
  const tc = useTC();
  const { liveBookmarks, liveAccounts, liveReminders, goItem } = useApp();
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<{ label: string; items: SRItem[] }[]>([]);
  const [items, setItems] = useState<SRItem[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hide = useCallback(() => { setOpen(false); setItems([]); setGroups([]); setActive(-1); }, []);

  const doSearch = useCallback((qq: string) => {
    qq = qq.trim().toLowerCase();
    if (qq.length < 2) { hide(); return; }
    const gs: { label: string; items: SRItem[] }[] = [];
    const bms = liveBookmarks()
      .filter((b) => (b.title + " " + b.url + " " + (b.tags || []).join(" ")).toLowerCase().includes(qq))
      .slice(0, 8)
      .map((b) => ({ kind: "bookmark", title: b.title, url: b.url, fav: b.favicon || T.faviconFor(b.url), sub: T.domainOf(b.url), data: b }));
    if (bms.length) gs.push({ label: "🔖 Marcadores guardados", items: bms });
    const accs = liveAccounts()
      .filter((a) => ((a.name || "") + " " + (a.url || "") + " " + (a.username || "") + " " + (a.email || "") + " " + (a.note || "")).toLowerCase().includes(qq))
      .slice(0, 5)
      .map((a) => ({ kind: "account", title: a.name, url: a.url, fav: T.faviconFor(a.url), sub: "Cuenta · " + T.domainOf(a.url), data: a }));
    if (accs.length) gs.push({ label: "🔑 Cuentas", items: accs });
    const rems = liveReminders()
      .filter((r) => ((r.title || "") + " " + (r.note || "") + " " + (r.url || "")).toLowerCase().includes(qq))
      .slice(0, 5)
      .map((r) => ({ kind: "reminder", title: r.title, url: r.url, fav: "", sub: "Recordatorio · " + T.fmtDateTime(r.when), data: r }));
    if (rems.length) gs.push({ label: "⏰ Recordatorios", items: rems });
    /* NOTA: grupos «Pestañas abiertas» y «Cerradas recientemente» no portables a web (chrome.tabs) */
    const flat: SRItem[] = [];
    gs.forEach((g) => g.items.forEach((it) => flat.push(it)));
    setGroups(gs); setItems(flat); setActive(flat.length ? 0 : -1); setOpen(true);
  }, [liveBookmarks, liveAccounts, liveReminders, hide]);

  useEffect(() => {
    const el = document.querySelector(".sr-item.active") as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const activate = useCallback((i: number) => {
    const it = items[i];
    hide(); setQ("");
    if (inputRef.current) inputRef.current.value = "";
    if (!it) return;
    if (it.kind === "reminder") goItem("reminders");
    else if (it.kind === "account") goItem("accounts");
    else {
      tc.openUrl(it.url);
      tc.markBookmarkOpened(it.data.id);
      tc.logActivity("open", "Abriste un marcador", it.title);
    }
  }, [items, hide, goItem, tc]);

  return (
    <div className="search-wrap">
      <span className="search-icon">🔎</span>
      <input id="search" ref={inputRef} type="text" placeholder="Buscar marcadores…  ( pulsa / )"
        autoComplete="off" spellCheck={false}
        onChange={(e) => {
          setQ(e.target.value);
          if (timer.current) window.clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = window.setTimeout(() => doSearch(v), 180);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); activate(active); }
          else if (e.key === "Escape") { hide(); (e.target as HTMLInputElement).blur(); }
        }}
        onBlur={() => window.setTimeout(hide, 150)} />
      <div id="searchResults" className={"search-results" + (open ? "" : " hidden")} role="listbox">
        {open && !items.length && <div className="sr-empty">Sin resultados para «{q}»</div>}
        {groups.map((g) => {
          let gi = 0;
          return (
            <div className="sr-group" key={g.label}>
              <h4>{g.label}</h4>
              {g.items.map((it) => {
                const i = flatIndex(groups, g, gi++);
                const letter = ((it.title || it.url || "?").trim().charAt(0) || "?").toUpperCase();
                return (
                  <div className={"sr-item" + (i === active ? " active" : "")} role="option" key={i}
                    onClick={() => activate(i)}
                    onMouseMove={() => setActive(i)}>
                    {it.fav
                      ? <T.FavImg src={it.fav} letter={letter} size={18} />
                      : <span className="fav-letter" style={{ width: 18, height: 18, fontSize: 11, margin: 0 }}>{letter}</span>}
                    <span className="t">{it.title}</span>
                    <span className="d">{it.sub}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* índice plano del item dentro de todos los grupos (para ↑↓/Enter) */
function flatIndex(groups: { label: string; items: SRItem[] }[], cur: { label: string }, n: number) {
  let i = 0;
  for (const g of groups) {
    if (g === cur) return i + n;
    i += g.items.length;
  }
  return i + n;
}

/* ================= Acciones del topbar ================= */

const svgProps = {
  viewBox: "0 0 24 24", width: 20, height: 20, fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
} as const;

function TopActions() {
  const tc = useTC();
  const { openModal, openDd, setOpenDd, setUi } = useApp();
  const toggle = (id: string) => setOpenDd(openDd === id ? null : id);

  return (
    <div className="top-actions">
      <NewFolderBtn />
      <button id="btnNewBookmark" className="tbtn" title="Añadir un marcador manualmente" aria-label="Añadir marcador"
        onClick={() => openModal("bookmark", {})}>
        <svg {...svgProps}><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /><path d="M12 7v6M9 10h6" /></svg>
      </button>
      <button id="btnNewNote" className="tbtn" title="Crear una nota" aria-label="Añadir nota"
        onClick={() => openModal("note", { id: null })}>
        <svg {...svgProps}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
      </button>
      <button id="btnShowNotes" className="tbtn" title="Ver notas" aria-label="Ver notas"
        onClick={() => setUi({ notes: true })}>
        <span style={{ fontSize: 17 }}>👁</span>
      </button>
      <span className="tsep" aria-hidden="true"></span>
      <div className="dd-wrap">
        <button id="btnSettings" className="tbtn" title="Configuración" aria-label="Configuración"
          onClick={() => toggle("ddSettings")}>
          <svg {...svgProps}><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2.2" /><circle cx="8" cy="16" r="2.2" /></svg>
        </button>
        <div id="ddSettings" className={"dropdown dropdown-right" + (openDd === "ddSettings" ? "" : " hidden")}>
          {openDd === "ddSettings" && <SettingsMenu />}
        </div>
      </div>
      <div className="dd-wrap">
        <button id="btnUser" className="tbtn" title="Usuario" aria-label="Usuario" onClick={() => toggle("ddUser")}>
          <svg {...svgProps}><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
        </button>
        <div id="ddUser" className={"dropdown dropdown-right" + (openDd === "ddUser" ? "" : " hidden")}>
          {openDd === "ddUser" && <UserMenu />}
        </div>
      </div>
      <div className="dd-wrap">
        <button id="btnHelp" className="tbtn" title="Ayuda" aria-label="Ayuda" onClick={() => toggle("ddHelp")}>
          <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2-2.5 3.4" /><path d="M12 17h.01" /></svg>
        </button>
        <div id="ddHelp" className={"dropdown dropdown-right" + (openDd === "ddHelp" ? "" : " hidden")}>
          {openDd === "ddHelp" && <HelpMenu />}
        </div>
      </div>
    </div>
  );
}

function NewFolderBtn() {
  const tc = useTC();
  const { ui, liveSpaces, openModal } = useApp();
  const newFolderFlow = () => {
    if (ui.folderId) { openModal("folder", { id: null, parentId: ui.folderId }); return; }
    const spaces = liveSpaces();
    if (ui.view === "home" || !ui.spaceId || !spaces.find((s) => s.id === ui.spaceId)) {
      if (!spaces.length) { tc.toast("Primero crea un space"); return; }
      if (spaces.length === 1) { openModal("folder", { id: null, parentId: null, spaceId: spaces[0].id }); return; }
      openModal("spacepick");
      return;
    }
    openModal("folder", { id: null, parentId: null, spaceId: ui.spaceId });
  };
  return (
    <button id="btnNewFolder" className="tbtn" title="Crear una carpeta en el space actual" aria-label="Añadir carpeta"
      onClick={newFolderFlow}>
      <svg {...svgProps}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><path d="M12 11v6M9 14h6" /></svg>
    </button>
  );
}

/* ================= Dropdowns ================= */

function DdItem({ act, icon, label, active, danger, onClick }: {
  act: string; icon: string; label: string; active?: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <button className={"dd-item" + (danger ? " danger" : "")} data-act={act} onClick={onClick}>
      <span className="dd-ico">{icon}</span><span>{label}</span>
      {active ? <span className="dd-check">✓</span> : null}
    </button>
  );
}
const DdSep = () => <div className="dd-sep"></div>;

function SettingsMenu() {
  const tc = useTC();
  const { setOpenDd, goItem, openModal } = useApp();
  const st = tc.db.settings;
  const close = () => setOpenDd(null);
  return (
    <>
      <DdItem act="collapse" icon="📁" label="Colapsar todas las carpetas" active={!!st.collapseFolders}
        onClick={() => { tc.updateSettings({ collapseFolders: !st.collapseFolders }); close(); tc.toast(!st.collapseFolders ? "Carpetas colapsadas" : "Carpetas expandidas"); }} />
      <DdItem act="unused" icon="⏳" label="Mostrar marcadores sin usar"
        onClick={() => { close(); goItem("unused"); }} />
      <DdItem act="dedupe" icon="🧹" label="Eliminar marcadores duplicados"
        onClick={async () => {
          close();
          /* regla de Duglass: toda acción destructiva pide confirmación */
          if (!confirm("¿Eliminar los marcadores duplicados? Se conservará el más antiguo de cada URL.")) return;
          const n = await tc.removeDuplicateBookmarks();
          tc.toast(n ? "Eliminados " + n + " marcador(es) duplicado(s)" : "No hay marcadores duplicados");
        }} />
      <DdItem act="tags" icon="🏷" label="Editar etiquetas"
        onClick={() => { close(); openModal("tags"); }} />
      <DdSep />
      <DdItem act="theme" icon={st.darkMode ? "☀️" : "🌙"} label={"Tema: " + (st.darkMode ? "Oscuro" : "Claro")}
        onClick={() => { close(); tc.updateSettings({ darkMode: !st.darkMode }); }} />
      <DdItem act="compact" icon="🗜" label="Vista minimalista" active={!!st.compactMode}
        onClick={() => { tc.updateSettings({ compactMode: !st.compactMode }); close(); tc.toast(!st.compactMode ? "Vista minimalista activada" : "Vista completa activada"); }} />
      <DdItem act="sametab" icon="🔗" label="Abrir marcadores en la misma pestaña" active={!!st.openInSameTab}
        onClick={() => {
          tc.updateSettings({ openInSameTab: !st.openInSameTab }); close();
          tc.toast(!st.openInSameTab ? "Los marcadores se abrirán en la misma pestaña" : "Los marcadores se abrirán en pestañas nuevas");
        }} />
      <DdSep />
      <DdItem act="import" icon="📥" label="Importar datos"
        onClick={() => { close(); openModal("io"); }} />
      <DdItem act="export" icon="📤" label="Exportar y respaldo"
        onClick={() => { close(); tc.exportJSON(); tc.toast("Copia de seguridad descargada"); }} />
      <DdItem act="clear" icon="🗑" label="Eliminar todos los marcadores" danger
        onClick={async () => {
          close();
          const live = tc.db.bookmarks.filter((b) => !b.deletedAt);
          if (!live.length) { tc.toast("No hay marcadores que eliminar"); return; }
          if (!confirm("¿Eliminar TODOS los " + live.length + " marcador(es) de todos los spaces?")) return;
          if (!confirm("¿Seguro? Esta acción no se puede deshacer.")) return;
          for (const b of live) await tc.trashBookmark(b.id);
          tc.toast("Todos los marcadores eliminados");
        }} />
      <DdSep />
      <DdItem act="logout" icon="🚪" label="Cerrar sesión"
        onClick={async () => {
          close();
          const { createClient } = await import("@/lib/supabase/client");
          await createClient().auth.signOut();
          window.location.href = "/login";
        }} />
    </>
  );
}

function UserMenu() {
  const tc = useTC();
  const { setOpenDd, liveNotes } = useApp();
  const st = tc.db.settings;
  const [name, setName] = useState(st.displayName || "");
  const saveName = () => {
    tc.updateSettings({ displayName: name.trim() });
    setOpenDd(null); tc.toast("Nombre guardado");
  };
  return (
    <div className="user-panel">
      <div className="up-name">👤 {st.displayName || "Usuario local"}</div>
      <div className="up-row">
        <input type="text" id="upName" placeholder="Tu nombre…" value={name} maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") saveName(); }} />
        <button className="btn primary" id="upSave" onClick={saveName}>OK</button>
      </div>
      <div className="stats-grid">
        <div className="stat"><b>{tc.db.spaces.filter((s) => !s.deletedAt).length}</b><span>Spaces</span></div>
        <div className="stat"><b>{tc.db.folders.filter((f) => !f.deletedAt).length}</b><span>Carpetas</span></div>
        <div className="stat"><b>{tc.db.bookmarks.filter((b) => !b.deletedAt).length}</b><span>Marcadores</span></div>
        <div className="stat"><b>{liveNotes().length}</b><span>Notas</span></div>
      </div>
      <div className="up-ver">BookDPB · datos en Supabase</div>
    </div>
  );
}

function HelpMenu() {
  const tc = useTC();
  const { setOpenDd, openModal } = useApp();
  const close = () => setOpenDd(null);
  const repairFavicons = async () => {
    close();
    const bms = tc.db.bookmarks.filter((b) => b.favicon);
    for (const b of bms) await tc.saveBookmark({ ...b, favicon: "" });
    tc.toast(bms.length ? "Favicons actualizados (" + bms.length + ")" : "No había favicons que reparar");
  };
  return (
    <>
      <DdItem act="guide" icon="📖" label="Cómo usar BookDPB" onClick={() => { close(); openModal("guide"); }} />
      <DdItem act="shortcuts" icon="⌨️" label="Atajos de teclado" onClick={() => { close(); openModal("shortcuts"); }} />
      <DdItem act="favicons" icon="🖼" label="Reparar favicons" onClick={repairFavicons} />
      <DdItem act="news" icon="🎁" label="Novedades" onClick={() => { close(); openModal("changelog"); }} />
      <DdItem act="feedback" icon="💬" label="Enviar comentarios" onClick={() => { close(); openModal("feedback"); }} />
    </>
  );
}

/* ================= Sidebar ================= */

function HomeButton() {
  const { ui, goHome } = useApp();
  const active = ui.view === "home" && !ui.notes;
  return (
    <div className="side-block home-block">
      <button className={"link-btn" + (active ? " active" : "")} onClick={goHome} title="Inicio">
        <span style={{ fontSize: 15 }}>🏠</span>
        <span style={{ marginLeft: 6 }}>Home</span>
      </button>
    </div>
  );
}

export function Sidebar() {
  const tc = useTC();
  const sbRef = useRef<HTMLElement>(null);
  const timers = useRef<{ open: number | null; close: number | null }>({ open: null, close: null });

  const pinned = !!tc.db.settings.sidebarPinned;

  const sbOpenSoon = () => {
    if (timers.current.close) window.clearTimeout(timers.current.close);
    if (timers.current.open) window.clearTimeout(timers.current.open);
    timers.current.open = window.setTimeout(() => document.body.classList.add("sb-open"), 150);
  };
  const sbCloseSoon = () => {
    if (timers.current.open) window.clearTimeout(timers.current.open);
    if (timers.current.close) window.clearTimeout(timers.current.close);
    timers.current.close = window.setTimeout(() => {
      if (!tc.db.settings.sidebarPinned) document.body.classList.remove("sb-open");
    }, 400);
  };

  const orderedSecs = () => {
    const saved = (tc.db.settings.sidebarLayout || []).filter((k) => SEC_DEFAULT.includes(k));
    return saved.concat(SEC_DEFAULT.filter((k) => !saved.includes(k)));
  };

  const pinSidebar = () => {
    tc.updateSettings({ sidebarPinned: !pinned });
    if (timers.current.open) window.clearTimeout(timers.current.open);
    if (timers.current.close) window.clearTimeout(timers.current.close);
    document.body.classList.remove("sb-open");
    tc.toast(!pinned ? "Barra lateral fijada" : "La barra lateral se colapsará al quitar el ratón");
  };

  return (
    <aside className="sidebar" id="sidebar" ref={sbRef}
      onMouseEnter={() => { if (!pinned) sbOpenSoon(); }}
      onMouseLeave={() => { if (!pinned) sbCloseSoon(); }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (timers.current.close) window.clearTimeout(timers.current.close);
        if (timers.current.open) window.clearTimeout(timers.current.open);
        document.body.classList.add("sb-open");
      }}
      onDragLeave={(e) => { if (!sbRef.current?.contains(e.relatedTarget as Node)) sbCloseSoon(); }}>
      <div className="sidebar-pin-row">
        <button id="btnPinSidebar" className={"icon-btn pin-btn" + (pinned ? " active" : "")}
          title="Fijar barra lateral" onClick={pinSidebar}>{pinned ? "📍" : "📌"}</button>
      </div>
      <HomeButton />
      {/* NOTA: sección «Pestañas abiertas» no portable a web (chrome.tabs) — omitida */}
      <div id="sideSections" onMouseDownCapture={(e) => { downEl = e.target as HTMLElement; }}>
        {orderedSecs().map((k) => {
          if (k === "allfolders") return <AllFoldersSec key={k} />;
          if (k === "spaces") return <SpacesSec key={k} />;
          if (k === "misitems") return <MisItemsSec key={k} />;
          if (k === "youtube") return <YoutubeSec key={k} />;
          if (k === "tags") return <TagsSec key={k} />;
          /* NOTA: sección «Sesiones guardadas» no portable a web (chrome.tabs) — omitida */
          return null;
        })}
      </div>
    </aside>
  );
}

function SecShell({ secKey, className, children }: { secKey: string; className: string; children: React.ReactNode }) {
  const tc = useTC();
  const { clearDropMarks } = useDnD();
  const ref = useRef<HTMLElement>(null);
  const persist = (keys: string[]) => tc.updateSettings({ sidebarLayout: keys });

  return (
    <section ref={ref} className={className} data-sec={secKey} draggable
      onDragStart={(e) => {
        if (e.target !== ref.current) return;
        const from = downEl; downEl = null;
        if (from && from.closest("button, input, a, .icon-btn, [data-act]")) { e.preventDefault(); return; }
        if (!from || !from.closest(".sec-grip, h3, .item-head")) { e.preventDefault(); return; }
        dragState = { type: DT_SEC, id: secKey };
        e.dataTransfer.setData(DT_SEC, secKey);
        e.dataTransfer.effectAllowed = "move";
        ref.current?.classList.add("dragging");
      }}
      onDragEnd={() => {
        ref.current?.classList.remove("dragging");
        clearDropMarks(document.getElementById("sideSections"));
        downEl = null;
      }}
      onDragOver={(e) => {
        if (!T.hasDT(e, DT_SEC)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragState || dragState.id === secKey) return;
        const r = ref.current!.getBoundingClientRect();
        const after = e.clientY - r.top > r.height / 2;
        ref.current!.classList.toggle("drop-before", !after);
        ref.current!.classList.toggle("drop-after", after);
      }}
      onDragLeave={(e) => {
        if (ref.current?.contains(e.relatedTarget as Node)) return;
        ref.current?.classList.remove("drop-before");
        ref.current?.classList.remove("drop-after");
      }}
      onDrop={(e) => {
        if (!T.hasDT(e, DT_SEC)) return;
        e.preventDefault(); e.stopPropagation();
        const after = ref.current!.classList.contains("drop-after");
        ref.current?.classList.remove("drop-before");
        ref.current?.classList.remove("drop-after");
        const dragKey = dragState && dragState.id;
        dragState = null;
        if (!dragKey || dragKey === secKey) return;
        const saved = (tc.db.settings.sidebarLayout || []).filter((k) => SEC_DEFAULT.includes(k));
        const base = saved.concat(SEC_DEFAULT.filter((k) => !saved.includes(k)));
        const keys = base.filter((k) => k !== dragKey);
        const to = keys.indexOf(secKey) + (after ? 1 : 0);
        if (to < 0) return;
        keys.splice(to, 0, dragKey);
        persist(keys);
      }}>
      {children}
    </section>
  );
}

function AllFoldersSec() {
  const { ui, goSpace } = useApp();
  const tc = useTC();
  return (
    <SecShell secKey="allfolders" className="side-block">
      <span className="sec-grip" title="Arrastrar para reordenar">⋮⋮</span>
      <button id="btnAllFolders"
        className={"link-btn" + (ui.view === "all" && !ui.notes ? " active" : "")}
        onClick={() => {
          const sp = ui.spaceId || tc.db.spaces.find((s) => !s.deletedAt)?.id || null;
          if (sp) goSpace(sp);
        }}>
        <T.FolderSVG size={14} fill="currentColor" />
        <span style={{ marginLeft: 6 }}>Todas las carpetas</span>
      </button>
    </SecShell>
  );
}

function SpacesSec() {
  const tc = useTC();
  const { liveSpaces, openModal } = useApp();
  const spaces = liveSpaces().slice().sort(T.byOrder);

  return (
    <SecShell secKey="spaces" className="side-section">
      <h3><span className="sec-grip" title="Arrastrar para reordenar la sección">⋮⋮</span>
        <span className="h3-label">Spaces</span>{" "}
        <button id="btnNewSpace" className="mini-btn" title="Crear space"
          onClick={() => openModal("space", { id: null })}>＋</button></h3>
      <ul id="spaceTree" className="space-tree">
        {!spaces.length && (
          <li style={{ cursor: "default", color: "var(--muted)", fontSize: 12.5 }}>Sin spaces. Crea uno con ＋.</li>
        )}
        {spaces.map((sp) => (
          <SpaceNode key={sp.id} sp={sp} />
        ))}
        {!!spaces.length && <li className="reorder-endzone" data-kind="space"
          onDragOver={(e) => {
            if (!T.hasDT(e, T.DT_SPACE)) return;
            e.preventDefault(); e.dataTransfer.dropEffect = "move";
            (e.currentTarget as HTMLElement).classList.add("drop-before");
          }}
          onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-before")}
          onDrop={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).classList.remove("drop-before");
            if (T.hasDT(e, T.DT_SPACE)) tc.reorderSpaces(e.dataTransfer.getData(T.DT_SPACE), null);
          }} />}
      </ul>
    </SecShell>
  );
}

function SpaceNode({ sp }: { sp: T.Space }) {
  const tc = useTC();
  const app = useApp();
  const { ui, openModal, spaceStats, isExpanded, toggleSpace, goSpace, liveSpaces, setUi } = app;
  const { clearDropMarks } = useDnD();
  const expanded = isExpanded(sp.id);
  const st = spaceStats(sp);
  const active = sp.id === ui.spaceId && !ui.notes;

  const deleteSpace = async () => {
    if (liveSpaces().length <= 1) { tc.toast("No puedes eliminar el único space"); return; }
    if (!confirm("¿Enviar el space «" + sp.name + "» con todas sus carpetas y marcadores a la papelera?")) return;
    await tc.trashSpace(sp.id);
    await tc.logActivity("delete", "Enviaste un space a la papelera", sp.name);
    tc.updateSettings({ activeSpaceId: null, activeFolderId: null });
    setUi({ spaceId: null, folderId: null, view: "all", notes: false });
    tc.toast("Space enviado a la papelera");
  };

  return (
    <li className="space-node" data-sid={sp.id}>
      <div className={"space-row" + (active ? " active" : "")} draggable data-srow={sp.id}
        onClick={(e) => {
          const btn = (e.target as HTMLElement).closest("[data-act]");
          const act = btn?.getAttribute("data-act");
          if (act === "expand") { e.stopPropagation(); toggleSpace(sp.id); return; }
          if (act === "add") { e.stopPropagation(); openModal("folder", { id: null, parentId: null, spaceId: sp.id }); return; }
          if (act === "rename") { e.stopPropagation(); openModal("space", { id: sp.id }); return; }
          if (act === "del") { e.stopPropagation(); deleteSpace(); return; }
          goSpace(sp.id);
        }}
        onDragStart={(e) => {
          dragState = { type: T.DT_SPACE, id: sp.id };
          e.dataTransfer.setData(T.DT_SPACE, sp.id);
          e.dataTransfer.effectAllowed = "move";
          (e.currentTarget as HTMLElement).classList.add("dragging");
        }}
        onDragEnd={(e) => {
          (e.currentTarget as HTMLElement).classList.remove("dragging");
          clearDropMarks(document.getElementById("spaceTree"));
        }}
        onDragOver={(e) => {
          if (T.hasDT(e, T.DT_SPACE)) {
            e.preventDefault(); e.dataTransfer.dropEffect = "move";
            if (!dragState || dragState.id !== sp.id) (e.currentTarget as HTMLElement).classList.add("drop-before");
            return;
          }
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.add("drop-target");
        }}
        onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-before")}
        onDrop={(e) => {
          e.preventDefault();
          const el = e.currentTarget as HTMLElement;
          el.classList.remove("drop-before"); el.classList.remove("drop-target");
          if (T.hasDT(e, T.DT_SPACE)) { tc.reorderSpaces(e.dataTransfer.getData(T.DT_SPACE), sp.id); return; }
          if (T.hasDT(e, T.DT_BOOKMARK)) {
            tc.moveBookmarkTo(e.dataTransfer.getData(T.DT_BOOKMARK), sp.id).then(() => tc.toast("Marcador movido"));
          }
        }}>
        <button className="chev" data-act="expand" title={expanded ? "Contraer carpetas" : "Desplegar carpetas"}>
          {expanded ? "▾" : "▸"}</button>
        <T.SpaceIconEl sp={sp} />
        <span className="side-name">{sp.name}</span>
        <span className="count">{st.bms.length}</span>
        <span className="row-actions">
          <button className="icon-btn" data-act="add" title="Crear carpeta en este space">＋</button>
          <button className="icon-btn" data-act="rename" title="Editar">✎</button>
          <button className="icon-btn" data-act="del" title="Eliminar">×</button>
        </span>
      </div>
      {expanded && <ul className="sub-tree"><FolderRows spaceId={sp.id} parentId={null} depth={0} /></ul>}
    </li>
  );
}

function FolderRows({ spaceId, parentId, depth }: { spaceId: string; parentId: string | null; depth: number }) {
  const tc = useTC();
  const app = useApp();
  const { ui, liveFolders, childFolders, isCollapsed, toggleCollapse, folderById, countDirect, openModal, goFolder, setUi } = app;
  const { clearDropMarks } = useDnD();
  const kids = (parentId
    ? childFolders(parentId)
    : liveFolders().filter((f) => f.spaceId === spaceId && !f.parentId).sort(T.byOrder));

  const deleteFolder = async (f: T.Folder) => {
    const ids = T.folderTreeIds(liveFolders(), f.id);
    const n = tc.db.bookmarks.filter((b) => !b.deletedAt && b.folderId && ids.includes(b.folderId)).length;
    const subs = ids.length - 1;
    let msg = "¿Enviar a la papelera la carpeta «" + f.name + "»";
    if (subs) msg += " y sus " + subs + " subcarpeta(s)";
    if (n) msg += " con sus " + n + " marcador(es)";
    msg += "?";
    if (!confirm(msg)) return;
    await tc.trashFolder(f.id);
    await tc.logActivity("delete", "Enviaste una carpeta a la papelera", f.name);
    if (ids.includes(ui.folderId || "")) {
      tc.updateSettings({ activeFolderId: null });
      setUi({ folderId: null, view: "all" });
    }
    tc.toast("Carpeta enviada a la papelera");
  };

  return (
    <>
      {kids.map((f) => {
        const children = childFolders(f.id);
        const hasKids = children.length > 0;
        const collapsed = isCollapsed(f.id);
        const active = f.id === ui.folderId && !ui.notes;
        return (
          <React.Fragment key={f.id}>
          <li data-fid={f.id} draggable
            className={"sub-row" + (active ? " active" : "")}
            style={{ "--depth": depth } as CSSProperties}
            onClick={(e) => {
              const btn = (e.target as HTMLElement).closest("[data-act]");
              const act = btn?.getAttribute("data-act");
              if (act === "toggle") { e.stopPropagation(); toggleCollapse(f.id); return; }
              if (act === "add") { e.stopPropagation(); openModal("folder", { id: null, parentId: f.id }); return; }
              if (act === "rename") { e.stopPropagation(); openModal("folder", { id: f.id }); return; }
              if (act === "del") { e.stopPropagation(); deleteFolder(f); return; }
              goFolder(f.id);
            }}
            onDragStart={(e) => {
              dragState = { type: T.DT_FOLDER, id: f.id };
              e.dataTransfer.setData(T.DT_FOLDER, f.id);
              e.dataTransfer.effectAllowed = "move";
              (e.currentTarget as HTMLElement).classList.add("dragging");
            }}
            onDragEnd={(e) => {
              (e.currentTarget as HTMLElement).classList.remove("dragging");
              clearDropMarks(document.getElementById("spaceTree"));
            }}
            onDragOver={(e) => {
              if (T.hasDT(e, T.DT_FOLDER)) {
                e.preventDefault(); e.dataTransfer.dropEffect = "move";
                if (dragState) {
                  const df = folderById(dragState.id), tf = folderById(f.id);
                  if (!df || !tf || df.spaceId !== tf.spaceId || (df.parentId || null) !== (tf.parentId || null)) return;
                }
                if (!dragState || dragState.id !== f.id) (e.currentTarget as HTMLElement).classList.add("drop-before");
                return;
              }
              e.preventDefault();
              (e.currentTarget as HTMLElement).classList.add("drop-target");
            }}
            onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-before")}
            onDrop={(e) => {
              e.preventDefault();
              const el = e.currentTarget as HTMLElement;
              el.classList.remove("drop-before"); el.classList.remove("drop-target");
              if (T.hasDT(e, T.DT_FOLDER)) { tc.reorderFolders(e.dataTransfer.getData(T.DT_FOLDER), f.id); return; }
              if (T.hasDT(e, T.DT_BOOKMARK)) {
                tc.moveBookmarkTo(e.dataTransfer.getData(T.DT_BOOKMARK), f.id).then(() => tc.toast("Marcador movido"));
              }
            }}>
            {hasKids
              ? <button className="chev" data-act="toggle" title={collapsed ? "Expandir" : "Colapsar"}>{collapsed ? "▸" : "▾"}</button>
              : <span className="chev-spacer"></span>}
            <span className="folder-ico"><T.FolderIconEl f={f} size={15} /></span>
            <span className="side-name">{f.name}</span>
            <span className="count">{countDirect(f.id)}</span>
            <span className="row-actions">
              <button className="icon-btn" data-act="add" title="Crear subcarpeta">＋</button>
              <button className="icon-btn" data-act="rename" title="Editar">✎</button>
              <button className="icon-btn" data-act="del" title="Eliminar">×</button>
            </span>
          </li>
          {hasKids && !collapsed && (
            <li className="sub-kids">
              <ul className="sub-tree">
                <FolderRows spaceId={spaceId} parentId={f.id} depth={depth + 1} />
              </ul>
            </li>
          )}
          </React.Fragment>
        );
      })}
      <li className="reorder-endzone" data-kind="folder" data-space={spaceId} data-parent={parentId || ""}
        onDragOver={(e) => {
          if (!T.hasDT(e, T.DT_FOLDER)) return;
          e.preventDefault(); e.dataTransfer.dropEffect = "move";
          if (dragState) {
            const df = folderById(dragState.id);
            if (!df || df.spaceId !== spaceId || (df.parentId || null) !== (parentId || null)) return;
          }
          (e.currentTarget as HTMLElement).classList.add("drop-before");
        }}
        onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-before")}
        onDrop={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove("drop-before");
          if (T.hasDT(e, T.DT_FOLDER)) tc.reorderFolders(e.dataTransfer.getData(T.DT_FOLDER), null);
        }} />
    </>
  );
}

/* ---------- Mis items (sidebar) ---------- */

/* ---------- Youtube Manager (bloque propio del sidebar, v2.3.8) ---------- */

function YoutubeSec() {
  const tc = useTC();
  const { ui, goYt, openModal, liveYtLists, liveYtVideos, liveYtChannels } = useApp();
  const { clearDropMarks } = useDnD();
  const ulRef = useRef<HTMLUListElement>(null);

  const orderedKeys = () => {
    const saved = (tc.db.settings.ytOrder || []).filter((k) => YT_KEYS.includes(k));
    return saved.concat(YT_KEYS.filter((k) => !saved.includes(k)));
  };
  const isExpanded = () => {
    const m = tc.db.settings.expandedItems || {};
    return m.youtube !== undefined ? !!m.youtube : true;
  };
  const toggleExpanded = () => {
    tc.updateSettings({ expandedItems: { ...(tc.db.settings.expandedItems || {}), youtube: !isExpanded() } });
  };
  const expanded = isExpanded();

  const lists = liveYtLists();
  const videos = liveYtVideos();
  const countOf = (key: string) => {
    if (key === "ytlists") return lists.filter((l) => !l.parentId).length;
    if (key === "ytsubs") return liveYtChannels().length;
    if (key === "ytdone") return lists.filter((l) => {
      const vs = videos.filter((v) => v.listId === l.id);
      return vs.length > 0 && vs.every((v) => v.watched);
    }).length;
    return 0;
  };
  const active = (key: string) =>
    ui.view === key || (key === "ytlists" && ui.view === "ytlist");

  return (
    <SecShell secKey="youtube" className="side-section">
      <ul className="item-tree" ref={ulRef}>
        <li className="item-section">
          <div className={"item-head" + (ui.view.startsWith("yt") ? " active" : "")} role="button" tabIndex={0}
            title="Youtube Manager: tus listas y canales de YouTube"
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest('[data-act="add"]')) { e.stopPropagation(); openModal("ytlist", { parentId: null }); return; }
              if (t.closest(".chev")) { toggleExpanded(); return; }
              if (t.closest(".sec-grip")) return;
              goYt("ytlists");
            }}>
            <span className="chev">{expanded ? "▾" : "▸"}</span>
            <span className="sec-grip" title="Arrastrar para reordenar la sección">⋮⋮</span>
            <span className="sec-ico" style={{ display: "inline-flex" }}><T.YtLogo size={17} /></span>
            <span className="side-name">YOUTUBE MANAGER</span>
            <span className="icon-btn item-add" data-act="add" title="Nueva lista">＋</span>
          </div>
          {expanded && (
            <ul className="item-rows">
              {orderedKeys().map((key) => {
                const d = YT_DEFS[key];
                return (
                  <li className="item-row-wrap" data-wrap={key} key={key}>
                    <div className={"item-row" + (active(key) ? " active" : "")} draggable
                      data-item={key} title={d.hint}
                      onClick={() => goYt(key)}
                      onDragStart={(e) => {
                        dragState = { type: T.DT_YTSEC, id: key };
                        e.dataTransfer.setData(T.DT_YTSEC, key);
                        e.dataTransfer.effectAllowed = "move";
                        (e.currentTarget as HTMLElement).classList.add("dragging");
                      }}
                      onDragEnd={(e) => {
                        (e.currentTarget as HTMLElement).classList.remove("dragging");
                        clearDropMarks(ulRef.current);
                      }}
                      onDragOver={(e) => {
                        if (!T.hasDT(e, T.DT_YTSEC)) return;
                        e.preventDefault(); e.dataTransfer.dropEffect = "move";
                        if (!dragState || dragState.id === key) return;
                        (e.currentTarget as HTMLElement).classList.add("drop-before");
                      }}
                      onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-before")}
                      onDrop={(e) => {
                        if (!T.hasDT(e, T.DT_YTSEC)) return;
                        e.preventDefault(); e.stopPropagation();
                        (e.currentTarget as HTMLElement).classList.remove("drop-before");
                        const dragKey = dragState && dragState.id;
                        dragState = null;
                        if (!dragKey || dragKey === key) return;
                        const keys = orderedKeys().filter((k) => k !== dragKey);
                        const to = keys.indexOf(key);
                        if (to < 0) return;
                        keys.splice(to, 0, dragKey);
                        tc.updateSettings({ ytOrder: keys });
                      }}>
                      <span className="chev-spacer"></span>
                      <span className="item-ico">{d.icon}</span>
                      <span className="side-name">{d.label}</span>
                      <span className="count">{countOf(key)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      </ul>
    </SecShell>
  );
}

function MisItemsSec() {
  const tc = useTC();
  const app = useApp();
  const { ui, openModal, goItem, itemCount, itemPreview } = app;
  const { clearDropMarks } = useDnD();
  const ulRef = useRef<HTMLUListElement>(null);

  const orderedKeys = () => {
    const saved = (tc.db.settings.itemOrder || []).filter((k) => ITEM_KEYS.includes(k));
    return saved.concat(ITEM_KEYS.filter((k) => !saved.includes(k)));
  };
  const isItemsExpanded = () => {
    const m = tc.db.settings.expandedItems || {};
    return m.misitems !== undefined ? !!m.misitems : true;
  };
  const toggleItemsExpanded = () => {
    tc.updateSettings({ expandedItems: { ...(tc.db.settings.expandedItems || {}), misitems: !isItemsExpanded() } });
  };
  const isItemExpanded = (key: string) => !!((tc.db.settings.itemExpanded || {})[key]);
  const toggleItemExpanded = (key: string) => {
    tc.updateSettings({ itemExpanded: { ...(tc.db.settings.itemExpanded || {}), [key]: !isItemExpanded(key) } });
  };
  const expanded = isItemsExpanded();
  const defOf = (k: string) => T.ITEM_DEFS[k];

  return (
    <SecShell secKey="misitems" className="side-section">
      <ul id="itemList" className="item-tree" ref={ulRef}>
        <li className="item-section">
          <div className={"item-head" + (ui.view === "misitems" ? " active" : "")} role="button" tabIndex={0}
            title="Ver todos mis items"
            onClick={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest('[data-act="add"]')) { e.stopPropagation(); openModal("itempick"); return; }
              if (t.closest(".chev")) { toggleItemsExpanded(); return; }
              if (t.closest(".sec-grip")) return;
              goItem("misitems");
            }}>
            <span className="chev">{expanded ? "▾" : "▸"}</span>
            <span className="sec-grip" title="Arrastrar para reordenar la sección">⋮⋮</span>
            <img className="sec-ico" src="/misitems-icon.png" alt="" />
            <span className="side-name">MIS ITEMS</span>
            <span className="icon-btn item-add" data-act="add" title="Nuevo item">＋</span>
          </div>
          {expanded && (
            <ul className="item-rows">
              {orderedKeys().map((key) => {
                const d = defOf(key);
                const ie = isItemExpanded(key);
                const prev = ie ? itemPreview(key) : [];
                return (
                  <li className="item-row-wrap" data-wrap={key} key={key}>
                    <div className={"item-row" + (ui.view === key ? " active" : "")} draggable
                      data-item={key} title={d.hint}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest(".it-chev")) return;
                        goItem(key);
                      }}
                      onDragStart={(e) => {
                        dragState = { type: DT_ITEMS, id: key };
                        e.dataTransfer.setData(DT_ITEMS, key);
                        e.dataTransfer.effectAllowed = "move";
                        (e.currentTarget as HTMLElement).classList.add("dragging");
                      }}
                      onDragEnd={(e) => {
                        (e.currentTarget as HTMLElement).classList.remove("dragging");
                        clearDropMarks(ulRef.current);
                      }}
                      onDragOver={(e) => {
                        if (!T.hasDT(e, DT_ITEMS)) return;
                        e.preventDefault(); e.dataTransfer.dropEffect = "move";
                        if (!dragState || dragState.id === key) return;
                        (e.currentTarget as HTMLElement).classList.add("drop-before");
                      }}
                      onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-before")}
                      onDrop={(e) => {
                        if (!T.hasDT(e, DT_ITEMS)) return;
                        e.preventDefault(); e.stopPropagation();
                        (e.currentTarget as HTMLElement).classList.remove("drop-before");
                        const dragKey = dragState && dragState.id;
                        dragState = null;
                        if (!dragKey || dragKey === key) return;
                        const keys = orderedKeys().filter((k) => k !== dragKey);
                        const to = keys.indexOf(key);
                        if (to < 0) return;
                        keys.splice(to, 0, dragKey);
                        tc.updateSettings({ itemOrder: keys });
                      }}>
                      <span className="chev it-chev" data-chev={key} title="Desplegar/contraer"
                        onClick={(e) => { e.stopPropagation(); toggleItemExpanded(key); }}>
                        {ie ? "▾" : "▸"}</span>
                      <span className="item-ico">{d.icon}</span>
                      <span className="side-name">{d.label}</span>
                      <span className="count">{itemCount(key)}</span>
                    </div>
                    {ie && (
                      prev.length
                        ? <div className="item-prev">{prev.map((p, i) => (
                          <div className="ip-entry" key={i} title={p.name}
                            onClick={() => goItem(key)}>
                            <span className="ip-ic">{d.icon}</span>
                            <span className="ip-name">{p.name.slice(0, 28)}</span>
                          </div>
                        ))}</div>
                        : <div className="item-prev item-prev-empty">Sin elementos</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      </ul>
    </SecShell>
  );
}

/* ---------- Etiquetas ---------- */

function TagsSec() {
  const { ui, setUi, allTags, tagColorOf, liveBookmarks } = useApp();
  const counts: Record<string, number> = {};
  liveBookmarks().forEach((b) => (b.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  const names = allTags();
  return (
    <SecShell secKey="tags" className="side-section">
      <h3><span className="sec-grip" title="Arrastrar para reordenar la sección">⋮⋮</span>
        <span className="h3-label">Etiquetas</span></h3>
      <div id="tagList" className="tag-list">
        {!names.length && <span className="tag-empty">Sin etiquetas todavía.</span>}
        {names.map((t) => {
          const c = tagColorOf(t);
          return (
            <button key={t} className={"tag-chip" + (ui.tag === t ? " active" : "")}
              data-tag={t} style={{ "--tagc": c } as CSSProperties}
              onClick={() => setUi({ tag: ui.tag === t ? null : t, notes: false, view: ui.tag === t ? ui.view : "tag" })}>
              <span className="tag-dot" style={{ background: c }}></span>#{t}
            </button>
          );
        })}
      </div>
    </SecShell>
  );
}

/* ================= Modales: ayuda + selectores (locales) ================= */

function ModalShell({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  const { closeModal } = useApp();
  return (
    <div className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className={"modal" + (wide ? " modal-wide" : "")}>
        {children}
      </div>
    </div>
  );
}

function HelpModals() {
  const { modal, closeModal, openModal, liveSpaces } = useApp();
  if (!modal) return null;
  const kind = modal.kind;
  if (kind === "guide") {
    return (
      <ModalShell wide>
        <div className="help-modal"><h3>📖 Cómo usar BookDPB</h3>
          <h4>Guardar pestañas</h4><ol>
            <li>En la barra lateral, abre <b>«Pestañas abiertas»</b> y <b>arrastra</b> una pestaña a cualquier carpeta o tarjeta de space.</li>
            <li>O pulsa <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> para guardar la pestaña actual, o clic derecho → «Guardar esta pestaña en BookDPB».</li>
            <li>Usa el icono de la barra de herramientas para un guardado rápido con etiquetas.</li></ol>
          <h4>Organizar</h4><ul>
            <li>Crea <b>Spaces</b> (uno por proyecto) y <b>carpetas y subcarpetas</b> de colores dentro de cada uno (botón ＋ al pasar el ratón). Ponles un <b>icono emoji o una imagen</b> (subida o por URL) al crearlas o editarlas.</li>
            <li><b>Arrastra para reordenar</b>: spaces y carpetas en la barra lateral, tarjetas de space en Home, tarjetas de carpeta en cada space y marcadores dentro de cada carpeta.</li>
            <li>Arrastra las tarjetas de marcador entre carpetas y subcarpetas para moverlas, o añade marcadores manualmente con el <b>icono de marcador ＋</b> de la barra superior.</li>
            <li>Añade <b>etiquetas</b> al editar un marcador y fíltralas desde la barra lateral; cada etiqueta tiene su <b>color</b> (cámbialo en ⚙️ → «Editar etiquetas»).</li>
            <li>La barra lateral se <b>colapsa sola</b> y se abre al pasar el ratón; fíjala con 📌.</li></ul>
          <h4>Mis items</h4>
          <p>La sección <b>MIS ITEMS</b> de la barra lateral agrupa: <b>🔑 Cuentas</b> (nombre, URL, usuario, email, contraseña y logo automático del dominio), <b>⏰ Recordatorios</b> (te avisan con notificación aunque el panel esté cerrado, con color e icono propios), <b>⭐ Favoritos</b>, <b>🕘 Historial</b>, <b>🗑 Papelera</b> y <b>🔖 Haciendo</b>. Todo se puede reordenar arrastrando.</p>
          <h4>Papelera</h4>
          <p>Todo lo que elimines va a la <b>🗑 Papelera</b>: puedes restaurarlo, eliminarlo para siempre o vaciarla. Los elementos se purgan solos a los <b>30 días</b>.</p>
          <h4>Notas</h4>
          <p>El <b>icono de nota</b> de la barra superior abre el <b>editor enriquecido</b>: negrita, listas, colores, imágenes, vídeos y archivos adjuntos. Usa ⋯ en cada nota para fijar, archivar, marcarla para <b>leer después</b> o verla a pantalla completa.</p>
          <h4>Buscar</h4>
          <p>Pulsa <kbd>/</kbd> o <kbd>Ctrl</kbd>+<kbd>K</kbd> para buscar en marcadores, cuentas, asistentes, recordatorios, pestañas abiertas y cerradas recientemente.</p>
          <h4>Abrir BookDPB</h4>
          <p>BookDPB ya no toma la página de nueva pestaña: convive con otras extensiones (p. ej. Wallsflow). Ábrelo cuando quieras con el botón 🗂 del popup, clic derecho en su icono → «Abrir BookDPB», el panel lateral, o <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>.</p>
        </div>
        <div className="modal-actions"><button className="btn primary" onClick={closeModal}>Entendido</button></div>
      </ModalShell>
    );
  }
  if (kind === "shortcuts") {
    const rows: [string, string][] = [
      ["<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>", "Guardar la pestaña actual"],
      ["<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>", "Guardar la sesión (todas las pestañas)"],
      ["<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>", "Cambiar modo claro / oscuro"],
      ["<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>", "Abrir el panel de BookDPB"],
      ["<kbd>/</kbd> o <kbd>Ctrl</kbd>+<kbd>K</kbd>", "Enfocar la búsqueda global"],
      ["<kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd> <kbd>Esc</kbd>", "Navegar los resultados de búsqueda"],
      ["Arrastrar y soltar", "Guardar pestañas en carpetas y subcarpetas · mover marcadores · <b>reordenar</b> spaces, carpetas y marcadores"],
    ];
    return (
      <ModalShell>
        <div className="help-modal"><h3>⌨️ Atajos de teclado</h3>
          <table className="shortcut-table">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}><td dangerouslySetInnerHTML={{ __html: r[0] }} /><td dangerouslySetInnerHTML={{ __html: r[1] }} /></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-actions"><button className="btn primary" onClick={closeModal}>Cerrar</button></div>
      </ModalShell>
    );
  }
  if (kind === "changelog") {
    return (
      <ModalShell wide>
        <div className="help-modal changelog"><h3>🎁 Novedades de la v2.3.11</h3><ul>
          <li>📸 <b>Logos de los canales</b>: en Suscripciones cada canal enseña su foto real en círculo, como en tu extensión. Los canales que ya tenías se rellenan solos al abrir Suscripciones.</li>
          <li>▸ <b>Categorías plegables</b> en Suscripciones: clic en el nombre de una categoría (o en su flecha) para plegarla y desplegarla; lo que dejes plegado se recuerda en todos tus dispositivos.</li>
        </ul><h4 style={{ marginTop: 14 }}>v2.3.10</h4><ul>
          <li>▶️ <b>Botón de reproducir/pausar, ahora sí</b>: la causa era un choque de nombres en los estilos (su clase «main» es también la de la columna central de la app, que le metía 96px de relleno al abrir el reproductor). Botón redondo nuevo con el color de BookDPB, como el de tu extensión.</li>
          <li>📥 <b>Importar playlists, arreglado</b>: YouTube cambió el formato interno de sus páginas de playlist y por eso unas listas entraban y otras no. El importador ya lee los dos formatos.</li>
        </ul><h4 style={{ marginTop: 14 }}>v2.3.9</h4><ul>
          <li>▶️ <b>Botón de reproducir/pausar arreglado</b>: ya no sale deformado en la barra del reproductor; todos los botones de transporte son ahora iconos nítidos.</li>
          <li>👁 <b>Suscripciones y Completadas con vistas</b>: Cuadrícula, Lista y Tablero con zoom, igual que Listas. En el tablero de Suscripciones cada columna es una categoría: arrastra un canal de columna para moverlo.</li>
          <li>🗑 <b>Papelera para Youtube Manager</b>: borrar una lista, un video, un canal o una categoría ya no es para siempre — va a la papelera de MIS ITEMS y lo puedes recuperar durante 30 días.</li>
          <li>🔴 <b>Iconos nuevos, a tu gusto</b>: el bloque lleva el logo de YouTube y MIS ITEMS tu libreta azul.</li>
        </ul><h4 style={{ marginTop: 14 }}>v2.3.8</h4><ul>
          <li>📺 <b>Youtube Manager</b>: bloque nuevo en la barra lateral con tus listas y sublistas de YouTube (icono, imagen y color como en los spaces), reproductor integrado, suscripciones por categorías, listas completadas y drag & drop en todo.</li>
          <li>✓ <b>Marcar y desmarcar vistos</b> con un clic en el círculo de cada video; al terminar un video se marca solo, y el visto se sincroniza entre tus listas.</li>
          <li>🗂 <b>Arreglo</b>: los marcadores de una subcarpeta ya no aparecen en la carpeta raíz; cada marcador sale solo donde lo guardas.</li>
          <li>🤖 <b>«Asistentes IA» eliminado</b> de MIS ITEMS, a petición tuya.</li>
        </ul><h4 style={{ marginTop: 14 }}>v2.3.1</h4><ul>
          <li>🚪 <b>Cerrar sesión</b>: nuevo botón en el menú de Configuración para cambiar de cuenta.</li>
        </ul><h4 style={{ marginTop: 14 }}>v2.3.0</h4><ul>
          <li>🏠 <b>Home en la barra lateral</b>: la app arranca en Home por defecto.</li>
          <li>🗂 <b>«Todas las carpetas»</b> ya no sale en la barra lateral; solo existe dentro de Home.</li>
          <li>👁 <b>Ver notas</b>: el botón «📝 Ver notas» se quitó del contenido; ahora hay un 👁 arriba a la derecha junto al lápiz.</li>
          <li>↕️ <b>Drag & drop arreglado</b>: los botones de las tarjetas ya no bloquean el arrastre en Chrome.</li>
          <li>📤 <b>Exportaciones</b>: ahora se llaman «bookdpb-*» en vez de «tabmecode-*».</li>
          <li>🔖 <b>«Haciendo»</b>: «Leer después» ahora se llama «Haciendo» en toda la app.</li>
        </ul><h4 style={{ marginTop: 14 }}>v2.2.0</h4><ul>        </ul></div>
        <div className="modal-actions"><button className="btn primary" onClick={closeModal}>Cerrar</button></div>
      </ModalShell>
    );
  }
  if (kind === "feedback") {
    return (
      <ModalShell>
        <div className="help-modal"><h3>💬 Comentarios</h3>
          <p>Tus datos se guardan en <b>tu propio proyecto de Supabase</b>: no hay cuentas compartidas ni sincronización en la nube más allá de la que tú configures.</p>
          <p>Si tienes ideas de mejora, anótalas en una <b>nota</b> con la etiqueta <b>#idea</b> 😉 — tu copia es solo tuya.</p>
        </div>
        <div className="modal-actions"><button className="btn primary" onClick={closeModal}>Cerrar</button></div>
      </ModalShell>
    );
  }
  if (kind === "spacepick") {
    const spaces = liveSpaces();
    return (
      <ModalShell>
        <h3>¿En qué space creas la carpeta?</h3>
        <div className="space-pick">
          {spaces.map((sp) => (
            <button key={sp.id} className="btn space-pick-btn"
              onClick={() => { closeModal(); openModal("folder", { id: null, parentId: null, spaceId: sp.id }); }}>
              <T.SpaceIconEl sp={sp} />{sp.name}
            </button>
          ))}
        </div>
        <div className="modal-actions"><button className="btn" onClick={closeModal}>Cancelar</button></div>
      </ModalShell>
    );
  }
  if (kind === "itempick") {
    return (
      <ModalShell>
        <h3>＋ Nuevo item</h3>
        <div className="item-pick">
          <button className="btn item-pick-btn" onClick={() => { closeModal(); openModal("account", { id: null, coll: "accounts" }); }}>🔑 Cuenta</button>
          <button className="btn item-pick-btn" onClick={() => { closeModal(); openModal("reminder", { id: null }); }}>⏰ Recordatorio</button>
        </div>
        <div className="modal-actions"><button className="btn" onClick={closeModal}>Cancelar</button></div>
      </ModalShell>
    );
  }
  return null;
}

function ModalSwitch() {
  const { modal } = useApp();
  if (!modal) return null;
  if (HELP_KINDS.includes(modal.kind)) return <HelpModals />;
  return <Modals />;
}
