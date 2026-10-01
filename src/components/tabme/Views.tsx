"use client";
import { useState } from "react";
import type { TabmeStore, TBookmark, TFolder } from "@/lib/tabme-store";
import type { Sel } from "./types";
import { SpaceCard, FolderCard, BookmarkCard, AccountCard, AssistantCard } from "./Cards";
import { renderIcon } from "./icons";
import { actionLabels, actionIcons } from "@/utils/activityLog";

export type UIActions = {
  select: (s: Sel) => void;
  newBookmark: (preset?: { spaceId?: string; folderId?: string }) => void;
  editBookmark: (bm: TBookmark) => void;
  newCollection: (parentId: string | null, isSpace: boolean) => void;
  editCollection: (id: string) => void;
  deleteCollection: (id: string, name: string) => void;
  newTag: () => void;
  newAccount: () => void;
  editAccount: (id: string) => void;
  viewAccount: (id: string) => void;
  newAssistant: () => void;
  editAssistant: (id: string) => void;
  newReminder: () => void;
  editReminder: (id: string) => void;
  confirm: (title: string, message: string, dangerLabel: string, onYes: () => void) => void;
};

/* ---------- Breadcrumb fiel a TabmeCode ---------- */
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

export function Breadcrumb({ store, id, select }: { store: TabmeStore; id: string; select: (s: Sel) => void }) {
  const crumbs = useCrumbs(store, id);
  return (
    <div className="breadcrumb">
      <button className="crumb-link" onClick={() => select({ kind: "home" })}>🏠 Home</button>
      {crumbs.map((c, i) => (
        <span key={c.id} style={{ display: "inline-flex", alignItems: "center" }}>
          <span className="csep">/</span>
          {i === crumbs.length - 1 ? (
            <span className="crumb-cur">{renderIcon(c.icon, 15, "📁")} {c.name}</span>
          ) : (
            <button className="crumb-link" onClick={() => select({ kind: "col", id: c.id })}>
              {renderIcon(c.icon, 14, "📁")} {c.name}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function SimpleHead({ icon, label, meta }: { icon: string; label: string; meta: string }) {
  return (
    <div className="view-header">
      <div className="breadcrumb">
        <span className="crumb-cur">{icon} {label}</span>
      </div>
      <div className="view-meta">{meta}</div>
    </div>
  );
}

function BookmarkGrid({ bms, store, ui, onTag }: { bms: TBookmark[]; store: TabmeStore; ui: UIActions; onTag?: (tagId: string) => void }) {
  if (!bms.length) return (
    <div className="empty"><span className="big">📭</span>Nada por aquí todavía.</div>
  );
  return (
    <div className="cards">
      {bms.map((b) => <BookmarkCard key={b.id} bm={b} store={store} onEdit={() => ui.editBookmark(b)} onTag={onTag} />)}
    </div>
  );
}

/* ---------- Inicio ---------- */
export function HomeView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  return (
    <div>
      <div className="view-header">
        <div className="breadcrumb"><span className="crumb-cur">🗂 Tus spaces</span></div>
        <div className="view-meta">{store.spaces.length} space{store.spaces.length === 1 ? "" : "s"} · {store.bookmarks.length} marcadores</div>
        <div className="view-actions">
          <button className="t-btn t-btn-ghost" onClick={() => ui.newCollection(null, true)}>＋ Nuevo space</button>
        </div>
      </div>
      {store.spaces.length === 0 ? (
        <div className="empty"><span className="big">📦</span><p><strong>Crea tu primer space</strong></p><p>Los spaces son tus grandes áreas: trabajo, personal, proyectos…</p></div>
      ) : (
        <div className="cards">
          {store.spaces.map((s) => <SpaceCard key={s.id} space={s} store={store} onOpen={() => ui.select({ kind: "col", id: s.id })} />)}
        </div>
      )}
    </div>
  );
}

/* ---------- Vista de Space / Carpeta (fiel a TabmeCode) ---------- */
export function CollectionView({ store, ui, id }: { store: TabmeStore; ui: UIActions; id: string }) {
  const [showNotes, setShowNotes] = useState(false);
  const space = store.spaces.find((s) => s.id === id);
  const folder = store.folders.find((f) => f.id === id);
  const current = space || folder;
  if (!current) return <p style={{ color: "var(--muted)" }}>No encontrado.</p>;
  const isSpace = !!space;
  const subfolders = store.folders.filter((f) => f.parentId === id);
  const bms = store.bookmarks.filter((b) => b.folderId === id);

  return (
    <div>
      <div className="view-header">
        <Breadcrumb store={store} id={id} select={ui.select} />
        <div className="view-meta">
          {subfolders.length} subcarpeta{subfolders.length === 1 ? "" : "s"} · {bms.length} marcador{bms.length === 1 ? "" : "es"} aquí
        </div>
        <div className="view-actions">
          <button className="t-btn t-btn-ghost" onClick={() => ui.newCollection(id, false)}>＋ Carpeta</button>
          <button className="t-btn t-btn-primary" onClick={() => ui.newBookmark(isSpace ? { spaceId: id } : { folderId: id })}>🔖＋ Marcador</button>
          <button className="icon-btn" title="Editar" onClick={() => ui.editCollection(id)}>✎</button>
          <button className="icon-btn danger" title="Eliminar" onClick={() => ui.deleteCollection(id, current.name)}>×</button>
        </div>
        <div className="notes-toggle">
          <button className={`t-btn ${!showNotes ? "t-btn-primary" : "t-btn-ghost"}`} onClick={() => setShowNotes(false)}>🗂 Ver carpetas</button>
          <button className={`t-btn ${showNotes ? "t-btn-primary" : "t-btn-ghost"}`} onClick={() => setShowNotes(true)}>📝 Ver notas</button>
        </div>
      </div>

      {showNotes ? (
        <NotesInline store={store} />
      ) : (
        <>
          {subfolders.length > 0 && (
            <div style={{ marginBottom: 26 }}>
              <p className="t-section-title">Carpetas</p>
              <div className="cards">
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
          <BookmarkGrid bms={bms} store={store} ui={ui} onTag={(tagId) => ui.select({ kind: "tags", tagId })} />
        </>
      )}
    </div>
  );
}

function NotesInline({ store }: { store: TabmeStore }) {
  const notes = store.notes;
  if (!notes.length) return <div className="empty"><span className="big">📝</span>Sin notas todavía. Créalas con el icono ✏️ de la barra superior.</div>;
  return (
    <div className="cards">
      {notes.map((n) => (
        <div key={n.id} className="card">
          <div className="ref-name">{n.title}</div>
          <div className="card-desc" style={{ WebkitLineClamp: 6 }}>{n.content || <em style={{ color: "var(--muted)" }}>Sin contenido</em>}</div>
          <div className="card-domain">{new Date(n.updatedAt).toLocaleDateString()}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Todas las carpetas ---------- */
export function AllFoldersView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  const tops = store.folders.filter((f) => store.spaces.some((s) => s.id === f.parentId));
  const nested = store.folders.filter((f) => !store.spaces.some((s) => s.id === f.parentId));
  return (
    <div>
      <SimpleHead icon="🗂" label="Todas las carpetas" meta={`${store.folders.length} carpetas en total`} />
      {tops.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <p className="t-section-title">Carpetas principales</p>
          <div className="cards">
            {tops.map((f) => (
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
      {nested.length > 0 && (
        <div>
          <p className="t-section-title">Subcarpetas</p>
          <div className="cards">
            {nested.map((f) => (
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
      {store.folders.length === 0 && <div className="empty"><span className="big">📁</span>Sin carpetas todavía.</div>}
    </div>
  );
}

/* ---------- Favoritos / Leer después / Sin carpeta ---------- */
export function FavoritesView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  const bms = store.bookmarks.filter((b) => b.isFavorite);
  return (
    <div>
      <SimpleHead icon="⭐" label="Favoritos" meta={`${bms.length} marcador${bms.length === 1 ? "" : "es"}`} />
      <BookmarkGrid bms={bms} store={store} ui={ui} onTag={(tagId) => ui.select({ kind: "tags", tagId })} />
    </div>
  );
}

export function ReadLaterView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  const bms = store.bookmarks.filter((b) => b.readLater);
  return (
    <div>
      <SimpleHead icon="🔖" label="Leer después" meta={`${bms.length} marcador${bms.length === 1 ? "" : "es"}`} />
      <BookmarkGrid bms={bms} store={store} ui={ui} onTag={(tagId) => ui.select({ kind: "tags", tagId })} />
    </div>
  );
}

export function UncategorizedView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  const bms = store.bookmarks.filter((b) => !b.folderId);
  return (
    <div>
      <SimpleHead icon="📥" label="Sin carpeta" meta={`${bms.length} marcador${bms.length === 1 ? "" : "es"}`} />
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Arrastra estas tarjetas a un space o carpeta para organizarlas.</p>
      <BookmarkGrid bms={bms} store={store} ui={ui} onTag={(tagId) => ui.select({ kind: "tags", tagId })} />
    </div>
  );
}

/* ---------- Mis Items: mosaico ---------- */
const ITEM_TILES = [
  { key: "favorites", icon: "⭐", label: "Favoritos", sel: { kind: "favorites" } as Sel },
  { key: "accounts", icon: "🔑", label: "Cuentas", sel: { kind: "accounts" } as Sel },
  { key: "assistants", icon: "🤖", label: "Asistentes IA", sel: { kind: "assistants" } as Sel },
  { key: "reminders", icon: "⏰", label: "Recordatorios", sel: { kind: "reminders" } as Sel },
  { key: "history", icon: "🕘", label: "Historial", sel: { kind: "history" } as Sel },
  { key: "trash", icon: "🗑", label: "Papelera", sel: { kind: "trash" } as Sel },
  { key: "readlater", icon: "🔖", label: "Leer después", sel: { kind: "readlater" } as Sel },
];

export function MisItemsView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  const counts: Record<string, number> = {
    favorites: store.bookmarks.filter((b) => b.isFavorite).length,
    accounts: store.accounts.length,
    assistants: store.assistants.length,
    reminders: store.reminders.filter((r) => !r.done).length,
    history: store.activity.length,
    trash: store.trash.length,
    readlater: store.bookmarks.filter((b) => b.readLater).length,
  };
  return (
    <div>
      <SimpleHead icon="🗂" label="Mis Items" meta="Todos tus items en un vistazo — haz clic en uno para abrirlo" />
      <div className="mi-grid">
        {ITEM_TILES.map((t) => (
          <div key={t.key} className="card mi-tile" onClick={() => ui.select(t.sel)} title={`Abrir ${t.label}`}>
            <div className="ref-logo">{t.icon}</div>
            <div className="ref-name">{t.label}</div>
            <div className="mi-count">{counts[t.key]} elemento{counts[t.key] === 1 ? "" : "s"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Cuentas ---------- */
export function AccountsView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  return (
    <div>
      <div className="view-header">
        <div className="breadcrumb"><span className="crumb-cur">🔑 Cuentas</span></div>
        <div className="view-meta">{store.accounts.length} cuenta{store.accounts.length === 1 ? "" : "s"} · haz clic en una para verla</div>
        <div className="view-actions">
          <button className="t-btn t-btn-primary" onClick={ui.newAccount}>＋ Nueva cuenta</button>
        </div>
      </div>
      {store.accounts.length === 0 ? (
        <div className="empty"><span className="big">🔑</span>Sin cuentas todavía.</div>
      ) : (
        <div className="cards">
          {store.accounts.map((a) => (
            <AccountCard key={a.id} acc={a}
              onOpen={() => ui.viewAccount(a.id)}
              onEdit={() => ui.editAccount(a.id)}
              onDelete={() => ui.confirm("Eliminar cuenta", `¿Eliminar la cuenta «${a.name}»? Esta acción no se puede deshacer.`, "Eliminar", () => store.deleteAccount(a.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Asistentes IA ---------- */
export function AssistantsView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  return (
    <div>
      <div className="view-header">
        <div className="breadcrumb"><span className="crumb-cur">🤖 Asistentes IA</span></div>
        <div className="view-meta">{store.assistants.length} asistente{store.assistants.length === 1 ? "" : "s"}</div>
        <div className="view-actions">
          <button className="t-btn t-btn-primary" onClick={ui.newAssistant}>＋ Nuevo asistente</button>
        </div>
      </div>
      {store.assistants.length === 0 ? (
        <div className="empty"><span className="big">🤖</span>Sin asistentes todavía.</div>
      ) : (
        <div className="cards">
          {store.assistants.map((a) => (
            <AssistantCard key={a.id} as={a}
              onOpen={() => { if (a.url) window.open(a.url, "_blank"); }}
              onEdit={() => ui.editAssistant(a.id)}
              onDelete={() => ui.confirm("Eliminar asistente", `¿Eliminar «${a.name}»? Esta acción no se puede deshacer.`, "Eliminar", () => store.deleteAssistant(a.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Recordatorios ---------- */
export function RemindersView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  const fmt = (iso: string | null) => {
    if (!iso) return "Sin fecha";
    const d = new Date(iso);
    return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  return (
    <div>
      <div className="view-header">
        <div className="breadcrumb"><span className="crumb-cur">⏰ Recordatorios</span></div>
        <div className="view-meta">{store.reminders.filter((r) => !r.done).length} pendiente{store.reminders.filter((r) => !r.done).length === 1 ? "" : "s"}</div>
        <div className="view-actions">
          <button className="t-btn t-btn-primary" onClick={ui.newReminder}>＋ Nuevo recordatorio</button>
        </div>
      </div>
      {store.reminders.length === 0 ? (
        <div className="empty"><span className="big">⏰</span>Sin recordatorios todavía.</div>
      ) : (
        store.reminders.map((r) => (
          <div key={r.id} className={`vrow${r.done ? " done" : ""}`}>
            <span className="vrow-ic">{r.icon}</span>
            <div className="vrow-body">
              <div className="vrow-title">{r.text}</div>
              <div className="vrow-sub">{fmt(r.remindAt)}</div>
            </div>
            <div className="vrow-actions">
              <button className="icon-btn" title={r.done ? "Marcar pendiente" : "Marcar hecho"} onClick={() => store.updateReminder(r.id, { done: !r.done })}>
                {r.done ? "↩" : "✓"}
              </button>
              <button className="icon-btn" title="Editar" onClick={() => ui.editReminder(r.id)}>✎</button>
              <button className="icon-btn danger" title="Eliminar" onClick={() => ui.confirm("Eliminar recordatorio", "¿Eliminar este recordatorio?", "Eliminar", () => store.deleteReminder(r.id))}>×</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------- Historial ---------- */
export function HistoryView({ store }: { store: TabmeStore }) {
  const fmt = (iso: string) => new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div>
      <SimpleHead icon="🕘" label="Historial" meta={`${store.activity.length} actividad${store.activity.length === 1 ? "" : "es"} recientes`} />
      {store.activity.length === 0 ? (
        <div className="empty"><span className="big">🕘</span>Sin actividad registrada todavía.</div>
      ) : (
        store.activity.map((a) => (
          <div key={a.id} className="vrow">
            <span className="vrow-ic">{(actionIcons as any)[a.action] || "•"}</span>
            <div className="vrow-body">
              <div className="vrow-title">{(actionLabels as any)[a.action] || a.action}{a.entityName ? `: ${a.entityName}` : ""}</div>
              <div className="vrow-sub">{fmt(a.createdAt)}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------- Duplicados ---------- */
function normUrl(u: string): string {
  let s = u.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  return s;
}

export function DuplicatesView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  const groups = new Map<string, TBookmark[]>();
  store.bookmarks.forEach((b) => {
    const k = normUrl(b.url);
    const arr = groups.get(k) || [];
    arr.push(b);
    groups.set(k, arr);
  });
  const dups = [...groups.values()].filter((g) => g.length > 1);
  return (
    <div>
      <SimpleHead icon="📑" label="Duplicados" meta={dups.length === 0 ? "No hay marcadores duplicados" : `${dups.length} URL${dups.length === 1 ? "" : "s"} guardada${dups.length === 1 ? "" : "s"} más de una vez`} />
      {dups.length === 0 ? (
        <div className="empty"><span className="big">✨</span>Todo limpio: no hay duplicados.</div>
      ) : (
        dups.map((g, i) => (
          <div key={i} style={{ marginBottom: 22 }}>
            <p className="t-section-title">{g[0].url} · {g.length} veces</p>
            <div className="cards">
              {g.map((b) => <BookmarkCard key={b.id} bm={b} store={store} onEdit={() => ui.editBookmark(b)} onTag={(tagId) => ui.select({ kind: "tags", tagId })} />)}
            </div>
          </div>
        ))
      )}
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
      <div className="view-header">
        <div className="breadcrumb"><span className="crumb-cur">🏷 Etiquetas</span></div>
        <div className="view-meta">{store.tags.length} etiqueta{store.tags.length === 1 ? "" : "s"}</div>
        <div className="view-actions">
          <button className="t-btn t-btn-ghost" onClick={ui.newTag}>＋ Nueva etiqueta</button>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
        {store.tags.map((t) => (
          <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            <button
              className="t-chip"
              style={tagId === t.id ? { borderColor: t.color, color: t.color } : undefined}
              onClick={() => ui.select(tagId === t.id ? { kind: "tags" } : { kind: "tags", tagId: t.id })}
            >
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: t.color }} />
              #{t.name} · {counts.get(t.id) || 0}
            </button>
            <button
              className="icon-btn" style={{ width: 26, height: 26, fontSize: 14 }}
              title="Eliminar etiqueta"
              onClick={() => ui.confirm("Eliminar etiqueta", `¿Eliminar la etiqueta «${t.name}»? Se quitará de todos los marcadores.`, "Eliminar", () => store.deleteTag(t.id))}
            >×</button>
          </span>
        ))}
        {store.tags.length === 0 && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Sin etiquetas todavía.</p>}
      </div>
      {active && (
        <>
          <p className="t-section-title">Con la etiqueta <span style={{ color: active.color }}>#{active.name}</span></p>
          <BookmarkGrid bms={bms} store={store} ui={ui} onTag={(tid) => ui.select({ kind: "tags", tagId: tid })} />
        </>
      )}
    </div>
  );
}

/* ---------- Papelera ---------- */
export function TrashView({ store, ui }: { store: TabmeStore; ui: UIActions }) {
  return (
    <div>
      <div className="view-header">
        <div className="breadcrumb"><span className="crumb-cur">🗑 Papelera</span></div>
        <div className="view-meta">{store.trash.length} elemento{store.trash.length === 1 ? "" : "s"} · se conservan 30 días</div>
        {store.trash.length > 0 && (
          <div className="view-actions">
            <button className="t-btn t-btn-danger" onClick={() => ui.confirm("Vaciar papelera", "¿Eliminar para siempre todos los elementos de la papelera? Esta acción no se puede deshacer.", "Vaciar", () => store.emptyTrash())}>
              🗑 Vaciar papelera
            </button>
          </div>
        )}
      </div>
      {store.trash.length === 0 ? (
        <div className="empty"><span className="big">🗑</span>La papelera está vacía.</div>
      ) : (
        <div className="cards">
          {store.trash.map((b) => (
            <BookmarkCard key={b.id} bm={b} store={store} inTrash onEdit={() => {}}
              onRestore={() => store.restoreBookmark(b.id)}
              onDeleteForever={() => ui.confirm("Eliminar para siempre", `¿Eliminar «${b.title}» para siempre?`, "Eliminar", () => store.deleteBookmarkForever(b.id))}
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
      <SimpleHead icon="🔍" label={`«${q}»`} meta={`${bms.length + fols.length + sps.length} resultado${bms.length + fols.length + sps.length === 1 ? "" : "s"}`} />
      {(sps.length > 0 || fols.length > 0) && (
        <div style={{ marginBottom: 22 }}>
          <p className="t-section-title">Spaces y carpetas</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sps.map((s) => <button key={s.id} className="t-chip" onClick={() => ui.select({ kind: "col", id: s.id })}>{renderIcon(s.icon, 13, "📦")} {s.name}</button>)}
            {fols.map((f) => <button key={f.id} className="t-chip" onClick={() => ui.select({ kind: "col", id: f.id })}>{renderIcon(f.icon, 13, "📁")} {f.name}</button>)}
          </div>
        </div>
      )}
      <p className="t-section-title">Marcadores</p>
      <BookmarkGrid bms={bms} store={store} ui={ui} onTag={(tagId) => ui.select({ kind: "tags", tagId })} />
    </div>
  );
}

/* ---------- Contenedor ---------- */
export function MainView({ store, ui, sel }: { store: TabmeStore; ui: UIActions; sel: Sel }) {
  switch (sel.kind) {
    case "home": return <HomeView store={store} ui={ui} />;
    case "col": return <CollectionView store={store} ui={ui} id={sel.id} />;
    case "allfolders": return <AllFoldersView store={store} ui={ui} />;
    case "favorites": return <FavoritesView store={store} ui={ui} />;
    case "readlater": return <ReadLaterView store={store} ui={ui} />;
    case "uncategorized": return <UncategorizedView store={store} ui={ui} />;
    case "accounts": return <AccountsView store={store} ui={ui} />;
    case "assistants": return <AssistantsView store={store} ui={ui} />;
    case "reminders": return <RemindersView store={store} ui={ui} />;
    case "history": return <HistoryView store={store} />;
    case "misitems": return <MisItemsView store={store} ui={ui} />;
    case "tags": return <TagsView store={store} ui={ui} tagId={sel.tagId} />;
    case "trash": return <TrashView store={store} ui={ui} />;
    case "search": return <SearchView store={store} ui={ui} q={sel.q} />;
    case "duplicates": return <DuplicatesView store={store} ui={ui} />;
    case "notes": return null; // lo renderiza TabmeApp
  }
  return null;
}
