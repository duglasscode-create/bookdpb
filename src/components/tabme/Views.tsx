/* BookDPB — Views.tsx
   Porte literal de las vistas del main de TabmeCode v1.6.3 (newtab.js).
   Si ui.notes es true devuelve null: las notas las renderiza NotesView. */
"use client";
import React, { useEffect, useRef, useState } from "react";
import * as T from "@/lib/tc";
import { useTC } from "@/lib/tc-store";
import { useApp, useDnD } from "./tc-ui";
import { NotePopover } from "./NotesView";

type DragState = { type: string; id: string } | null;

/* ---------- Barra de vistas: Cuadrícula / Lista / Tablero + zoom ---------- */

function ViewToolbar({ vkey, extra }: { vkey: string; extra?: React.ReactNode }) {
  const { getViewMode, setViewMode, getZoom, setZoom } = useApp();
  const cur = getViewMode(vkey);
  return (
    <div className="vt-wrap">
      <div className="vt-seg" role="group" aria-label="Modo de vista">
        {T.VIEW_MODES.map((m) => (
          <button key={m[0]} className={"vt-btn" + (cur === m[0] ? " active" : "")}
            title={m[2]} onClick={() => setViewMode(vkey, m[0])}>
            <span className="vt-ico">{m[1]}</span><span className="vt-lbl">{m[2]}</span>
          </button>
        ))}
      </div>
      <div className="vt-zoom">
        <button className="vt-zbtn" title="Reducir tamaño" onClick={() => setZoom(-0.1)}>−</button>
        <span className="vt-zv">{Math.round(getZoom() * 100)}%</span>
        <button className="vt-zbtn" title="Aumentar tamaño" onClick={() => setZoom(0.1)}>+</button>
      </div>
      {extra}
    </div>
  );
}

/* ---------- Encabezado de página (v1.6.2) ---------- */

function PageHead({ def, subline, toolbarKey, primary, hideToolbar, titleNode }:
  { def: { icon: string; label: string; hint?: string }; subline?: string; toolbarKey: string;
    primary?: React.ReactNode; hideToolbar?: boolean; titleNode?: React.ReactNode }) {
  return (
    <>
      <h2 id="viewTitle">{titleNode || (<><span className="pg-ico">{def.icon}</span><span>{def.label}</span></>)}</h2>
      <div id="viewMeta" className="view-meta">
        {def.hint ? <div className="pg-sub">{def.hint}</div> : null}
        {subline ? <div className="pg-subline">{subline}</div> : null}
      </div>
      <div id="viewActions" className="view-actions">
        {hideToolbar ? primary : <ViewToolbar vkey={toolbarKey} extra={primary} />}
      </div>
    </>
  );
}

function Empty({ icon, lines }: { icon: string; lines: string[] }) {
  return (
    <div id="emptyState" className="empty">
      <span className="big">{icon}</span>
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  );
}

function CrumbHome() {
  const { goHome } = useApp();
  return <button className="crumb" title="Volver a Home" onClick={goHome}>🏠 Home</button>;
}

/* ---------- Tarjeta / fila de marcador ---------- */

function BookmarkCard({ b, showFolder, fname, canReorder, dragRef, selMode, selected, onToggleSelect }:
  { b: T.Bookmark; showFolder: boolean; fname: Record<string, string>; canReorder: boolean | "favorites";
    dragRef: React.MutableRefObject<DragState>; selMode?: boolean; selected?: boolean; onToggleSelect?: () => void }) {
  const tc = useTC();
  const { openModal, tagColorOf } = useApp();
  const { clearDropMarks } = useDnD();

  const del = async () => {
    await tc.trashBookmark(b.id);
    await tc.logActivity("delete", "Enviaste un marcador a la papelera", b.title);
    tc.toast("Marcador enviado a la papelera");
  };
  const onClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-act]")) return;
    if (selMode) { onToggleSelect && onToggleSelect(); return; }
    tc.markBookmarkOpened(b.id);
    tc.openUrl(b.url);
  };
  return (
    <div className={"card" + (selected ? " selected" : "")} draggable={!selMode} data-id={b.id}
      title={canReorder ? "Arrastra para reordenar" : undefined}
      onClick={onClick}
      onDragStart={(e) => {
        dragRef.current = { type: T.DT_BOOKMARK, id: b.id };
        e.dataTransfer.setData(T.DT_BOOKMARK, b.id);
        e.dataTransfer.setData("text/plain", "bookmark:" + b.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); dragRef.current = null; }}
      onDragOver={canReorder ? (e) => {
        if (!T.hasDT(e, T.DT_BOOKMARK)) return;
        const ds = dragRef.current;
        const dragB = ds && tc.db.bookmarks.find((x) => x.id === ds.id);
        if (!dragB || dragB.id === b.id) return;
        if (canReorder === "favorites") { if (!dragB.favorite) return; }
        else if (dragB.folderId !== b.folderId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("drop-before");
      } : undefined}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={canReorder ? (e) => {
        if (!T.hasDT(e, T.DT_BOOKMARK)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        const did = e.dataTransfer.getData(T.DT_BOOKMARK);
        if (canReorder === "favorites") tc.reorderFavorites(did, b.id);
        else tc.reorderBookmarks(b.folderId, did, b.id);
      } : undefined}>
      <div className="hover-actions">
        <button className={"icon-btn" + (b.favorite ? " on" : "")} data-act="fav" title="Favorito"
          onClick={(e) => { e.stopPropagation(); tc.toggleFavorite(b.id); }}>{b.favorite ? "⭐" : "☆"}</button>
        <button className={"icon-btn" + (b.readLater ? " on" : "")} data-act="readlater" title="Leer después"
          onClick={(e) => { e.stopPropagation(); tc.toggleReadLater(b.id); }}>🔖</button>
        <button className="icon-btn" data-act="edit" title="Editar"
          onClick={(e) => { e.stopPropagation(); openModal("bookmark", { id: b.id }); }}>✎</button>
        <button className="icon-btn" data-act="del" title="Enviar a papelera"
          onClick={(e) => { e.stopPropagation(); del(); }}>×</button>
      </div>
      {selMode ? (
        <button className={"sel-check" + (selected ? " on" : "")} data-act="sel" title="Seleccionar"
          onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(); }}>
          {selected ? "☑" : "☐"}
        </button>
      ) : null}
      {T.favEl(b)}
      <div className="title">{b.title}</div>
      <div className="domain">{T.domainOf(b.url)}</div>
      {(b.tags && b.tags.length) ? (
        <div className="tags">{b.tags.map((t) => (
          <span key={t} className="tag" style={{ "--tagc": tagColorOf(t) } as React.CSSProperties}>#{t}</span>
        ))}</div>
      ) : null}
      {(b.favorite || b.readLater) ? (
        <div className="card-flags">{b.favorite ? "⭐" : ""}{b.readLater ? " 🔖" : ""}</div>
      ) : null}
      {b.note ? <div className="note-flag">📝 con nota</div> : null}
      {showFolder ? <div className="note-flag">🗂 {fname[b.folderId || ""] || ""}</div> : null}
    </div>
  );
}

