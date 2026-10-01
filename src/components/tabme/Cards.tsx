"use client";
import { useState } from "react";
import type { TSpace, TFolder, TBookmark, TAccount, TAssistant, TabmeStore } from "@/lib/tabme-store";
import { renderIcon } from "./icons";

export function favicon(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function domainOf(url: string | null): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/* ============ Tarjeta de marcador (markup exacto de TabmeCode) ============ */
export function BookmarkCard({ bm, store, onEdit, inTrash, onRestore, onDeleteForever, onTag }: {
  bm: TBookmark; store: TabmeStore; onEdit: () => void; inTrash?: boolean;
  onRestore?: () => void; onDeleteForever?: () => void; onTag?: (tagId: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const letter = (bm.title || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`card${dragging ? " dragging" : ""}`}
      draggable={!inTrash}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", `bookmark:${bm.id}`); e.dataTransfer.effectAllowed = "move"; setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      title={inTrash ? bm.title : "Arrastra a una carpeta para moverlo"}
    >
      <div className="hover-actions" onClick={(e) => e.stopPropagation()}>
        {inTrash ? (
          <>
            <button className="icon-btn" title="Restaurar" onClick={onRestore}>↩</button>
            <button className="icon-btn danger" title="Eliminar para siempre" onClick={onDeleteForever}>×</button>
          </>
        ) : (
          <>
            <button className="icon-btn" title={bm.isFavorite ? "Quitar favorito" : "Marcar favorito"} onClick={() => store.toggleFavorite(bm.id)}>
              {bm.isFavorite ? "⭐" : "☆"}
            </button>
            <button className="icon-btn" title="Leer después" onClick={() => store.toggleReadLater(bm.id)}>🔖</button>
            <button className="icon-btn" title="Editar" onClick={onEdit}>✎</button>
            <button className="icon-btn danger" title="Enviar a papelera" onClick={() => store.trashBookmark(bm.id)}>×</button>
          </>
        )}
      </div>

      <div className="card-top">
        {bm.icon ? (
          <span style={{ fontSize: 26 }}>{renderIcon(bm.icon, 26, "🔖")}</span>
        ) : imgOk ? (
          <img className="fav" src={favicon(bm.domain)} alt="" loading="lazy" onError={() => setImgOk(false)} />
        ) : (
          <span className="fav-fallback">{letter}</span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="card-title">
            <a href={bm.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{bm.title}</a>
          </div>
          <div className="card-domain">{bm.domain}</div>
        </div>
      </div>

      {bm.description && <div className="card-desc">{bm.description}</div>}

      {bm.tags.length > 0 && (
        <div className="card-tags">
          {bm.tags.map((t) => (
            <span key={t.id} className="tag" style={{ borderColor: t.color }} onClick={(e) => { e.stopPropagation(); onTag?.(t.id); }}>
              #{t.name}
            </span>
          ))}
        </div>
      )}

      <div className="flags">
        {bm.isFavorite && <span className="flag-fav">⭐</span>}
        {bm.readLater && <span className="flag-rl">🔖</span>}
      </div>
    </div>
  );
}

/* ============ Tarjeta de carpeta (markup exacto de TabmeCode) ============ */
export function FolderCard({ folder, store, onOpen, onEdit, onDelete, onNewSub }: {
  folder: TFolder; store: TabmeStore; onOpen: () => void; onEdit: () => void; onDelete: () => void; onNewSub: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const kids = store.folders.filter((f) => f.parentId === folder.id);
  const bmCount = store.countIn(folder.id);
  const favs = store.bookmarks.filter((b) => b.folderId === folder.id && b.isFavorite).slice(0, 5);

  return (
    <div
      className={`folder-card${dragging ? " dragging" : ""}${over ? " drop-target" : ""}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", `folder:${folder.id}`); e.dataTransfer.effectAllowed = "move"; setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setOver(false);
        const raw = e.dataTransfer.getData("text/plain") || "";
        if (raw.startsWith("bookmark:")) { store.moveBookmark(raw.slice(9), folder.id); return; }
        const m = raw.match(/^folder:(.+)$/);
        if (m && m[1] !== folder.id) {
          const dragF = store.folders.find((f) => f.id === m[1]);
          if (dragF && dragF.parentId === folder.parentId) {
            const ids = store.folders.filter((f) => f.parentId === folder.parentId).map((f) => f.id);
            const from = ids.indexOf(m[1]), to = ids.indexOf(folder.id);
            if (from !== -1 && to !== -1) { ids.splice(from, 1); ids.splice(to, 0, m[1]); store.reorderCollections(ids); }
          }
        }
      }}
      onClick={onOpen}
      title="Abrir carpeta — arrastra para reordenar o suelta marcadores aquí"
    >
      <div className="fc-band" />
      <div className="fc-main">
        <span className="fc-ico">{renderIcon(folder.icon, 30, "📁")}</span>
        <div className="fc-info">
          <div className="fc-name">{folder.name}</div>
          <div className="fc-count">{bmCount} marcador{bmCount === 1 ? "" : "es"} · {kids.length} subcarpeta{kids.length === 1 ? "" : "s"}</div>
        </div>
        <div className="fc-actions" onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn" title="Nueva subcarpeta" onClick={onNewSub}>＋</button>
          <button className="icon-btn" title="Editar" onClick={onEdit}>✎</button>
          <button className="icon-btn danger" title="Eliminar" onClick={onDelete}>×</button>
        </div>
      </div>
      {favs.length > 0 && (
        <div className="fc-favs">
          {favs.map((b) => (
            <img key={b.id} src={favicon(b.domain)} alt="" loading="lazy" title={b.title} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ Tarjeta de space (home) ============ */
export function SpaceCard({ space, store, onOpen }: { space: TSpace; store: TabmeStore; onOpen: () => void }) {
  const [over, setOver] = useState(false);
  const kids = store.folders.filter((f) => f.parentId === space.id);
  const bmCount = store.countIn(space.id);
  return (
    <div
      className={`folder-card${over ? " drop-target" : ""}`}
      onClick={onOpen}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setOver(false);
        const raw = e.dataTransfer.getData("text/plain") || "";
        if (raw.startsWith("bookmark:")) store.moveBookmark(raw.slice(9), space.id);
      }}
      title="Abrir space — puedes soltar marcadores aquí"
    >
      <div className="fc-band" />
      <div className="fc-main">
        <span className="fc-ico">{renderIcon(space.icon, 30, "📦")}</span>
        <div className="fc-info">
          <div className="fc-name">{space.name}</div>
          <div className="fc-count">{kids.length} carpeta{kids.length === 1 ? "" : "s"} · {bmCount} marcador{bmCount === 1 ? "" : "es"}</div>
        </div>
      </div>
    </div>
  );
}

/* ============ Tarjeta de cuenta / asistente ============ */
function accountIcon(a: TAccount | TAssistant) {
  if (a.iconType === "img" && a.icon) return <img src={a.icon} alt="" />;
  if (a.iconType === "emoji" && a.icon) return <span>{a.icon}</span>;
  if (a.url) return <img src={favicon(domainOf(a.url))} alt="" loading="lazy" />;
  return <span>🔑</span>;
}

export function AccountCard({ acc, onOpen, onEdit, onDelete }: {
  acc: TAccount; onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="card ref-card" onClick={onOpen} title="Ver cuenta">
      <div className="hover-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="Editar" onClick={onEdit}>✎</button>
        <button className="icon-btn danger" title="Eliminar" onClick={onDelete}>×</button>
      </div>
      <div className="ref-logo">{accountIcon(acc)}</div>
      <div className="ref-name">{acc.name}</div>
      {acc.url && <div className="ref-domain">↗ {domainOf(acc.url)}</div>}
      {(acc.username || acc.email || acc.note) && <div className="note-flag">📝 con datos</div>}
    </div>
  );
}

export function AssistantCard({ as, onOpen, onEdit, onDelete }: {
  as: TAssistant; onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="card ref-card" onClick={onOpen} title="Abrir asistente">
      <div className="hover-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="Editar" onClick={onEdit}>✎</button>
        <button className="icon-btn danger" title="Eliminar" onClick={onDelete}>×</button>
      </div>
      <div className="ref-logo">{accountIcon(as)}</div>
      <div className="ref-name">{as.name}</div>
      {as.url && <div className="ref-domain">↗ {domainOf(as.url)}</div>}
      {as.note && <div className="note-flag">📝 {as.note}</div>}
    </div>
  );
}
