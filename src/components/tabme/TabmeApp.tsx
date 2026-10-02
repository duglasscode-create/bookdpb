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

const SEC_DEFAULT = ["allfolders", "spaces", "misitems", "tags", "sessions"];
const ITEM_KEYS = ["accounts", "assistants", "reminders", "favorites", "history", "trash", "readlater"];
const HELP_KINDS = ["guide", "shortcuts", "changelog", "feedback", "spacepick", "itempick"];

const INITIAL_UI: UiState = {
  view: "home", spaceId: null, folderId: null, tag: null, notes: false,
  notesTab: "all", notesQuery: "", histFilter: "all",
  remindersTab: "all", trashTab: "all",
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
  const { ui, setUi, modal, closeModal, openDd, setOpenDd, getZoom, liveReminders } = useApp();
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
      <ModalSwitch />
      <div id="toastRoot" className="toasts">
        {tc.toasts.map((t) => (
          <div className="toast" key={t.id}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}

/* ================= Buscador global ================= */

type SRItem = { kind: string; title: string; url: string; fav: string; sub: string; data: any };

function SearchBox() {
  const tc = useTC();
  const { liveBookmarks, liveAccounts, liveAssistants, liveReminders, goItem } = useApp();
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
    const asis = liveAssistants()
      .filter((a) => ((a.name || "") + " " + (a.url || "") + " " + (a.username || "") + " " + (a.email || "") + " " + (a.note || "")).toLowerCase().includes(qq))
      .slice(0, 5)
      .map((a) => ({ kind: "assistant", title: a.name, url: a.url, fav: T.faviconFor(a.url), sub: "Asistente · " + T.domainOf(a.url), data: a }));
    if (accs.length || asis.length) gs.push({ label: "🔑 Cuentas y asistentes", items: accs.concat(asis) });
    const rems = liveReminders()
      .filter((r) => ((r.title || "") + " " + (r.note || "") + " " + (r.url || "")).toLowerCase().includes(qq))
      .slice(0, 5)
      .map((r) => ({ kind: "reminder", title: r.title, url: r.url, fav: "", sub: "Recordatorio · " + T.fmtDateTime(r.when), data: r }));
    if (rems.length) gs.push({ label: "⏰ Recordatorios", items: rems });
    /* NOTA: grupos «Pestañas abiertas» y «Cerradas recientemente» no portables a web (chrome.tabs) */
    const flat: SRItem[] = [];
    gs.forEach((g) => g.items.forEach((it) => flat.push(it)));
    setGroups(gs); setItems(flat); setActive(flat.length ? 0 : -1); setOpen(true);
  }, [liveBookmarks, liveAccounts, liveAssistants, liveReminders, hide]);

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
    else if (it.kind === "assistant") goItem("assistants");
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
  const { openModal, openDd, setOpenDd } = useApp();
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

function Sidebar() {
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
      {/* NOTA: sección «Pestañas abiertas» no portable a web (chrome.tabs) — omitida */}
      <div id="sideSections" onMouseDownCapture={(e) => { downEl = e.target as HTMLElement; }}>
        {orderedSecs().map((k) => {
          if (k === "allfolders") return <AllFoldersSec key={k} />;
          if (k === "spaces") return <SpacesSec key={k} />;
          if (k === "misitems") return <MisItemsSec key={k} />;
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
        if (!dragState || dragState.id === secKey) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
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
  const { ui, liveFolders, childFolders, isCollapsed, toggleCollapse, folderById, countInTree, openModal, goFolder, setUi } = app;
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
          <li key={f.id} data-fid={f.id} draggable
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
                if (dragState) {
                  const df = folderById(dragState.id), tf = folderById(f.id);
                  if (!df || !tf || df.spaceId !== tf.spaceId || (df.parentId || null) !== (tf.parentId || null)) return;
                }
                e.preventDefault(); e.dataTransfer.dropEffect = "move";
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
            <span className="count">{countInTree(f.id)}</span>
            <span className="row-actions">
              <button className="icon-btn" data-act="add" title="Crear subcarpeta">＋</button>
              <button className="icon-btn" data-act="rename" title="Editar">✎</button>
              <button className="icon-btn" data-act="del" title="Eliminar">×</button>
            </span>
            {hasKids && !collapsed && <FolderRows spaceId={spaceId} parentId={f.id} depth={depth + 1} />}
          </li>
        );
      })}
      <li className="reorder-endzone" data-kind="folder" data-space={spaceId} data-parent={parentId || ""}
        onDragOver={(e) => {
          if (!T.hasDT(e, T.DT_FOLDER)) return;
          if (dragState) {
            const df = folderById(dragState.id);
            if (!df || df.spaceId !== spaceId || (df.parentId || null) !== (parentId || null)) return;
          }
          e.preventDefault(); e.dataTransfer.dropEffect = "move";
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
            <span className="side-name">🗂 MIS ITEMS</span>
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
                        if (!dragState || dragState.id === key) return;
                        e.preventDefault(); e.dataTransfer.dropEffect = "move";
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
          <p>La sección <b>🗂 MIS ITEMS</b> de la barra lateral agrupa: <b>🔑 Cuentas</b> y <b>🤖 Asistentes IA</b> (nombre, URL, usuario, email, contraseña y logo automático del dominio), <b>⏰ Recordatorios</b> (te avisan con notificación aunque el panel esté cerrado, con color e icono propios), <b>⭐ Favoritos</b>, <b>🕘 Historial</b>, <b>🗑 Papelera</b> y <b>🔖 Leer después</b>. Todo se puede reordenar arrastrando.</p>
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
        <div className="help-modal changelog"><h3>🎁 Novedades de la v1.6.3</h3><ul>
          <li>▦ <b>Cuadrículas arregladas</b>: Mis Items, Cuentas, Asistentes IA, Recordatorios, Papelera, Leer después y Notas vuelven a verse en horizontal con varias columnas, como Favoritos.</li>
          <li>↕️ <b>Secciones del sidebar</b>: arrastrar «Todas las carpetas», SPACES, MIS ITEMS, ETIQUETAS y SESIONES GUARDADAS ya funciona de verdad (agarre ⋮⋮ o encabezado); la línea de inserción indica si cae antes o después.</li>
          <li>🕘 <b>Historial simplificado</b>: sin barra de vistas ni zoom; los filtros (Todos, Creados, Editados, Eliminados, Favoritos, Sesiones) ahora son fichas con el icono arriba y la etiqueta debajo.</li>
        </ul><h4 style={{ marginTop: 14 }}>v1.6.2</h4><ul>
          <li>🎨 <b>Diseño realineado</b>: todas las páginas de items comparten el mismo encabezado — icono, título, subtítulo, línea de meta y botón azul.</li>
          <li>↕️ <b>Sidebar reordenable por secciones</b>: «Todas las carpetas», SPACES, MIS ITEMS, ETIQUETAS y SESIONES GUARDADAS se arrastran (agarre ⋮⋮ o encabezado).</li>
          <li>🗂 <b>Página «Mis Items»</b>: clic en el encabezado de MIS ITEMS para ver todos los items como fichas.</li>
          <li>⏰ <b>Recordatorios con color e icono</b>: como las notas; la tarjeta muestra su color y su icono.</li>
        </ul><h4 style={{ marginTop: 14 }}>v1.6.1</h4><ul>
          <li>🔐 <b>Cuentas y Asistentes IA con campos de credenciales</b>: Usuario, Email y Contraseña (con 👁) además de Nombre, URL y Nota.</li>
          <li>▦☰▤ <b>Tres vistas en todas las páginas</b>: Cuadrícula, Lista y Tablero; en Recordatorios el Tablero separa Pendientes/Completados.</li>
          <li>🔍 <b>Zoom de tarjetas</b>: botones − / + en cada página (80 %–140 %, se recuerda).</li>
          <li>🗂 <b>Mis items renovado</b>: filas plegables, reordenables arrastrando.</li>
        </ul><h4 style={{ marginTop: 14 }}>v1.6.0</h4><ul>
          <li>🗂 <b>Mis items</b>: nueva sección plegable en la barra lateral.</li>
          <li>🔑 <b>Cuentas</b> y 🤖 <b>Asistentes IA</b>: nombre, URL, usuario, email, contraseña y logo automático del dominio.</li>
          <li>⏰ <b>Recordatorios</b>: título, fecha, hora, nota y enlace, con color e icono propios.</li>
          <li>⭐ <b>Favoritos</b> y 🔖 <b>Leer después</b>.</li>
          <li>🕘 <b>Historial</b> y 🗑 <b>Papelera unificada</b> (restaurar, eliminar, vaciar, purga a 30 días).</li>
        </ul><h4 style={{ marginTop: 14 }}>v1.5.0</h4><ul>
          <li>↕️ <b>Reordenar arrastrando</b>: spaces, carpetas y marcadores.</li>
          <li>🌈 <b>Selector de color con gradiente</b> (HSV + HEX/RGB).</li>
          <li>🖼 <b>Iconos con imagen</b> (PNG/JPG/SVG/WebP, máx. 200 KB).</li>
          <li>➕ <b>Añadir marcador manual</b> desde la barra superior.</li>
        </ul><h4 style={{ marginTop: 14 }}>v1.4.0</h4><ul>
          <li>🗂 <b>Barra lateral renovada</b>: carpetas anidadas bajo cada space.</li>
          <li>🎨 <b>Iconos personalizados</b> y <b>etiquetas con color</b>.</li>
          <li>📝 <b>Notas</b>: editor enriquecido, adjuntos, fijar, archivar, pantalla completa.</li>
        </ul></div>
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
          <button className="btn item-pick-btn" onClick={() => { closeModal(); openModal("account", { id: null, coll: "assistants" }); }}>🤖 Asistente IA</button>
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
