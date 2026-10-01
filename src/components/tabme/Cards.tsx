"use client";
import { useState } from "react";
import type { TSpace, TFolder, TBookmark, TabmeStore } from "@/lib/tabme-store";
import { Star, BookMarked, Pencil, Trash2, ExternalLink, FolderPlus, RotateCcw } from "lucide-react";
import { renderIcon } from "./icons";


export function favicon(url: string, domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/* ============ Tarjeta de Space (home) ============ */
export function SpaceCard({ space, store, onOpen }: { space: TSpace; store: TabmeStore; onOpen: () => void }) {
  const [over, setOver] = useState(false);
  const kids = store.folders.filter((f) => f.parentId === space.id);
  const bmCount = store.countIn(space.id);
  return (
    <div
      onClick={onOpen}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setOver(false);
        const raw = e.dataTransfer.getData("text/plain") || "";
        if (raw.startsWith("bookmark:")) store.moveBookmark(raw.slice(9), space.id);
      }}
      className={`t-card t-bm-card p-5 ${over ? "drop-target" : ""}`}
      title="Abrir space — puedes soltar marcadores aquí"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl" style={{ background: "var(--card-2)" }}>
          {renderIcon(space.icon, 22, "📦")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold">{space.name}</h3>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {kids.length} carpeta{kids.length === 1 ? "" : "s"} · {bmCount} marcador{bmCount === 1 ? "" : "es"}
          </p>
        </div>
      </div>
      {kids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {kids.slice(0, 6).map((k) => (
            <span key={k.id} className="t-chip" onClick={(e) => e.stopPropagation()}>
              {renderIcon(k.icon, 13, "📁")} {k.name}
            </span>
          ))}
          {kids.length > 6 && <span className="t-chip">+{kids.length - 6}</span>}
        </div>
      )}
    </div>
  );
}

/* ============ Tarjeta de Carpeta ============ */
export function FolderCard({ folder, store, onOpen, onEdit, onDelete, onNewSub }: {
  folder: TFolder; store: TabmeStore; onOpen: () => void; onEdit: () => void; onDelete: () => void; onNewSub: () => void;
}) {
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const kids = store.folders.filter((f) => f.parentId === folder.id);
  const bmCount = store.countIn(folder.id);
  return (
    <div
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
      className={`t-card t-bm-card p-4 ${over ? "drop-target" : ""} ${dragging ? "dragging" : ""}`}
      title="Abrir carpeta — arrastra para reordenar"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: "var(--card-2)" }}>
          {renderIcon(folder.icon, 20, "📁")}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-bold">{folder.name}</h4>
          <p className="truncate text-[11.5px]" style={{ color: "var(--muted)" }}>
            {bmCount} · {kids.length} sub
          </p>
        </div>
        <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
          <button className="t-icon-btn" style={{ width: 30, height: 30 }} onClick={onNewSub} title="Nueva subcarpeta"><FolderPlus size={15} /></button>
          <button className="t-icon-btn" style={{ width: 30, height: 30 }} onClick={onEdit} title="Editar"><Pencil size={14} /></button>
          <button className="t-icon-btn" style={{ width: 30, height: 30 }} onClick={onDelete} title="Eliminar"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ============ Tarjeta de Marcador ============ */
export function BookmarkCard({ bm, store, onEdit, inTrash, onRestore, onDeleteForever }: {
  bm: TBookmark; store: TabmeStore; onEdit: () => void; inTrash?: boolean; onRestore?: () => void; onDeleteForever?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  return (
    <div
      draggable={!inTrash}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", `bookmark:${bm.id}`); e.dataTransfer.effectAllowed = "move"; setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      className={`t-card t-bm-card flex flex-col p-4 ${dragging ? "dragging" : ""}`}
      title={inTrash ? bm.title : "Arrastra a una carpeta para moverlo"}
    >
      <div className="mb-2.5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: "var(--card-2)" }}>
          {bm.icon ? <span className="text-xl">{renderIcon(bm.icon, 20, "🔖")}</span>
            : imgOk ? <img src={favicon(bm.url, bm.domain)} alt="" className="h-5 w-5" onError={() => setImgOk(false)} loading="lazy" />
            : <span className="text-lg">🔖</span>}
        </span>
        <div className="min-w-0 flex-1">
          <a href={bm.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="block truncate text-sm font-semibold hover:underline" style={{ color: "var(--text)" }}>
            {bm.title}
          </a>
          <p className="truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{bm.domain}</p>
        </div>
        <a href={bm.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="t-icon-btn shrink-0" style={{ width: 30, height: 30 }} title="Abrir">
          <ExternalLink size={14} />
        </a>
      </div>

      {bm.description && <p className="mb-3 line-clamp-2 text-xs" style={{ color: "var(--muted)" }}>{bm.description}</p>}

      {bm.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {bm.tags.map((t) => (
            <span key={t.id} className="t-chip" style={{ borderColor: t.color, color: t.color }}>#{t.name}</span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--border)" }} onClick={(e) => e.stopPropagation()}>
        {inTrash ? (
          <>
            <button onClick={onRestore} className="t-btn t-btn-ghost" style={{ minHeight: 34, padding: "6px 10px", fontSize: 12 }}>
              <RotateCcw size={13} /> Restaurar
            </button>
            <button onClick={onDeleteForever} className="t-btn t-btn-danger" style={{ minHeight: 34, padding: "6px 10px", fontSize: 12 }}>
              <Trash2 size={13} /> Eliminar
            </button>
          </>
        ) : (
          <>
            <div className="flex">
              <button onClick={() => store.toggleFavorite(bm.id)} className={`t-icon-btn ${bm.isFavorite ? "on" : ""}`} title="Favorito">
                <Star size={16} fill={bm.isFavorite ? "currentColor" : "none"} />
              </button>
              <button onClick={() => store.toggleReadLater(bm.id)} className={`t-icon-btn ${bm.readLater ? "on" : ""}`} title="Leer después">
                <BookMarked size={16} />
              </button>
            </div>
            <div className="flex">
              <button onClick={onEdit} className="t-icon-btn" title="Editar"><Pencil size={15} /></button>
              <button onClick={() => store.trashBookmark(bm.id)} className="t-icon-btn" title="Enviar a papelera"><Trash2 size={15} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
