"use client";
import type { TabmeStore, TBookmark, TFolder } from "@/lib/tabme-store";
import { selKey, type Sel } from "./types";
import { SpaceCard, FolderCard, BookmarkCard } from "./Cards";
import { Plus, Pencil, Trash2, FolderPlus, BookmarkPlus, ChevronRight, X } from "lucide-react";

export type UIActions = {
  select: (s: Sel) => void;
  newBookmark: (preset?: { spaceId?: string; folderId?: string }) => void;
  editBookmark: (bm: TBookmark) => void;
  newCollection: (parentId: string | null, isSpace: boolean) => void;
  editCollection: (id: string) => void;
  deleteCollection: (id: string, name: string) => void;
  newTag: () => void;
  confirm: (title: string, message: string, dangerLabel: string, onYes: () => void) => void;
};

/* ---------- Breadcrumb ---------- */
function useCrumbs(store: TabmeStore, id: string) {
  const space = store.spaces.find((s) => s.id === id);
  if (space) return [{ id: space.id, name: space.name, icon: space.icon || "📦" }];
  const chain: { id: string; name: string; icon: string }[] = [];
  let cur: TFolder | undefined = store.folders.find((f) => f.id === id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    const c: TFolder = cur;
    seen.add(c.id);
    chain.unshift({ id: c.id, name: c.name, icon: c.icon || "📁" });
    const parentFolder = store.folders.find((f) => f.id === c.parentId);
    if (parentFolder) { cur = parentFolder; continue; }
    const sp = store.spaces.find((s) => s.id === c.parentId);
    if (sp) chain.unshift({ id: sp.id, name: sp.name, icon: sp.icon || "📦" });
    break;
  }
  return chain;
}

function Breadcrumb({ store, id, select }: { store: TabmeStore; id: string; select: (s: Sel) => void }) {
  const crumbs = useCrumbs(store, id);
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      <button className="t-crumb" onClick={() => select({ kind: "home" })}>🏠 Inicio</button>
      {crumbs.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1">
          <ChevronRight size={14} style={{ color: "var(--muted)" }} />
          <button
            className={`t-crumb ${i === crumbs.length - 1 ? "current" : ""}`}
            onClick={() => i < crumbs.length - 1 && select({ kind: "col", id: c.id })}
          >
            {c.icon} {c.name}
          </button>
        </span>
      ))}
    </nav>
  );
}

function SectionHead({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h2 className="flex-1 text-xl font-bold tracking-tight">{title}
        {count !== undefined && <span className="ml-2 text-sm font-semibold" style={{ color: "var(--muted)" }}>{count}</span>}
      </h2>
      {children}
    </div>
  );
}

function BookmarkGrid({ bms, store, ui }: { bms: TBookmark[]; store: TabmeStore; ui: UIActions }) {
  if (!bms.length) return <p className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>Nada por aquí todavía.</p>;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {bms.map((b) => <BookmarkCard key={b.id} bm={b} store={store} onEdit={() => ui.editBookmark(b)} />)}
    </div>
  );
}

/* ---------- Inicio ---------- */
export function HomeView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  return (
    <div>
      <SectionHead title="Tus spaces" count={store.spaces.length}>
        <button className="t-btn t-btn-ghost" onClick={() => ui.newCollection(null, true)}><Plus size={15} /> Nuevo space</button>
      </SectionHead>
      {store.spaces.length === 0 ? (
        <div className="t-card p-10 text-center">
          <p className="mb-2 text-3xl">📦</p>
          <p className="font-semibold">Crea tu primer space</p>
          <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>Los spaces son tus grandes áreas: trabajo, personal, proyectos...</p>
          <button className="t-btn t-btn-primary" onClick={() => ui.newCollection(null, true)}><Plus size={15} /> Crear space</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {store.spaces.map((s) => <SpaceCard key={s.id} space={s} store={store} onOpen={() => ui.select({ kind: "col", id: s.id })} />)}
        </div>
      )}
    </div>
  );
}

