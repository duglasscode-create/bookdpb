"use client";
import { useState, useMemo } from "react";
import type { TabmeStore, TFolder, TSpace } from "@/lib/tabme-store";
import { ITEM_ORDER_KEY, DEFAULT_ITEM_ORDER } from "@/lib/tabme-store";
import { selKey, type Sel } from "./types";
import { renderIcon } from "./icons";

type Props = {
  store: TabmeStore;
  userId: string;
  sel: Sel;
  onSelect: (s: Sel) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onNewSpace: () => void;
  onEditCollection: (id: string) => void;
  onDeleteCollection: (id: string, name: string) => void;
  onNewSub: (parentId: string) => void;
  onNewItem: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const ITEM_DEFS: { key: string; icon: string; label: string; hint: string; sel: Sel }[] = [
  { key: "favorites", icon: "⭐", label: "Favoritos", hint: "Marcadores con estrella", sel: { kind: "favorites" } },
  { key: "accounts", icon: "🔑", label: "Cuentas", hint: "Cuentas de email, bancos, servicios…", sel: { kind: "accounts" } },
  { key: "assistants", icon: "🤖", label: "Asistentes IA", hint: "Mis asistentes de IA", sel: { kind: "assistants" } },
  { key: "reminders", icon: "⏰", label: "Recordatorios", hint: "Avisos con fecha y hora", sel: { kind: "reminders" } },
  { key: "history", icon: "🕘", label: "Historial", hint: "Actividad reciente", sel: { kind: "history" } },
  { key: "trash", icon: "🗑", label: "Papelera", hint: "Elementos eliminados (30 días)", sel: { kind: "trash" } },
  { key: "readlater", icon: "🔖", label: "Leer después", hint: "Para leer más tarde", sel: { kind: "readlater" } },
];

export function Sidebar(p: Props) {
  const { store, sel, onSelect, expanded, onToggleExpand } = p;
  const { spaces, folders, bookmarks, trash, tags, notes, accounts, assistants, reminders, activity, countIn, moveBookmark, reorderCollections } = store;
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<{ key: string; pos: "before" | "after" } | null>(null);

  /* Orden de las filas de Mis Items (persistido) */
  const [itemOrder, setItemOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ITEM_ORDER_KEY(p.userId));
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        const valid = arr.filter((k) => DEFAULT_ITEM_ORDER.includes(k));
        const rest = DEFAULT_ITEM_ORDER.filter((k) => !valid.includes(k));
        return [...valid, ...rest];
      }
    } catch { /* noop */ }
    return DEFAULT_ITEM_ORDER;
  });
  const saveOrder = (order: string[]) => {
    setItemOrder(order);
    try { localStorage.setItem(ITEM_ORDER_KEY(p.userId), JSON.stringify(order)); } catch { /* noop */ }
  };
  const orderedDefs = useMemo(() => itemOrder.map((k) => ITEM_DEFS.find((d) => d.key === k)!).filter(Boolean), [itemOrder]);

  const counts: Record<string, number> = {
    favorites: bookmarks.filter((b) => b.isFavorite).length,
    accounts: accounts.length,
    assistants: assistants.length,
    reminders: reminders.filter((r) => !r.done).length,
    history: activity.length,
    trash: trash.length,
    readlater: bookmarks.filter((b) => b.readLater).length,
  };

  const handleRowDrop = (e: React.DragEvent, target: { kind: "space" | "folder"; id: string; parentId: string | null }) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    const raw = e.dataTransfer.getData("text/plain") || "";
    if (raw.startsWith("bookmark:")) { moveBookmark(raw.slice(9), target.id); return; }
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

  const go = (s: Sel) => { onSelect(s); p.onCloseMobile(); };

  const renderFolder = (f: TFolder, depth: number) => {
    const kids = folders.filter((x) => x.parentId === f.id);
    const isExp = expanded.has(f.id);
    const key = `col:${f.id}`;
    return (
      <li key={f.id}>
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/plain", `folder:${f.id}`); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(key); }}
          onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
          onDrop={(e) => handleRowDrop(e, { kind: "folder", id: f.id, parentId: f.parentId })}
          onClick={() => go({ kind: "col", id: f.id })}
          className={`space-row${selKey(sel) === key ? " active" : ""}${dragOver === key ? " drop-target" : ""}`}
          title={f.name}
        >
          <span className="chev" onClick={(e) => { e.stopPropagation(); if (kids.length) onToggleExpand(f.id); }}>
            {kids.length ? (isExp ? "▾" : "▸") : ""}
          </span>
          <span className="space-ico">{renderIcon(f.icon, 15, "📁")}</span>
          <span className="side-name">{f.name}</span>
          {countIn(f.id) > 0 && <span className="count">{countIn(f.id)}</span>}
          <span className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" title="Nueva subcarpeta" onClick={() => p.onNewSub(f.id)}>＋</button>
            <button className="icon-btn" title="Editar" onClick={() => p.onEditCollection(f.id)}>✎</button>
            <button className="icon-btn danger" title="Eliminar" onClick={() => p.onDeleteCollection(f.id, f.name)}>×</button>
          </span>
        </div>
        {isExp && kids.length > 0 && (
          <ul className="sub-tree">{kids.map((k) => renderFolder(k, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const renderSpace = (s: TSpace) => {
    const kids = folders.filter((x) => x.parentId === s.id);
    const isExp = expanded.has(s.id);
    const key = `col:${s.id}`;
    return (
      <li key={s.id}>
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.setData("text/plain", `space:${s.id}`); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(key); }}
          onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
          onDrop={(e) => handleRowDrop(e, { kind: "space", id: s.id, parentId: null })}
          onClick={() => go({ kind: "col", id: s.id })}
          className={`space-row${selKey(sel) === key ? " active" : ""}${dragOver === key ? " drop-target" : ""}`}
          title={s.name}
        >
          <span className="chev" onClick={(e) => { e.stopPropagation(); onToggleExpand(s.id); }}>
            {isExp ? "▾" : "▸"}
          </span>
          <span className="space-ico">{renderIcon(s.icon, 15, "📦")}</span>
          <span className="side-name">{s.name}</span>
          {countIn(s.id) > 0 && <span className="count">{countIn(s.id)}</span>}
          <span className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" title="Nueva carpeta" onClick={() => p.onNewSub(s.id)}>＋</button>
            <button className="icon-btn" title="Editar" onClick={() => p.onEditCollection(s.id)}>✎</button>
            <button className="icon-btn danger" title="Eliminar" onClick={() => p.onDeleteCollection(s.id, s.name)}>×</button>
          </span>
        </div>
        {isExp && <ul className="sub-tree">{kids.map((k) => renderFolder(k, 1))}</ul>}
      </li>
    );
  };

  /* Drag & drop de las filas de Mis Items */
  const onItemDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData("text/plain", `itemrow:${key}`);
    e.dataTransfer.effectAllowed = "move";
    setDragItem(key);
  };
  const onItemDragOver = (e: React.DragEvent, key: string) => {
    if (!dragItem || dragItem === key) return;
    e.preventDefault(); e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropPos({ key, pos });
  };
  const onItemDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (dragItem && dropPos) {
      const next = itemOrder.filter((k) => k !== dragItem);
      const idx = next.indexOf(dropPos.key) + (dropPos.pos === "after" ? 1 : 0);
      next.splice(idx, 0, dragItem);
      saveOrder(next);
    }
    setDragItem(null); setDropPos(null);
  };

  const uncatCount = bookmarks.filter((b) => !b.folderId).length;

  const body = (
    <div className="side-scroll">
      <div className="pin-row"><span>📌</span><span>Fijado</span></div>

      <section className="side-section">
        <div className="side-head">
          <span className="sec-grip" title="Arrastrar para reordenar la sección">⋮⋮</span>
          <span className="h3-label">Spaces</span>
          <button className="mini-btn" title="Crear space" onClick={p.onNewSpace}>＋</button>
        </div>
        <ul className="space-tree">
          {spaces.map(renderSpace)}
        </ul>
        {spaces.length === 0 && (
          <p style={{ padding: "6px 10px", fontSize: 13, color: "var(--muted)" }}>Sin spaces. Crea uno con ＋.</p>
        )}
      </section>

      <section className="side-section">
        <button className={`link-btn${sel.kind === "allfolders" ? " active" : ""}`} onClick={() => go({ kind: "allfolders" })}>
          <span>🗂</span><span>Todas las carpetas</span>
        </button>
        <button className={`link-btn${sel.kind === "uncategorized" ? " active" : ""}`} onClick={() => go({ kind: "uncategorized" })}>
          <span>📥</span><span>Sin carpeta</span>
          {uncatCount > 0 && <span className="count">{uncatCount}</span>}
        </button>
        <button className={`link-btn${sel.kind === "notes" ? " active" : ""}`} onClick={() => go({ kind: "notes" })}>
          <span>📝</span><span>Notas</span>
          {notes.length > 0 && <span className="count">{notes.length}</span>}
        </button>
      </section>

      <section className="side-section">
        <ul className="item-tree">
          <li>
            <div
              className={`item-head${sel.kind === "misitems" ? " active" : ""}`}
              title="Ver todos mis items"
              onClick={(e) => {
                const t = e.target as HTMLElement;
                if (t.closest("[data-act='add']")) { e.stopPropagation(); p.onNewItem(); return; }
                if (t.closest(".chev")) { e.stopPropagation(); setItemsExpanded((v) => !v); return; }
                if (t.closest(".sec-grip")) return;
                go({ kind: "misitems" });
              }}
            >
              <span className="chev">{itemsExpanded ? "▾" : "▸"}</span>
              <span className="sec-grip" title="Arrastrar para reordenar la sección">⋮⋮</span>
              <span className="side-name">🗂 MIS ITEMS</span>
              <span className="icon-btn item-add" data-act="add" title="Nuevo item">＋</span>
            </div>
            {itemsExpanded && (
              <ul className="item-rows" onDragOver={(e) => e.preventDefault()} onDrop={onItemDrop} onDragLeave={() => setDropPos(null)}>
                {orderedDefs.map((d) => (
                  <li key={d.key}>
                    <div
                      className={`item-row${selKey(sel) === d.key ? " active" : ""}${dragItem === d.key ? " dragging" : ""}${dropPos?.key === d.key ? (dropPos.pos === "before" ? " drop-before" : " drop-after") : ""}`}
                      draggable
                      onDragStart={(e) => onItemDragStart(e, d.key)}
                      onDragOver={(e) => onItemDragOver(e, d.key)}
                      onDragEnd={() => { setDragItem(null); setDropPos(null); }}
                      onClick={() => go(d.sel)}
                      title={`${d.hint} — arrastra para reordenar`}
                    >
                      <span className="item-ico">{d.icon}</span>
                      <span className="side-name">{d.label}</span>
                      <span className="count">{counts[d.key]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </section>

      <section className="side-section">
        <div className="side-head">
          <span className="sec-grip" title="Arrastrar para reordenar la sección">⋮⋮</span>
          <span className="h3-label">Etiquetas</span>
        </div>
        <div className="tag-list">
          {tags.map((t) => (
            <button
              key={t.id}
              className={`tag-chip${sel.kind === "tags" && sel.tagId === t.id ? " active" : ""}`}
              onClick={() => go({ kind: "tags", tagId: t.id })}
            >
              <span className="dot" style={{ background: t.color }} />#{t.name}
            </button>
          ))}
          {tags.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Sin etiquetas</span>}
        </div>
      </section>
    </div>
  );

  return (
    <>
      <aside className={`sidebar${p.mobileOpen ? " mobile-open" : ""}`}>{body}</aside>
      {p.mobileOpen && <div className="mobile-scrim" onClick={p.onCloseMobile} />}
    </>
  );
}
