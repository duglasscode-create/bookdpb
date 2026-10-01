"use client";
import { useState } from "react";
import type { TabmeStore, TFolder, TSpace } from "@/lib/tabme-store";
import { selKey, type Sel } from "./types";
import { renderIcon } from "./icons";

import {
  Home, Star, BookMarked, Inbox, Tags, NotebookPen, Trash2,
  Plus, ChevronRight, Search, Sun, Moon, Settings, BookmarkPlus, X,
} from "lucide-react";

type Props = {
  store: TabmeStore;
  sel: Sel;
  onSelect: (s: Sel) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onNewSpace: () => void;
  onNewBookmark: () => void;
  onOpenSettings: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ store, sel, onSelect, expanded, onToggleExpand, onNewSpace, onNewBookmark, onOpenSettings, theme, onToggleTheme, mobileOpen, onCloseMobile }: Props) {
  const { spaces, folders, bookmarks, trash, tags, notes, countIn, moveBookmark, reorderCollections } = store;
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);

  const uncategorized = bookmarks.filter((b) => !b.folderId).length;
  const favCount = bookmarks.filter((b) => b.isFavorite).length;
  const rlCount = bookmarks.filter((b) => b.readLater).length;

  const navItem = (key: string, s: Sel, icon: React.ReactNode, label: string, count?: number) => (
    <button
      key={key}
      onClick={() => { onSelect(s); onCloseMobile(); }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
      onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setDragOver(null);
        const raw = e.dataTransfer.getData("text/plain") || "";
        if (raw.startsWith("bookmark:")) {
          const folderId = key === "uncategorized" ? null : undefined;
          if (folderId !== undefined) moveBookmark(raw.slice(9), folderId);
        }
      }}
      className={`t-tree-row w-full ${selKey(sel) === key ? "active" : ""} ${dragOver === key ? "drop-target" : ""}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--card-2)", color: "var(--muted)" }}>{count}</span>
      )}
    </button>
  );

  const handleRowDrop = (e: React.DragEvent, target: { kind: "space" | "folder"; id: string; parentId: string | null }) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    const raw = e.dataTransfer.getData("text/plain") || "";
    if (raw.startsWith("bookmark:")) {
      moveBookmark(raw.slice(9), target.id);
      return;
    }
    // Reordenar spaces o carpetas hermanas
    const m = raw.match(/^(space|folder):(.+)$/);
    if (!m) return;
    const [, kind, dragId] = m;
    if (kind === "space" && target.kind === "space" && dragId !== target.id) {
      const ids = spaces.map((s) => s.id);
      const from = ids.indexOf(dragId), to = ids.indexOf(target.id);
      if (from !== -1 && to !== -1) { ids.splice(from, 1); ids.splice(to, 0, dragId); reorderCollections(ids); }
    } else if (kind === "folder" && target.kind === "folder" && dragId !== target.id) {
      const dragF = folders.find((f) => f.id === dragId);
      if (dragF && dragF.parentId === target.parentId) {
        const ids = folders.filter((f) => f.parentId === target.parentId).map((f) => f.id);
        const from = ids.indexOf(dragId), to = ids.indexOf(target.id);
        if (from !== -1 && to !== -1) { ids.splice(from, 1); ids.splice(to, 0, dragId); reorderCollections(ids); }
      }
    }
  };

  const renderFolder = (f: TFolder, depth: number) => {
    const kids = folders.filter((x) => x.parentId === f.id);
    const isExp = expanded.has(f.id);
    const key = `col:${f.id}`;
    return (
      <div key={f.id}>
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/plain", `folder:${f.id}`); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(key); }}
          onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
          onDrop={(e) => handleRowDrop(e, { kind: "folder", id: f.id, parentId: f.parentId })}
          onClick={() => { onSelect({ kind: "col", id: f.id }); onCloseMobile(); }}
          className={`t-tree-row ${selKey(sel) === key ? "active" : ""} ${dragOver === key ? "drop-target" : ""}`}
          style={{ paddingLeft: 8 + depth * 16 }}
          title="Arrastra para reordenar o suelta marcadores aquí"
        >
          {kids.length > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); onToggleExpand(f.id); }} className="t-icon-btn" style={{ width: 24, height: 24 }} aria-label="Expandir">
              <ChevronRight size={14} style={{ transform: isExp ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            </button>
          ) : <span style={{ width: 24 }} />}
          <span className="shrink-0 text-[15px]">{renderIcon(f.icon, 15, "📁")}</span>
          <span className="flex-1 truncate">{f.name}</span>
          {countIn(f.id) > 0 && <span className="text-[11px]" style={{ color: "var(--muted)" }}>{countIn(f.id)}</span>}
        </div>
        {isExp && kids.map((k) => renderFolder(k, depth + 1))}
      </div>
    );
  };

  const renderSpace = (s: TSpace) => {
    const kids = folders.filter((x) => x.parentId === s.id);
    const isExp = expanded.has(s.id);
    const key = `col:${s.id}`;
    return (
      <div key={s.id}>
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/plain", `space:${s.id}`); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(key); }}
          onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
          onDrop={(e) => handleRowDrop(e, { kind: "space", id: s.id, parentId: null })}
          onClick={() => { onSelect({ kind: "col", id: s.id }); onCloseMobile(); }}
          className={`t-tree-row ${selKey(sel) === key ? "active" : ""} ${dragOver === key ? "drop-target" : ""}`}
          title="Arrastra para reordenar o suelta marcadores aquí"
        >
          {kids.length > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); onToggleExpand(s.id); }} className="t-icon-btn" style={{ width: 24, height: 24 }} aria-label="Expandir">
              <ChevronRight size={14} style={{ transform: isExp ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            </button>
          ) : <span style={{ width: 24 }} />}
          <span className="shrink-0 text-[15px]">{renderIcon(s.icon, 15, "📦")}</span>
          <span className="flex-1 truncate font-semibold">{s.name}</span>
          {countIn(s.id) > 0 && <span className="text-[11px]" style={{ color: "var(--muted)" }}>{countIn(s.id)}</span>}
        </div>
        {isExp && <div className="mt-0.5 space-y-0.5">{kids.map((k) => renderFolder(k, 1))}</div>}
      </div>
    );
  };

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <span className="text-xl">🗂️</span>
        <h1 className="flex-1 text-[17px] font-bold tracking-tight">BookDPB</h1>
        <button className="t-icon-btn" onClick={onToggleTheme} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="t-icon-btn" onClick={onOpenSettings} title="Ajustes, importar/exportar">
          <Settings size={17} />
        </button>
        <button className="t-icon-btn md:hidden" onClick={onCloseMobile} title="Cerrar"><X size={17} /></button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value.trim()) onSelect({ kind: "search", q: e.target.value.trim() }); else if (sel.kind === "search") onSelect({ kind: "home" }); }}
            placeholder="Buscar marcadores..."
            className="t-input"
            style={{ paddingLeft: 34 }}
          />
        </div>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {navItem("home", { kind: "home" }, <Home size={16} />, "Inicio")}
        {navItem("favorites", { kind: "favorites" }, <Star size={16} />, "Favoritos", favCount)}
        {navItem("readlater", { kind: "readlater" }, <BookMarked size={16} />, "Leer después", rlCount)}
        {navItem("uncategorized", { kind: "uncategorized" }, <Inbox size={16} />, "Sin carpeta", uncategorized)}
        {navItem("tags", { kind: "tags" }, <Tags size={16} />, "Etiquetas", tags.length)}
        {navItem("notes", { kind: "notes" }, <NotebookPen size={16} />, "Notas", notes.length)}
        {navItem("trash", { kind: "trash" }, <Trash2 size={16} />, "Papelera", trash.length)}

        <div className="flex items-center justify-between px-2 pb-1 pt-4">
          <span className="t-section-title" style={{ margin: 0 }}>Spaces</span>
          <button onClick={onNewSpace} className="t-icon-btn" style={{ width: 28, height: 28 }} title="Nuevo space">
            <Plus size={16} />
          </button>
        </div>
        {spaces.length === 0 && (
          <p className="px-2 py-3 text-[13px]" style={{ color: "var(--muted)" }}>
            Sin spaces. Crea uno con ＋.
          </p>
        )}
        <div className="space-y-0.5">{spaces.map(renderSpace)}</div>
      </div>

      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <button onClick={onNewBookmark} className="t-btn t-btn-primary w-full">
          <BookmarkPlus size={16} /> Guardar marcador
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-[264px] shrink-0 flex-col border-r md:flex" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        {body}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseMobile} />
          <aside className="absolute bottom-0 left-0 top-0 w-[300px] max-w-[85vw]" style={{ background: "var(--card)" }}>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