function BookmarkRow({ b, fname, selMode, selected, onToggleSelect }:
  { b: T.Bookmark; fname: Record<string, string>; selMode?: boolean; selected?: boolean; onToggleSelect?: () => void }) {
  const tc = useTC();
  const { openModal } = useApp();
  const onAct = (e: React.MouseEvent, act: string) => {
    e.stopPropagation();
    if (act === "edit") openModal("bookmark", { id: b.id });
    else if (act === "fav") tc.toggleFavorite(b.id);
    else if (act === "readlater") tc.toggleReadLater(b.id);
    else {
      tc.trashBookmark(b.id).then(() => {
        tc.logActivity("delete", "Enviaste un marcador a la papelera", b.title);
        tc.toast("Marcador enviado a la papelera");
      });
    }
  };
  return (
    <div className={"vrow bm-row" + (selected ? " selected" : "")} data-id={b.id}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-act]")) return;
        if (selMode) { onToggleSelect && onToggleSelect(); return; }
        tc.markBookmarkOpened(b.id);
        tc.openUrl(b.url);
      }}>
      {selMode ? (
        <button className={"sel-check" + (selected ? " on" : "")} data-act="sel" title="Seleccionar"
          onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(); }}>
          {selected ? "☑" : "☐"}
        </button>
      ) : null}
      <span className="vrow-ic">{T.favEl(b, 18)}</span>
      <div className="vrow-body">
        <div className="vrow-title">{b.title}</div>
        <div className="vrow-sub">{T.domainOf(b.url)}{fname[b.folderId || ""] ? " · 🗂 " + fname[b.folderId || ""] : ""}</div>
      </div>
      {(b.favorite || b.readLater) ? (
        <span className="vrow-meta">{b.favorite ? "⭐" : ""}{b.readLater ? "🔖" : ""}</span>
      ) : null}
      <div className="vrow-actions">
        <button className={"icon-btn" + (b.favorite ? " on" : "")} data-act="fav" title="Favorito"
          onClick={(e) => onAct(e, "fav")}>{b.favorite ? "⭐" : "☆"}</button>
        <button className={"icon-btn" + (b.readLater ? " on" : "")} data-act="readlater" title="Leer después"
          onClick={(e) => onAct(e, "readlater")}>🔖</button>
        <button className="icon-btn" data-act="edit" title="Editar" onClick={(e) => onAct(e, "edit")}>✎</button>
        <button className="icon-btn" data-act="del" title="Enviar a papelera" onClick={(e) => onAct(e, "del")}>×</button>
      </div>
    </div>
  );
}

/* ---------- Tarjetas de space ---------- */

