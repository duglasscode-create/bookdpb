"use client";
import { useState, useRef, useEffect } from "react";
import type { TabmeStore } from "@/lib/tabme-store";
import type { Sel } from "./types";
import { renderIcon } from "./icons";

/* Iconos SVG literales de TabmeCode v1.6.3 */
const I = {
  save: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  dup: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  folder: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
  bookmark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/></svg>,
  note: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  help: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

type Props = {
  store: TabmeStore;
  onSelect: (s: Sel) => void;
  onBackup: () => void;
  onDuplicates: () => void;
  onNewFolder: () => void;
  onNewBookmark: () => void;
  onNewNote: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onHelp: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onMenu: () => void;
};

export function Topbar(p: Props) {
  const { store } = p;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        wrapRef.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const needle = q.trim().toLowerCase();
  const hits = needle
    ? [
        ...store.spaces.filter((s) => s.name.toLowerCase().includes(needle)).slice(0, 3).map((s) => ({ kind: "Space", icon: s.icon || "📦", name: s.name, go: () => p.onSelect({ kind: "col", id: s.id }) })),
        ...store.folders.filter((f) => f.name.toLowerCase().includes(needle)).slice(0, 3).map((f) => ({ kind: "Carpeta", icon: f.icon || "📁", name: f.name, go: () => p.onSelect({ kind: "col", id: f.id }) })),
        ...store.bookmarks.filter((b) => b.title.toLowerCase().includes(needle) || b.url.toLowerCase().includes(needle)).slice(0, 6).map((b) => ({ kind: "Marcador", icon: null as string | null, name: b.title, url: b.url, go: () => window.open(b.url, "_blank") })),
      ]
    : [];

  const submit = () => {
    if (!needle) return;
    setOpen(false);
    p.onSelect({ kind: "search", q: q.trim() });
  };

  const act = (title: string, icon: React.ReactNode, fn: () => void, hideSm = false) => (
    <button key={title} className={`icon-btn${hideSm ? " hide-sm" : ""}`} title={title} onClick={fn}>{icon}</button>
  );

  return (
    <header className="topbar">
      <button className="icon-btn t-menu-btn" title="Menú" onClick={p.onMenu}>{I.menu}</button>
      <div className="brand" onClick={() => p.onSelect({ kind: "home" })} title="Inicio">
        <span className="brand-ico">🗂️</span><span>BookDPB</span>
      </div>

      <div className="search-wrap" ref={wrapRef}>
        <div className="searchbox">
          <span style={{ color: "var(--muted)", display: "inline-flex" }}>{I.search}</span>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
            placeholder="Buscar marcadores, carpetas…  ( / )"
          />
          <span className="search-kbd">/</span>
        </div>
        {open && needle && (
          <div className="search-pop">
            {hits.length === 0 && <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>Sin resultados. Pulsa Enter para buscar.</div>}
            {hits.map((h, i) => (
              <button key={i} className="search-pop-item" onClick={() => { setOpen(false); h.go(); }}>
                <span className="sp-ico">{h.icon ? renderIcon(h.icon, 16, "📁") : "🔖"}</span>
                <span className="sp-name">{h.name}</span>
                <span className="sp-kind">{h.kind}</span>
              </button>
            ))}
            <button className="search-pop-item" onClick={submit} style={{ borderTop: "1px solid var(--border)" }}>
              <span className="sp-ico">🔍</span><span className="sp-name">Buscar «{q.trim()}» en todo</span><span className="sp-kind">Enter</span>
            </button>
          </div>
        )}
      </div>

      <div className="top-actions">
        {act("Guardar respaldo", I.save, p.onBackup, true)}
        {act("Detectar duplicados", I.dup, p.onDuplicates, true)}
        {act("Nueva carpeta", I.folder, p.onNewFolder)}
        {act("Añadir marcador", I.bookmark, p.onNewBookmark)}
        {act("Nueva nota", I.note, p.onNewNote)}
        <span className="top-sep" />
        <button className="icon-btn" title={p.theme === "light" ? "Modo oscuro" : "Modo claro"} onClick={p.onToggleTheme}>
          {p.theme === "light" ? I.moon : I.sun}
        </button>
        {act("Configuración", I.gear, p.onOpenSettings)}
        {act("Ayuda", I.help, p.onHelp, true)}
        <button className="user-chip" title="Cerrar sesión" onClick={p.onLogout}>D</button>
      </div>
    </header>
  );
}