/* ---------- Vista de Space / Carpeta ---------- */
export function CollectionView({ store, ui, id }: { store: TabmeStore; ui: UIActions; id: string }) {
  const space = store.spaces.find((s) => s.id === id);
  const folder = store.folders.find((f) => f.id === id);
  const current = space || folder;
  if (!current) return <p style={{ color: "var(--muted)" }}>No encontrado.</p>;
  const isSpace = !!space;
  const subfolders = store.folders.filter((f) => f.parentId === id);
  const bms = store.bookmarks.filter((b) => b.folderId === id);

  return (
    <div>
      <Breadcrumb store={store} id={id} select={ui.select} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-3xl" style={{ background: "var(--card)" }}>
          {current.icon || (isSpace ? "📦" : "📁")}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold tracking-tight">{current.name}</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {subfolders.length} subcarpeta{subfolders.length === 1 ? "" : "s"} · {bms.length} marcador{bms.length === 1 ? "" : "es"} aquí
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="t-btn t-btn-ghost" onClick={() => ui.newCollection(id, false)}><FolderPlus size={15} /> Subcarpeta</button>
          <button className="t-btn t-btn-primary" onClick={() => ui.newBookmark(isSpace ? { spaceId: id } : { folderId: id })}>
            <BookmarkPlus size={15} /> Guardar aquí
          </button>
          <button className="t-icon-btn" onClick={() => ui.editCollection(id)} title="Editar"><Pencil size={16} /></button>
          <button className="t-icon-btn" onClick={() => ui.deleteCollection(id, current.name)} title="Eliminar"><Trash2 size={16} /></button>
        </div>
      </div>

      {subfolders.length > 0 && (
        <div className="mb-7">
          <p className="t-section-title">Carpetas</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subfolders.map((f) => (
              <FolderCard key={f.id} folder={f} store={store}
                onOpen={() => ui.select({ kind: "col", id: f.id })}
                onEdit={() => ui.editCollection(f.id)}
                onDelete={() => ui.deleteCollection(f.id, f.name)}
                onNewSub={() => ui.newCollection(f.id, false)}
              />
            ))}
          </div>
        </div>
      )}

      <p className="t-section-title">Marcadores</p>
      <BookmarkGrid bms={bms} store={store} ui={ui} />
    </div>
  );
}

/* ---------- Favoritos / Leer después / Sin carpeta ---------- */
export function FavoritesView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  return (
    <div>
      <SectionHead title="⭐ Favoritos" count={store.bookmarks.filter((b) => b.isFavorite).length} />
      <BookmarkGrid bms={store.bookmarks.filter((b) => b.isFavorite)} store={store} ui={ui} />
    </div>
  );
}

export function ReadLaterView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  return (
    <div>
      <SectionHead title="📖 Leer después" count={store.bookmarks.filter((b) => b.readLater).length} />
      <BookmarkGrid bms={store.bookmarks.filter((b) => b.readLater)} store={store} ui={ui} />
    </div>
  );
}

export function UncategorizedView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  return (
    <div>
      <SectionHead title="📥 Sin carpeta" count={store.bookmarks.filter((b) => !b.folderId).length} />
      <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>Arrastra estas tarjetas a un space o carpeta para organizarlas.</p>
      <BookmarkGrid bms={store.bookmarks.filter((b) => !b.folderId)} store={store} ui={ui} />
    </div>
  );
}