function SpaceCard({ sp, dragRef }: { sp: T.Space; dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { goSpace, spaceStats } = useApp();
  const { clearDropMarks } = useDnD();
  const st = spaceStats(sp);
  const folders = st.folders.filter((f) => (f.parentId || null) === null).sort(T.byOrder);
  const chips = folders.slice(0, 4);
  return (
    <div className="card space-card" draggable="true" data-id={sp.id} title="Arrastra para reordenar"
      onClick={() => goSpace(sp.id)}
      onDragStart={(e) => {
        dragRef.current = { type: T.DT_SPACE, id: sp.id };
        e.dataTransfer.setData(T.DT_SPACE, sp.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); dragRef.current = null; }}
      onDragOver={(e) => {
        if (T.hasDT(e, T.DT_SPACE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!dragRef.current || dragRef.current.id !== sp.id) e.currentTarget.classList.add("drop-before");
          return;
        }
        e.preventDefault();
        e.currentTarget.classList.add("drop-target");
      }}
      onDragLeave={(e) => { e.currentTarget.classList.remove("drop-before"); e.currentTarget.classList.remove("drop-target"); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before"); e.currentTarget.classList.remove("drop-target");
        if (T.hasDT(e, T.DT_SPACE)) {
          tc.reorderSpaces(e.dataTransfer.getData(T.DT_SPACE), sp.id);
          return;
        }
        const raw = e.dataTransfer.getData("text/plain") || "";
        if (raw.startsWith("bookmark:")) {
          const bid = raw.slice(9);
          tc.moveBookmarkTo(bid, sp.id).then(() => tc.toast("Marcador movido"));
        }
      }}>
      <div className="band" style={{ background: sp.color }}><T.SpaceIconEl sp={sp} /></div>
      <div className="body">
        <div className="fname"><T.SpaceIconEl sp={sp} /> {sp.name}</div>
        <div className="fmeta">{folders.length} carpeta(s) · {st.bms.length} marcador(es)</div>
        {chips.length ? (
          <div className="chips">
            {chips.map((f) => (
              <span key={f.id} className="chip"><T.FolderIconEl f={f} size={12} /><span>{f.name}</span></span>
            ))}
            {folders.length > 4 ? <span className="chip"><span>+{folders.length - 4} más</span></span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SpaceRow({ sp, dragRef }: { sp: T.Space; dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { goSpace, spaceStats } = useApp();
  const { clearDropMarks } = useDnD();
  const st = spaceStats(sp);
  return (
    <div className="vrow space-row" draggable="true" data-id={sp.id} onClick={() => goSpace(sp.id)}
      onDragStart={(e) => {
        dragRef.current = { type: T.DT_SPACE, id: sp.id };
        e.dataTransfer.setData(T.DT_SPACE, sp.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); dragRef.current = null; }}
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_SPACE)) return;
        if (dragRef.current && dragRef.current.id === sp.id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, T.DT_SPACE)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        tc.reorderSpaces(e.dataTransfer.getData(T.DT_SPACE), sp.id);
      }}>
      <span className="vrow-ic"><T.SpaceIconEl sp={sp} /></span>
      <div className="vrow-body">
        <div className="vrow-title">{sp.name}</div>
        <div className="vrow-sub">{st.folders.length} carpeta(s) · {st.bms.length} marcador(es)</div>
      </div>
    </div>
  );
}

/* ---------- Tarjeta de carpeta ---------- */

function FolderCard({ f, dragRef }: { f: T.Folder; dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { goFolder, childFolders, countInTree, folderById, liveBookmarks } = useApp();
  const { clearDropMarks } = useDnD();
  const subs = childFolders(f.id);
  const bms = liveBookmarks().filter((b) => b.folderId === f.id).slice(0, 5);
  const sameLevel = (dragId: string) => {
    const df = folderById(dragId);
    return !!df && df.spaceId === f.spaceId && (df.parentId || null) === (f.parentId || null);
  };
  return (
    <div className="card folder-card" draggable="true" data-id={f.id} title="Arrastra para reordenar"
      onClick={(e) => { if ((e.target as HTMLElement).closest(".subchip")) return; goFolder(f.id); }}
      onDragStart={(e) => {
        dragRef.current = { type: T.DT_FOLDER, id: f.id };
        e.dataTransfer.setData(T.DT_FOLDER, f.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); dragRef.current = null; }}
      onDragOver={(e) => {
        if (T.hasDT(e, T.DT_FOLDER)) {
          const ds = dragRef.current;
          if (ds && !sameLevel(ds.id)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!ds || ds.id !== f.id) e.currentTarget.classList.add("drop-before");
          return;
        }
        e.preventDefault();
        e.currentTarget.classList.add("drop-target");
      }}
      onDragLeave={(e) => { e.currentTarget.classList.remove("drop-before"); e.currentTarget.classList.remove("drop-target"); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before"); e.currentTarget.classList.remove("drop-target");
        if (T.hasDT(e, T.DT_FOLDER)) {
          const did = e.dataTransfer.getData(T.DT_FOLDER);
          if (sameLevel(did)) tc.reorderFolders(did, f.id);
          return;
        }
        const raw = e.dataTransfer.getData("text/plain") || "";
        if (raw.startsWith("bookmark:")) {
          const bid = raw.slice(9);
          tc.moveBookmarkTo(bid, f.id).then(() => tc.toast("Marcador movido"));
        }
      }}>
      <div className="band" style={{ background: f.color }}><T.FolderIconEl f={f} size={26} fallbackFill="#ffffff" /></div>
      <div className="body">
        <div className="fname"><T.FolderIconEl f={f} size={18} /> {f.name}</div>
        <div className="fmeta">{countInTree(f.id)} marcador(es){subs.length ? " · " + subs.length + " subcarpeta(s)" : ""}</div>
        <div className="favs">{bms.map((b) => <span key={b.id}>{T.favEl(b)}</span>)}</div>
        {subs.length ? (
          <div className="subchips">{subs.map((sf) => (
            <button key={sf.id} className="subchip" title={sf.name}
              onClick={(e) => { e.stopPropagation(); goFolder(sf.id); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("drop-target"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drop-target")}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation();
                e.currentTarget.classList.remove("drop-target");
                const raw = e.dataTransfer.getData("text/plain") || "";
                if (raw.startsWith("bookmark:")) {
                  tc.moveBookmarkTo(raw.slice(9), sf.id).then(() => tc.toast("Marcador movido"));
                }
              }}>
              <T.FolderIconEl f={sf} size={12} /><span>{sf.name}</span><b>{countInTree(sf.id)}</b>
            </button>
          ))}</div>
        ) : null}
      </div>
    </div>
  );
}

/* Zona de soltado al final de la cuadrícula */
function Endzone({ kind, want, dragRef, onDropId }:
  { kind: string; want: string; dragRef: React.MutableRefObject<DragState>;
    onDropId: (dragId: string) => void }) {
  const { folderById } = useApp();
  const tc = useTC();
  return (
    <div className="reorder-endzone" data-kind={kind}
      onDragOver={(e) => {
        if (!T.hasDT(e, want)) return;
        const ds = dragRef.current;
        if (want === T.DT_FOLDER && ds) {
          const df = folderById(ds.id);
          if (!df || (df.parentId || null) !== null) return;
        }
        if (want === T.DT_BOOKMARK && ds) {
          const db = tc.db.bookmarks.find((x) => x.id === ds.id);
          if (!db) return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        onDropId(e.dataTransfer.getData(want));
      }} />
  );
}

/* ---------- Vistas ---------- */

function HomeView({ dragRef }: { dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { liveSpaces, getViewMode } = useApp();
  const spaces = liveSpaces().slice().sort(T.byOrder);
  const mode = getViewMode("home");
  if (!spaces.length) {
    return (
      <>
        <PageHead def={{ icon: "🏠", label: "Home", hint: "Tus spaces" }}
          subline={spaces.length + " space(s) · Arrastra para reordenar"} toolbarKey="home" />
        <div id="cards" className="cards" />
        <Empty icon="🏠" lines={["No tienes spaces.", "Crea uno con el botón ＋ de la barra lateral."]} />
      </>
    );
  }
  const cardsCls = mode === "grid" ? "cards zoomable" : "cards";
  return (
    <>
      <PageHead def={{ icon: "🏠", label: "Home", hint: "Tus spaces" }}
        subline={spaces.length + " space(s) · Arrastra para reordenar"} toolbarKey="home" />
      <div id="cards" className={cardsCls}>
        {mode === "list" ? (
          <div className="view-list zoomable">
            {spaces.map((sp) => <SpaceRow key={sp.id} sp={sp} dragRef={dragRef} />)}
          </div>
        ) : mode === "board" ? (
          <div className="view-board zoomable">
            {spaces.map((sp) => <SpaceCard key={sp.id} sp={sp} dragRef={dragRef} />)}
          </div>
        ) : (
          <>
            {spaces.map((sp) => <SpaceCard key={sp.id} sp={sp} dragRef={dragRef} />)}
            <Endzone kind="space" want={T.DT_SPACE} dragRef={dragRef}
              onDropId={(dragId) => tc.reorderSpaces(dragId, null)} />
          </>
        )}
      </div>
    </>
  );
}

function AllView({ dragRef }: { dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { ui, liveFolders, spaceById, goSpace } = useApp();
  const folders = liveFolders().filter((f) => f.spaceId === ui.spaceId && (f.parentId || null) === null).sort(T.byOrder);
  const allInSpace = liveFolders().filter((f) => f.spaceId === ui.spaceId);
  const sp = spaceById(ui.spaceId);
  const fids = new Set(allInSpace.map((f) => f.id));
  const nBm = tc.db.bookmarks.filter((b) => !b.deletedAt && b.folderId && fids.has(b.folderId)).length;
  const titleNode = (
    <>
      <CrumbHome /><span className="crumb-sep">/</span>
      <button className="crumb" onClick={() => sp && goSpace(sp.id)}>
        {sp ? <><T.SpaceIconEl sp={sp} /> {sp.name}</> : "BookDPB"}
      </button>
    </>
  );
  return (
    <>
      <PageHead def={{ icon: "", label: "" }} titleNode={titleNode}
        subline={allInSpace.length + " carpeta(s) · " + nBm + " marcador(es)"} toolbarKey="all" />
      <div id="cards" className="cards">
        {folders.length ? (
          <>
            {folders.map((f) => <FolderCard key={f.id} f={f} dragRef={dragRef} />)}
            <Endzone kind="folder" want={T.DT_FOLDER} dragRef={dragRef}
              onDropId={(dragId) => tc.reorderFolders(dragId, null)} />
          </>
        ) : null}
      </div>
      {folders.length ? null : (
        <Empty icon="🗂" lines={["No hay carpetas en este space.", "Crea una con el botón «+ Carpeta»."]} />
      )}
    </>
  );
}

/* ---------- Lista de marcadores con vistas, zoom y selección múltiple ----------
   Centraliza el render de marcadores para las vistas de carpeta, favoritos y
   etiqueta: respeta el modo de vista (Cuadrícula/Lista/Tablero) + zoom del
   toolbar y añade el modo «Seleccionar» con acciones en lote. */

type ReorderCfg = null | { kind: "folder"; folderId: string } | { kind: "favorites" };

function SelectableBookmarkList({ list, fname, showFolder, reorder, viewKey, dragRef }:
  { list: T.Bookmark[]; fname: Record<string, string>; showFolder: boolean;
    reorder: ReorderCfg; viewKey: string; dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { ui, getViewMode, openModal } = useApp();
  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const mode = getViewMode(viewKey);

  useEffect(() => { setSel(new Set()); setSelMode(false); }, [ui.view, ui.folderId, ui.tag, viewKey]);

  const toggleOne = (id: string) => setSel((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const selectAll = () => setSel(new Set(list.map((b) => b.id)));
  const cancelSel = () => { setSel(new Set()); setSelMode(false); };

  const doDelete = async () => {
    const ids = [...sel];
    if (!ids.length) return;
    if (!confirm(`¿Enviar ${ids.length} marcador(es) a la papelera?`)) return;
    await tc.trashBookmarks(ids);
    await tc.logActivity("delete", `Enviaste ${ids.length} marcador(es) a la papelera`, "");
    tc.toast(`${ids.length} marcador(es) enviados a la papelera`);
    cancelSel();
  };
  const doMove = () => {
    const ids = [...sel];
    if (!ids.length) return;
    openModal("moveBookmarks", { ids, onDone: cancelSel });
  };

  const cardReorder: boolean | "favorites" = !reorder ? false : reorder.kind === "favorites" ? "favorites" : true;
  const cardProps = (b: T.Bookmark) => ({
    b, showFolder, fname, dragRef, selMode, canReorder: cardReorder,
    selected: sel.has(b.id), onToggleSelect: () => toggleOne(b.id),
  });
  const rowProps = (b: T.Bookmark) => ({
    b, fname, selMode, selected: sel.has(b.id), onToggleSelect: () => toggleOne(b.id),
  });

  const endzone = reorder ? (
    <Endzone kind="bookmark" want={T.DT_BOOKMARK} dragRef={dragRef}
      onDropId={(dragId) => reorder.kind === "favorites"
        ? tc.reorderFavorites(dragId, null)
        : tc.reorderBookmarks(reorder.folderId, dragId, null)} />
  ) : null;

  let body: React.ReactNode;
  if (mode === "list") {
    body = <div className="view-list zoomable">{list.map((b) => <BookmarkRow key={b.id} {...rowProps(b)} />)}</div>;
  } else if (mode === "board") {
    body = <div className="view-board zoomable">{list.map((b) => <BookmarkCard key={b.id} {...cardProps(b)} />)}</div>;
  } else {
    body = (<>
      {list.map((b) => <BookmarkCard key={b.id} {...cardProps(b)} />)}
      {endzone}
    </>);
  }

  return (
    <>
      <div className="sel-toolbar">
        {!selMode ? (
          <button className="btn sel-btn" onClick={() => setSelMode(true)}>☑ Seleccionar</button>
        ) : (
          <span className="sel-count">{sel.size} seleccionado(s)</span>
        )}
      </div>
      <div id="cards" className="cards zoomable">{body}</div>
      {selMode ? (
        <div className="bulkbar">
          <button className="btn sel-btn" onClick={selectAll}>✓ Todos</button>
          <button className="btn sel-btn" onClick={() => setSel(new Set())}>✕ Ninguno</button>
          <button className="btn sel-btn danger" onClick={doDelete}>🗑 Eliminar</button>
          <button className="btn sel-btn" onClick={doMove}>📁 Mover a…</button>
          <button className="btn sel-btn" onClick={cancelSel}>Cancelar</button>
        </div>
      ) : null}
    </>
  );
}

function FolderView({ dragRef }: { dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { ui, goHome, goSpace, goFolder, folderById, spaceById, liveBookmarks } = useApp();
  const f = folderById(ui.folderId);
  if (!f || f.deletedAt) {
    goHome();
    return null;
  }
  const ids = new Set(T.folderTreeIds(tc.db.folders, f.id));
  const list = liveBookmarks().filter((b) => b.folderId && ids.has(b.folderId)).sort(T.byOrder);
  const sp = spaceById(f.spaceId);
  const path: T.Folder[] = [];
  let cur: T.Folder | undefined = f;
  let guard = 0;
  while (cur && guard++ < 20) {
    path.unshift(cur);
    cur = cur.parentId ? folderById(cur.parentId) : undefined;
  }
  const fname: Record<string, string> = {};
  tc.db.folders.forEach((x) => { fname[x.id] = x.name; });
  const titleNode = (
    <>
      <CrumbHome /><span className="crumb-sep">/</span>
      <button className="crumb" onClick={() => goSpace(f.spaceId)}>
        {sp ? <><T.SpaceIconEl sp={sp} /> {sp.name}</> : ""}
      </button>
      <span className="crumb-sep">/</span>
      {path.map((p, i) => i < path.length - 1 ? (
        <React.Fragment key={p.id}>
          <button className="crumb" onClick={() => goFolder(p.id)}>
            <T.FolderIconEl f={p} size={16} /> {p.name}
          </button>
          <span className="crumb-sep">/</span>
        </React.Fragment>
      ) : (
        <span key={p.id}><span className="folder-ico"><T.FolderIconEl f={p} size={20} /></span>{p.name}</span>
      ))}
    </>
  );
  return (
    <>
      <PageHead def={{ icon: "", label: "" }} titleNode={titleNode}
        subline={list.length + " marcador(es) · Arrastra para reordenar"} toolbarKey="folder" />
      <SelectableBookmarkList list={list} fname={fname} showFolder={false} viewKey="folder"
        reorder={{ kind: "folder", folderId: f.id }} dragRef={dragRef} />
      {list.length ? null : (
        <Empty icon="🔖" lines={[
          "Esta carpeta está vacía.",
          "Arrastra pestañas desde el panel lateral hasta una carpeta,",
          "o usa el botón «+ Carpeta» y el menú contextual del navegador.",
        ]} />
      )}
    </>
  );
}

function TagView({ dragRef }: { dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { ui, tagColorOf, liveBookmarks } = useApp();
  const list = liveBookmarks().filter((b) => (b.tags || []).includes(ui.tag || "")).sort(T.byOrder);
  const fname: Record<string, string> = {};
  tc.db.folders.forEach((x) => { fname[x.id] = x.name; });
  const titleNode = (
    <>
      <CrumbHome />
      <span className="tag big" style={{ "--tagc": tagColorOf(ui.tag || "") } as React.CSSProperties}>#{ui.tag}</span>
    </>
  );
  return (
    <>
      <PageHead def={{ icon: "", label: "" }} titleNode={titleNode}
        subline={list.length + " marcador(es)"} toolbarKey="tag" />
      <SelectableBookmarkList list={list} fname={fname} showFolder={true} viewKey="tag"
        reorder={null} dragRef={dragRef} />
      {list.length ? null : (
        <Empty icon="🔖" lines={["No hay marcadores con la etiqueta #" + ui.tag + "."]} />
      )}
    </>
  );
}

function UnusedView({ dragRef }: { dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { liveBookmarks } = useApp();
  const list = liveBookmarks().filter((b) => !b.lastOpened).sort((a, b) => b.createdAt - a.createdAt);
  const fname: Record<string, string> = {};
  tc.db.folders.forEach((x) => { fname[x.id] = x.name; });
  const titleNode = (<><CrumbHome />⏳ Sin usar</>);
  return (
    <>
      <PageHead def={{ icon: "", label: "" }} titleNode={titleNode}
        subline={list.length + " marcador(es) sin abrir todavía"} toolbarKey="unused" />
      <div id="cards" className="cards">
        {list.map((b) => (
          <BookmarkCard key={b.id} b={b} showFolder={true} fname={fname} canReorder={false} dragRef={dragRef} />
        ))}
      </div>
      {list.length ? null : (
        <Empty icon="⏳" lines={["No hay marcadores sin abrir.", "Los marcadores que aún no hayas abierto aparecerán aquí."]} />
      )}
    </>
  );
}

/* ---------- Mis Items ---------- */

function MisItemsView() {
  const { goItem, getViewMode, itemCount } = useApp();
  const mode = getViewMode("misitems");
  const keys = ["accounts", "assistants", "reminders", "favorites", "history", "trash", "readlater"];
  const def = { icon: "🗂", label: "Mis Items", hint: "Todos tus items en un vistazo" };
  const counts: Record<string, number> = {};
  keys.forEach((k) => { counts[k] = itemCount(k); });
  const body = mode === "list" ? (
    <div className="view-list zoomable">
      {keys.map((k) => (
        <div key={k} className="vrow mi-row" onClick={() => goItem(k)}>
          <span className="vrow-ic mi-logo-sm">{T.ITEM_DEFS[k].icon}</span>
          <div className="vrow-body">
            <div className="vrow-title">{T.ITEM_DEFS[k].label}</div>
            <div className="vrow-sub">{T.ITEM_DEFS[k].hint}</div>
          </div>
          <span className="vrow-meta">{counts[k]}</span>
        </div>
      ))}
    </div>
  ) : (
    <div className={mode === "board" ? "view-board zoomable" : "item-grid zoomable"}>
      {keys.map((k) => (
        <div key={k} className="card ref-card mi-tile" title={"Abrir " + T.ITEM_DEFS[k].label} onClick={() => goItem(k)}>
          <div className="ref-logo mi-logo">{T.ITEM_DEFS[k].icon}</div>
          <div className="ref-name">{T.ITEM_DEFS[k].label}</div>
          <div className="ref-domain">{counts[k]} elemento(s)</div>
          <div className="mi-hint">{T.ITEM_DEFS[k].hint}</div>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <PageHead def={def} subline={keys.length + " items · Haz clic en uno para abrirlo"} toolbarKey="misitems" />
      <div id="cards" className="cards">{body}</div>
    </>
  );
}

/* ---------- Cuentas / Asistentes ---------- */

function AccountCard({ a, kind, dragRef }: { a: T.Account; kind: string; dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { openModal } = useApp();
  const { clearDropMarks } = useDnD();
  const label = kind === "accounts" ? "la cuenta" : "el asistente";
  const del = async () => {
    if (kind === "accounts") await tc.trashAccount(a.id); else await tc.trashAssistant(a.id);
    await tc.logActivity("delete", "Enviaste " + label + " a la papelera", a.name);
    tc.toast("Elemento enviado a la papelera");
  };
  const dt = kind === "accounts" ? T.DT_ACCOUNT : T.DT_ASSISTANT;
  return (
    <div className="card ref-card item-card" draggable="true" data-kind={kind} data-id={a.id}
      title="Arrastra para reordenar · clic para abrir"
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act]")) return; openModal("account", { id: a.id, kind: "view", coll: kind }); }}
      onDragStart={(e) => {
        dragRef.current = { type: dt, id: a.id };
        e.dataTransfer.setData(dt, a.id);
        e.dataTransfer.setData("text/plain", "item:" + a.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); dragRef.current = null; }}
      onDragOver={(e) => {
        if (!T.hasDT(e, dt)) return;
        if (!dragRef.current || dragRef.current.id === a.id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, dt)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        const did = e.dataTransfer.getData(dt);
        if (!dragRef.current || dragRef.current.id === a.id) return;
        if (kind === "accounts") tc.reorderAccounts(did, a.id); else tc.reorderAssistants(did, a.id);
      }}>
      <div className="hover-actions">
        <button className="icon-btn" data-act="edit" title="Editar"
          onClick={(e) => { e.stopPropagation(); openModal("account", { id: a.id, coll: kind }); }}>✎</button>
        <button className="icon-btn" data-act="del" title="Enviar a papelera"
          onClick={(e) => { e.stopPropagation(); del(); }}>×</button>
      </div>
      <div className="ref-logo"><T.ItemIconEl a={a} size={40} /></div>
      <div className="ref-name">{a.name}</div>
      <div className="ref-domain">↗ {T.domainOf(a.url || "")}</div>
      {(a.username || a.email || a.password || a.note) ? <div className="note-flag">📝 con datos</div> : null}
    </div>
  );
}

function AccountRow({ a, kind }: { a: T.Account; kind: string }) {
  const tc = useTC();
  const { openModal } = useApp();
  const label = kind === "accounts" ? "la cuenta" : "el asistente";
  const del = async () => {
    if (kind === "accounts") await tc.trashAccount(a.id); else await tc.trashAssistant(a.id);
    await tc.logActivity("delete", "Enviaste " + label + " a la papelera", a.name);
    tc.toast("Elemento enviado a la papelera");
  };
  return (
    <div className="vrow" data-kind={kind} data-id={a.id}
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act]")) return; openModal("account", { id: a.id, kind: "view", coll: kind }); }}>
      <span className="vrow-ic"><T.ItemIconEl a={a} size={22} /></span>
      <div className="vrow-body">
        <div className="vrow-title">{a.name}</div>
        <div className="vrow-sub">{T.domainOf(a.url || "")}{(a.username || a.email) ? " · " + (a.username || a.email) : ""}</div>
      </div>
      <div className="vrow-actions">
        <button className="icon-btn" data-act="edit" title="Editar"
          onClick={(e) => { e.stopPropagation(); openModal("account", { id: a.id, coll: kind }); }}>✎</button>
        <button className="icon-btn" data-act="del" title="Enviar a papelera"
          onClick={(e) => { e.stopPropagation(); del(); }}>×</button>
      </div>
    </div>
  );
}

function AccountsView({ vkey }: { vkey: string }) {
  const tc = useTC();
  const { openModal, getViewMode, liveAccounts, liveAssistants } = useApp();
  const dragRef = useRef<DragState>(null);
  const kind = vkey;
  const def = T.ITEM_DEFS[kind];
  const list = (kind === "accounts" ? liveAccounts() : liveAssistants()).slice().sort(T.byOrder);
  const mode = getViewMode(kind);
  const label = kind === "accounts" ? "la cuenta" : "el asistente";
  const subline = list.length + " elemento(s) · Arrastra para reordenar · Haz clic para abrir" +
    (kind === "accounts" ? " · 📝 para ver la nota" : "");
  const dt = kind === "accounts" ? T.DT_ACCOUNT : T.DT_ASSISTANT;
  const primary = (
    <button className="btn blue" id="vaAdd" onClick={() => openModal("account", { coll: kind })}>
      {def.icon} {kind === "accounts" ? "Agregar cuenta" : "Agregar IA"}
    </button>
  );
  return (
    <>
      <PageHead def={def} subline={subline} toolbarKey={kind} primary={primary} />
      <div id="cards" className="cards">
        {!list.length ? null : mode === "list" ? (
          <div className="view-list zoomable">
            {list.map((a) => <AccountRow key={a.id} a={a} kind={kind} />)}
          </div>
        ) : (
          <div className={mode === "board" ? "view-board zoomable" : "item-grid zoomable"}>
            {list.map((a) => <AccountCard key={a.id} a={a} kind={kind} dragRef={dragRef} />)}
            {mode === "grid" ? (
              <div className="reorder-endzone" data-kind="items"
                onDragOver={(e) => { if (!T.hasDT(e, dt)) return; e.preventDefault(); e.currentTarget.classList.add("drop-before"); }}
                onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
                onDrop={(e) => {
                  if (!T.hasDT(e, dt)) return;
                  e.preventDefault(); e.currentTarget.classList.remove("drop-before");
                  const did = e.dataTransfer.getData(dt);
                  if (kind === "accounts") tc.reorderAccounts(did, null); else tc.reorderAssistants(did, null);
                }} />
            ) : null}
          </div>
        )}
      </div>
      {!list.length ? <Empty icon={def.icon} lines={["Nada por aquí todavía.", "Pulsa «＋» para añadir el primero."]} /> : null}
    </>
  );
}

/* ---------- Recordatorios ---------- */

function RemIcon({ r, size }: { r: T.Reminder; size: number }) {
  if (r.iconType === "img" && r.icon && T.safeIconURL(r.icon))
    return <img src={T.safeIconURL(r.icon)} style={{ width: size + "px", height: size + "px", borderRadius: "8px", objectFit: "cover" }} alt="" />;
  if (r.iconType === "emoji" && r.icon)
    return <span style={{ fontSize: size + "px", lineHeight: 1 }}>{r.icon}</span>;
  return <span style={{ fontSize: size + "px", lineHeight: 1 }}>⏰</span>;
}

function ReminderCard({ r, dragRef }: { r: T.Reminder; dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { openModal } = useApp();
  const { clearDropMarks } = useDnD();
  const overdue = !r.done && r.when < Date.now();
  const color = r.color || T.NOTE_COLORS[0];
  const del = async () => {
    await tc.trashReminder(r.id);
    await tc.logActivity("delete", "Enviaste el recordatorio a la papelera", r.title);
    tc.toast("Elemento enviado a la papelera");
  };
  return (
    <div className={"card ref-card rem-card item-card" + (r.done ? " done" : "") + (overdue ? " overdue" : "")}
      draggable="true" data-kind="reminders" data-id={r.id}
      style={{ borderTop: "5px solid " + color }} title="Arrastra para reordenar"
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act]")) return; if (r.url) tc.openUrl(r.url); }}
      onDragStart={(e) => {
        dragRef.current = { type: T.DT_REMINDER, id: r.id };
        e.dataTransfer.setData(T.DT_REMINDER, r.id);
        e.dataTransfer.setData("text/plain", "item:" + r.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); dragRef.current = null; }}
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_REMINDER)) return;
        if (!dragRef.current || dragRef.current.id === r.id) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, T.DT_REMINDER)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        if (!dragRef.current || dragRef.current.id === r.id) return;
        tc.reorderReminders(dragRef.current.id, r.id);
      }}>
      <div className="hover-actions">
        <button className="icon-btn" data-act="edit" title="Editar"
          onClick={(e) => { e.stopPropagation(); openModal("reminder", { id: r.id }); }}>✎</button>
        <button className="icon-btn" data-act="del" title="Enviar a papelera"
          onClick={(e) => { e.stopPropagation(); del(); }}>×</button>
      </div>
      <button className="rem-toggle" data-act="done" title={r.done ? "Marcar pendiente" : "Marcar completado"}
        onClick={(e) => { e.stopPropagation(); tc.toggleReminderDone(r.id); }}>{r.done ? "✅" : "⬜"}</button>
      <div className="ref-logo"><RemIcon r={r} size={34} /></div>
      <div className="ref-name">{r.title}</div>
      <div className="ref-domain">⏰ {T.fmtDateTime(r.when)}{overdue ? <> · <b>atrasado</b></> : null}</div>
      {r.url ? <div className="ref-domain">🔗 {T.domainOf(r.url)}</div> : null}
      {r.note ? <div className="note-flag">📝 con nota</div> : null}
    </div>
  );
}

function ReminderRow({ r }: { r: T.Reminder }) {
  const tc = useTC();
  const { openModal } = useApp();
  const overdue = !r.done && r.when < Date.now();
  const onClick = (e: React.MouseEvent) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (act === "done") { e.stopPropagation(); tc.toggleReminderDone(r.id); return; }
    if (act === "edit") { e.stopPropagation(); openModal("reminder", { id: r.id }); return; }
    if (act === "del") {
      e.stopPropagation();
      tc.trashReminder(r.id).then(() => {
        tc.logActivity("delete", "Enviaste el recordatorio a la papelera", r.title);
        tc.toast("Elemento enviado a la papelera");
      });
      return;
    }
    if (r.url) tc.openUrl(r.url);
  };
  return (
    <div className={"vrow rem-row" + (r.done ? " done" : "") + (overdue ? " overdue" : "")} data-id={r.id}
      style={{ borderLeft: "5px solid " + (r.color || T.NOTE_COLORS[0]) }} onClick={onClick}>
      <button className="rem-toggle" data-act="done" title={r.done ? "Marcar pendiente" : "Marcar completado"}>
        {r.done ? "✅" : "⬜"}
      </button>
      <span className="vrow-ic"><RemIcon r={r} size={20} /></span>
      <div className="vrow-body">
        <div className="vrow-title">{r.title}</div>
        <div className="vrow-sub">⏰ {T.fmtDateTime(r.when)}{overdue ? <> · <b>atrasado</b></> : null}{r.url ? " · 🔗 " + T.domainOf(r.url) : ""}</div>
      </div>
      <div className="vrow-actions">
        <button className="icon-btn" data-act="edit" title="Editar">✎</button>
        <button className="icon-btn" data-act="del" title="Enviar a papelera">×</button>
      </div>
    </div>
  );
}

function RemindersView() {
  const tc = useTC();
  const { openModal, getViewMode, liveReminders } = useApp();
  const dragRef = useRef<DragState>(null);
  const { clearDropMarks } = useDnD();
  const def = T.ITEM_DEFS["reminders"];
  const list = liveReminders().slice().sort((a, b) => a.when - b.when);
  const pending = list.filter((r) => !r.done).length;
  const mode = getViewMode("reminders");
  const primary = (
    <button className="btn blue" id="vaAdd" onClick={() => openModal("reminder", {})}>⏰ Agregar recordatorio</button>
  );
  const endzone = (
    <div className="reorder-endzone" data-kind="items"
      onDragOver={(e) => { if (!T.hasDT(e, T.DT_REMINDER)) return; e.preventDefault(); e.currentTarget.classList.add("drop-before"); }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, T.DT_REMINDER)) return;
        e.preventDefault(); e.currentTarget.classList.remove("drop-before");
        if (dragRef.current) tc.reorderReminders(dragRef.current.id, null);
      }} />
  );
  let body: React.ReactNode = null;
  if (!list.length) body = null;
  else if (mode === "list") {
    body = <div className="view-list zoomable">{list.map((r) => <ReminderRow key={r.id} r={r} />)}</div>;
  } else if (mode === "board") {
    const pend = list.filter((r) => !r.done), done = list.filter((r) => r.done);
    const col = (t: string, items: T.Reminder[]) => (
      <div className="rem-col" key={t}>
        <h4 className="rem-col-t">{t} ({items.length})</h4>
        <div className="view-board zoomable">{items.map((r) => <ReminderCard key={r.id} r={r} dragRef={dragRef} />)}</div>
      </div>
    );
    body = <div className="rem-board">{col("⏳ Pendientes", pend)}{col("✅ Completados", done)}</div>;
  } else {
    body = (
      <div className="item-grid zoomable">
        {list.map((r) => <ReminderCard key={r.id} r={r} dragRef={dragRef} />)}
        {endzone}
      </div>
    );
  }
  return (
    <>
      <PageHead def={def}
        subline={pending + " pendiente(s) · " + list.length + " total · Arrastra para reordenar"}
        toolbarKey="reminders" primary={primary} />
      <div id="cards" className="cards">{body}</div>
      {!list.length ? <Empty icon={def.icon} lines={["Sin recordatorios.", "Pulsa «＋» para crear el primero."]} /> : null}
    </>
  );
}

/* ---------- Favoritos ---------- */

function FavoritesView({ dragRef }: { dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { liveBookmarks } = useApp();
  const def = T.ITEM_DEFS["favorites"];
  const list = liveBookmarks().filter((b) => b.favorite)
    .sort((a, b) => (a.favOrder - b.favOrder) || T.byOrder(a, b));
  const fname: Record<string, string> = {};
  tc.db.folders.forEach((x) => { fname[x.id] = x.name; });
  return (
    <>
      <PageHead def={def} subline={list.length + " favorito(s) · Pulsa ☆ en un marcador para añadirlo · Arrastra para reordenar"} toolbarKey="favorites" />
      <SelectableBookmarkList list={list} fname={fname} showFolder={true} viewKey="favorites"
        reorder={{ kind: "favorites" }} dragRef={dragRef} />
      {!list.length ? <Empty icon={def.icon} lines={["Sin favoritos todavía.", "Pulsa ☆ en cualquier marcador para destacarlo."]} /> : null}
    </>
  );
}

/* ---------- Historial ---------- */

const HIST_FILTERS: [string, string, string][] = [
  ["all", "📋", "Todos"], ["create", "➕", "Creados"], ["edit", "✎", "Editados"],
  ["delete", "🗑", "Eliminados"], ["favorite", "⭐", "Favoritos"], ["session", "📦", "Sesiones"],
];

function HistoryView() {
  const tc = useTC();
  const { ui, setUi } = useApp();
  const def = T.ITEM_DEFS["history"];
  const all = (tc.db.activity || []).filter((a) => ui.histFilter === "all" || a.type === ui.histFilter);
  const primary = (tc.db.activity || []).length ? (
    <button className="btn danger" id="vaClearHist" onClick={async () => {
      if (!confirm("¿Limpiar todo el historial de actividad?")) return;
      await tc.clearActivity();
      tc.toast("Historial limpio");
    }}>🧹 Limpiar historial</button>
  ) : undefined;
  const filters = (
    <div className="hl-filters">
      {HIST_FILTERS.map((f) => (
        <button key={f[0]} className={"hl-fbtn" + (ui.histFilter === f[0] ? " active" : "")}
          onClick={() => setUi({ histFilter: f[0] })}>
          <span className="hl-fico">{f[1]}</span><span className="hl-flbl">{f[2]}</span>
        </button>
      ))}
    </div>
  );
  const dayLabel = (ds: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dd = new Date(ds); dd.setHours(0, 0, 0, 0);
    if (dd.getTime() === today.getTime()) return "Hoy";
    if (dd.getTime() === today.getTime() - 86400000) return "Ayer";
    return new Date(ds).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  };
  let body: React.ReactNode;
  if (!all.length) {
    body = (
      <div className="notes-empty"><p>
        {(tc.db.activity || []).length ? "Sin resultados para este filtro." : "Sin actividad registrada. Tus acciones importantes aparecerán aquí."}
      </p></div>
    );
  } else {
    const groups: Record<string, T.Activity[]> = {};
    all.forEach((a) => {
      const k = new Date(a.at).toDateString();
      (groups[k] = groups[k] || []).push(a);
    });
    body = (
      <>
        {Object.keys(groups).map((k) => (
          <React.Fragment key={k}>
            <h3 className="rl-sec">{dayLabel(k)}</h3>
            <div className="hist-list">
              {groups[k].map((a, i) => (
                <div className="hist-row" key={i}>
                  <span className="hist-ico">{T.HIST_ICONS[a.type] || "•"}</span>
                  <div className="hist-body">
                    <div className="hist-text">{a.text}</div>
                    {a.detail ? <div className="hist-detail">{a.detail}</div> : null}
                  </div>
                  <span className="hist-time">{T.fmtDateTime(a.at)}</span>
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
      </>
    );
  }
  return (
    <>
      <PageHead def={def} subline={(tc.db.activity || []).length + " evento(s)"}
        toolbarKey="history" primary={primary} hideToolbar={true} />
      <div id="cards" className="cards">{filters}{body}</div>
    </>
  );
}

/* ---------- Papelera unificada ---------- */

function TrashRow({ t }: { t: { kind: string; label: string; icon: string; id: string; name: string; deletedAt: number } }) {
  const tc = useTC();
  const daysLeft = Math.max(0, Math.ceil(T.TRASH_DAYS - (Date.now() - t.deletedAt) / 86400000));
  const restore = async () => {
    if (t.kind === "spaces") await tc.restoreSpace(t.id);
    else if (t.kind === "folders") await tc.restoreFolder(t.id);
    else if (t.kind === "bookmarks") await tc.restoreBookmark(t.id);
    else if (t.kind === "notes") await tc.restoreNote(t.id);
    else if (t.kind === "accounts") await tc.restoreAccount(t.id);
    else if (t.kind === "assistants") await tc.restoreAssistant(t.id);
    else if (t.kind === "reminders") await tc.restoreReminder(t.id);
    tc.toast("Restaurado");
  };
  const purge = async () => {
    if (!confirm("¿Eliminar «" + (t.name || "este elemento") + "» para siempre?")) return;
    if (t.kind === "spaces") await tc.purgeSpace(t.id);
    else if (t.kind === "folders") await tc.purgeFolder(t.id);
    else if (t.kind === "bookmarks") await tc.purgeBookmark(t.id);
    else if (t.kind === "notes") await tc.purgeNote(t.id);
    else if (t.kind === "accounts") await tc.purgeAccount(t.id);
    else if (t.kind === "assistants") await tc.purgeAssistant(t.id);
    else if (t.kind === "reminders") await tc.purgeReminder(t.id);
    tc.toast("Eliminado para siempre");
  };
  return (
    <div className="trash-row">
      <span className="hist-ico">{t.icon}</span>
      <div className="hist-body">
        <div className="hist-text">{t.name || "(sin nombre)"}</div>
        <div className="hist-detail">{t.label} · eliminado {T.fmtDate(t.deletedAt)} · quedan {daysLeft} día(s)</div>
      </div>
      <button className="btn sm" onClick={restore}>↩️ Restaurar</button>
      <button className="btn sm danger" onClick={purge}>Eliminar</button>
    </div>
  );
}

function TrashCard({ t }: { t: { kind: string; label: string; icon: string; id: string; name: string; deletedAt: number } }) {
  const tc = useTC();
  const daysLeft = Math.max(0, Math.ceil(T.TRASH_DAYS - (Date.now() - t.deletedAt) / 86400000));
  const restore = async () => {
    if (t.kind === "spaces") await tc.restoreSpace(t.id);
    else if (t.kind === "folders") await tc.restoreFolder(t.id);
    else if (t.kind === "bookmarks") await tc.restoreBookmark(t.id);
    else if (t.kind === "notes") await tc.restoreNote(t.id);
    else if (t.kind === "accounts") await tc.restoreAccount(t.id);
    else if (t.kind === "assistants") await tc.restoreAssistant(t.id);
    else if (t.kind === "reminders") await tc.restoreReminder(t.id);
    tc.toast("Restaurado");
  };
  const purge = async () => {
    if (!confirm("¿Eliminar «" + (t.name || "este elemento") + "» para siempre?")) return;
    if (t.kind === "spaces") await tc.purgeSpace(t.id);
    else if (t.kind === "folders") await tc.purgeFolder(t.id);
    else if (t.kind === "bookmarks") await tc.purgeBookmark(t.id);
    else if (t.kind === "notes") await tc.purgeNote(t.id);
    else if (t.kind === "accounts") await tc.purgeAccount(t.id);
    else if (t.kind === "assistants") await tc.purgeAssistant(t.id);
    else if (t.kind === "reminders") await tc.purgeReminder(t.id);
    tc.toast("Eliminado para siempre");
  };
  return (
    <div className="card trash-card">
      <span className="hist-ico">{t.icon}</span>
      <div className="hist-text">{t.name || "(sin nombre)"}</div>
      <div className="hist-detail">{t.label} · eliminado {T.fmtDate(t.deletedAt)}</div>
      <div className="hist-detail">quedan {daysLeft} día(s)</div>
      <div className="trash-card-actions">
        <button className="btn sm" onClick={restore}>↩️ Restaurar</button>
        <button className="btn sm danger" onClick={purge}>Eliminar</button>
      </div>
    </div>
  );
}

function TrashView() {
  const tc = useTC();
  const { getViewMode, trashEntries } = useApp();
  const def = T.ITEM_DEFS["trash"];
  const list = trashEntries();
  const mode = getViewMode("trash");
  const primary = list.length ? (
    <button className="btn danger" id="vaEmpty" onClick={async () => {
      if (!list.length) { tc.toast("La papelera ya está vacía"); return; }
      if (!confirm("¿Vaciar la papelera? Se eliminarán " + list.length + " elemento(s) para siempre.")) return;
      await tc.emptyTrash();
      tc.toast("Papelera vaciada");
    }}>🗑 Vaciar papelera</button>
  ) : undefined;
  return (
    <>
      <PageHead def={def} subline={list.length + " elemento(s) · se eliminan solos a los 30 días"}
        toolbarKey="trash" primary={primary} />
      <div id="cards" className="cards">
        {list.length ? (
          mode === "list" ? (
            <div className="trash-list">{list.map((t) => <TrashRow key={t.kind + ":" + t.id} t={t} />)}</div>
          ) : (
            <div className={mode === "board" ? "view-board zoomable" : "item-grid zoomable"}>
              {list.map((t) => <TrashCard key={t.kind + ":" + t.id} t={t} />)}
            </div>
          )
        ) : null}
      </div>
      {!list.length ? <Empty icon={def.icon} lines={["La papelera está vacía."]} /> : null}
    </>
  );
}

/* ---------- Leer después ---------- */

function NoteCardLite({ n, dragRef, onOpts }: { n: T.NoteT; dragRef: React.MutableRefObject<DragState>; onOpts: (id: string, anchor: HTMLElement) => void }) {
  const { openModal } = useApp();
  const preview = T.stripTags(n.html).replace(/\s+/g, " ").trim().slice(0, 140);
  const atts = (n.attachments || []).length;
  return (
    <div className="note-card rich" draggable="true" data-id={n.id}
      style={{ background: n.color || "#fef3c7" }}
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act]")) return; openModal("note", { id: n.id }); }}
      onDragStart={(e) => {
        dragRef.current = { type: "note", id: n.id };
        e.dataTransfer.setData("text/plain", "note:" + n.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); dragRef.current = null; }}>
      {n.pinned ? <span className="n-pin" title="Nota fijada">📌</span> : null}
      {n.readLater ? <span className="n-rl" title="Marcada para leer después">🔖</span> : null}
      <button className="n-full" data-act="full" title="Pantalla completa"
        onClick={(e) => { e.stopPropagation(); openModal("noteFull", { id: n.id }); }}>⛶</button>
      <button className="n-opts" data-act="opts" title="Opciones de la nota"
        onClick={(e) => { e.stopPropagation(); onOpts(n.id, e.currentTarget); }}>⋯</button>
      <div className="n-title">{n.title || "Sin título"}</div>
      {preview ? <div className="n-preview">{preview}</div> : null}
      {atts ? <div className="n-atts">📎 {atts} adjunto(s)</div> : null}
      <span className="n-date">{T.fmtDateTime(n.updatedAt)}</span>
    </div>
  );
}

function NoteRowLite({ n }: { n: T.NoteT }) {
  const { openModal } = useApp();
  const preview = T.stripTags(n.html).replace(/\s+/g, " ").trim().slice(0, 120);
  return (
    <div className="vrow note-row" data-id={n.id}
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act]")) return; openModal("note", { id: n.id }); }}>
      <span className="vrow-ic">📝</span>
      <div className="vrow-body">
        <div className="vrow-title">{n.title || "Sin título"}</div>
        {preview ? <div className="vrow-sub">{preview}</div> : null}
      </div>
      {(n.attachments || []).length ? <span className="vrow-meta">📎 {n.attachments.length}</span> : null}
      <span className="vrow-meta">{T.fmtDateTime(n.updatedAt)}</span>
      <div className="vrow-actions">
        <button className="icon-btn" data-act="full" title="Pantalla completa"
          onClick={(e) => { e.stopPropagation(); openModal("noteFull", { id: n.id }); }}>⛶</button>
      </div>
    </div>
  );
}

function ReadLaterView({ dragRef }: { dragRef: React.MutableRefObject<DragState> }) {
  const tc = useTC();
  const { getViewMode, liveBookmarks, liveNotes } = useApp();
  const def = T.ITEM_DEFS["readlater"];
  const bms = liveBookmarks().filter((b) => b.readLater).sort(T.byOrder);
  const nts = liveNotes().filter((n) => n.readLater).sort(T.byOrder);
  const mode = getViewMode("readlater");
  const [pop, setPop] = useState<{ id: string; rect: DOMRect } | null>(null);
  const onOpts = (id: string, anchor: HTMLElement) => setPop({ id, rect: anchor.getBoundingClientRect() });
  const fname: Record<string, string> = {};
  tc.db.folders.forEach((x) => { fname[x.id] = x.name; });
  const bmWrap = mode === "list" ? "view-list zoomable" : (mode === "board" ? "view-board zoomable" : "cards rl-cards");
  const ntWrap = mode === "list" ? "view-list zoomable" : (mode === "board" ? "view-board zoomable" : "notes-grid");
  return (
    <>
      <PageHead def={def} subline={bms.length + " marcador(es) · " + nts.length + " nota(s)"} toolbarKey="readlater" />
      <div id="cards" className="cards">
        <h3 className="rl-sec">🔖 Marcadores ({bms.length})</h3>
        {bms.length ? (
          <div className={bmWrap}>
            {bms.map((b) => mode === "list"
              ? <BookmarkRow key={b.id} b={b} fname={fname} />
              : <BookmarkCard key={b.id} b={b} showFolder={true} fname={fname} canReorder={false} dragRef={dragRef} />)}
          </div>
        ) : <p className="rl-empty">Sin marcadores para leer después.</p>}
        <h3 className="rl-sec">📝 Notas ({nts.length})</h3>
        {nts.length ? (
          <div className={ntWrap}>
            {nts.map((n) => mode === "list"
              ? <NoteRowLite key={n.id} n={n} />
              : <NoteCardLite key={n.id} n={n} dragRef={dragRef} onOpts={onOpts} />)}
          </div>
        ) : <p className="rl-empty">Sin notas para leer después.</p>}
      </div>
      {pop ? <NotePopover noteId={pop.id} rect={pop.rect} notes={liveNotes()} onClose={() => setPop(null)} /> : null}
    </>
  );
}

/* ---------- Dispatch ---------- */

export function Views() {
  const tc = useTC();
  const { ui, setUi } = useApp();
  const dragRef = useRef<DragState>(null);

  const zoom = tc.db.settings?.cardZoom ?? 1;
  useEffect(() => {
    document.documentElement.style.setProperty("--cardzoom", String(zoom));
  }, [zoom]);

  if (ui.notes) return null;

  const v = ui.view;
  let body: React.ReactNode = null;
  if (v === "home") body = <HomeView dragRef={dragRef} />;
  else if (v === "all") body = <AllView dragRef={dragRef} />;
  else if (v === "folder") body = <FolderView dragRef={dragRef} />;
  else if (v === "tag") body = <TagView dragRef={dragRef} />;
  else if (v === "unused") body = <UnusedView dragRef={dragRef} />;
  else if (v === "misitems") body = <MisItemsView />;
  else if (v === "accounts") body = <AccountsView vkey="accounts" />;
  else if (v === "assistants") body = <AccountsView vkey="assistants" />;
  else if (v === "reminders") body = <RemindersView />;
  else if (v === "favorites") body = <FavoritesView dragRef={dragRef} />;
  else if (v === "history") body = <HistoryView />;
  else if (v === "trash") body = <TrashView />;
  else if (v === "readlater") body = <ReadLaterView dragRef={dragRef} />;

  return (
    <>
      <div id="notesBar" className="notes-toggle">
        <button id="btnShowNotes" className="btn" onClick={() => setUi({ notes: true })}>📝 Ver notas</button>
        <button id="btnShowFolders" className="btn hidden">🗂 Ver carpetas</button>
      </div>
      {body}
    </>
  );
}