/* ---------- Etiquetas ---------- */
export function TagsView({ store, ui, tagId }: { store: TabmeStore; ui: UIActions; tagId?: string }) {
  const counts = new Map<string, number>();
  store.bookmarks.forEach((b) => b.tags.forEach((t) => counts.set(t.id, (counts.get(t.id) || 0) + 1)));
  const active = tagId ? store.tags.find((t) => t.id === tagId) : null;
  const bms = active ? store.bookmarks.filter((b) => b.tags.some((t) => t.id === tagId)) : [];

  return (
    <div>
      <SectionHead title="🏷️ Etiquetas" count={store.tags.length}>
        <button className="t-btn t-btn-ghost" onClick={ui.newTag}><Plus size={15} /> Nueva etiqueta</button>
      </SectionHead>
      <div className="mb-6 flex flex-wrap gap-2">
        {store.tags.map((t) => (
          <span key={t.id} className="flex items-center gap-1">
            <button
              className="t-chip"
              style={tagId === t.id ? { borderColor: t.color, color: t.color } : undefined}
              onClick={() => ui.select(tagId === t.id ? { kind: "tags" } : { kind: "tags", tagId: t.id })}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />
              #{t.name} · {counts.get(t.id) || 0}
            </button>
            <button
              className="t-icon-btn" style={{ width: 26, height: 26 }}
              title="Eliminar etiqueta"
              onClick={() => ui.confirm("Eliminar etiqueta", `¿Eliminar la etiqueta "${t.name}"? Se quitará de todos los marcadores.`, "Eliminar", () => store.deleteTag(t.id))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {store.tags.length === 0 && <p className="text-sm" style={{ color: "var(--muted)" }}>Sin etiquetas todavía.</p>}
      </div>
      {active && (
        <>
          <p className="t-section-title">Con la etiqueta <span style={{ color: active.color }}>#{active.name}</span></p>
          <BookmarkGrid bms={bms} store={store} ui={ui} />
        </>
      )}
    </div>
  );
}

/* ---------- Papelera ---------- */
export function TrashView({ store }: { store: TabmeStore }) {
  return (
    <div>
      <SectionHead title="🗑️ Papelera" count={store.trash.length}>
        {store.trash.length > 0 && (
          <button className="t-btn t-btn-danger" onClick={() => store.emptyTrash()}>
            <Trash2 size={15} /> Vaciar papelera
          </button>
        )}
      </SectionHead>
      {store.trash.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>La papelera está vacía.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {store.trash.map((b) => (
            <BookmarkCard key={b.id} bm={b} store={store} inTrash
              onEdit={() => {}}
              onRestore={() => store.restoreBookmark(b.id)}
              onDeleteForever={() => store.deleteBookmarkForever(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Búsqueda ---------- */
export function SearchView({ store, ui, q }: { store: TabmeStore; ui: UIActions; q: string }) {
  const needle = q.toLowerCase();
  const bms = store.bookmarks.filter((b) =>
    b.title.toLowerCase().includes(needle) || b.url.toLowerCase().includes(needle) ||
    (b.description || "").toLowerCase().includes(needle) || b.tags.some((t) => t.name.toLowerCase().includes(needle))
  );
  const fols = store.folders.filter((f) => f.name.toLowerCase().includes(needle));
  const sps = store.spaces.filter((s) => s.name.toLowerCase().includes(needle));
  return (
    <div>
      <SectionHead title={`🔍 "${q}"`} count={bms.length + fols.length + sps.length} />
      {(sps.length > 0 || fols.length > 0) && (
        <div className="mb-6">
          <p className="t-section-title">Spaces y carpetas</p>
          <div className="flex flex-wrap gap-2">
            {sps.map((s) => <button key={s.id} className="t-chip" onClick={() => ui.select({ kind: "col", id: s.id })}>{s.icon || "📦"} {s.name}</button>)}
            {fols.map((f) => <button key={f.id} className="t-chip" onClick={() => ui.select({ kind: "col", id: f.id })}>{f.icon || "📁"} {f.name}</button>)}
          </div>
        </div>
      )}
      <p className="t-section-title">Marcadores</p>
      <BookmarkGrid bms={bms} store={store} ui={ui} />
    </div>
  );
}

/* ---------- Contenedor ---------- */
export function MainView({ store, ui, sel }: { store: TabmeStore; ui: UIActions; sel: Sel }) {
  switch (sel.kind) {
    case "home": return <HomeView store={store} ui={ui} />;
    case "col": return <CollectionView store={store} ui={ui} id={sel.id} />;
    case "favorites": return <FavoritesView store={store} ui={ui} />;
    case "readlater": return <ReadLaterView store={store} ui={ui} />;
    case "uncategorized": return <UncategorizedView store={store} ui={ui} />;
    case "tags": return <TagsView store={store} ui={ui} tagId={sel.tagId} />;
    case "trash": return <TrashView store={store} />;
    case "search": return <SearchView store={store} ui={ui} q={sel.q} />;
    case "notes": return null; // lo renderiza TabmeApp
  }
  return null;
}
