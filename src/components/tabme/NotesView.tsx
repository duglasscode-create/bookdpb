/* BookDPB — NotesView.tsx
   Vista de notas, portada literalmente de TabmeCode v1.6.3 (newtab.js:
   renderNotesView, notesCardsHTML, noteCardHTML, noteRowHTML, armNoteCards,
   armNoteRows, notePopover). El editor ('note') y la vista completa
   ('noteFull') viven en Modals.tsx; aquí solo se abren con openModal. */
"use client";
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import * as T from "@/lib/tc";
import { useTC } from "@/lib/tc-store";
import { useApp } from "./tc-ui";

export function NotesView() {
  const app = useApp();
  const { ui, setUi } = app;
  const counts = app.noteCounts();
  const mode = app.getViewMode("notes");
  const list = app.visibleNotes();
  const [pop, setPop] = useState<{ id: string; rect: DOMRect } | null>(null);

  const tabs: [string, string, number][] = [
    ["all", "Notas", counts.all],
    ["archived", "Archivadas", counts.archived],
    ["trash", "Papelera", counts.trash],
  ];

  return (
    <>
      <div id="viewTitle">
        <span className="pg-ico">📝</span>
        <span>Notas</span>
      </div>
      <div id="viewMeta">
        <div className="pg-sub">Notas enriquecidas con adjuntos</div>
        <div className="pg-subline">{counts.all + counts.archived} nota(s) · Arrastra para reordenar</div>
      </div>
      <div id="viewActions"></div>
      <div id="notesToolbar">
        <div className="nt-tabs">
          {tabs.map((t) => (
            <button
              key={t[0]}
              className={"nt-tab" + (ui.notesTab === t[0] ? " active" : "")}
              data-tab={t[0]}
              onClick={() => setUi({ notesTab: t[0] as "all" | "archived" | "trash" })}
            >
              {t[1]} ({t[2]})
            </button>
          ))}
        </div>
        <NotesSearch />
        <ViewToolbar />
        <button className="btn blue" id="ntNew" onClick={() => app.openModal("note", {})}>
          + Nueva nota
        </button>
      </div>
      <div id="cards">
        <div id="notesGridWrap">
          <NotesGrid list={list} mode={mode} onOpts={(id, anchor) =>
            setPop({ id, rect: anchor.getBoundingClientRect() })
          } />
        </div>
      </div>
      <div id="emptyState" className="hidden"></div>
      {pop && (
        <NotePopover
          noteId={pop.id}
          rect={pop.rect}
          notes={list}
          onClose={() => setPop(null)}
        />
      )}
    </>
  );
}

/* Buscador de notas con debounce (no pierde el foco al re-renderizar) */
function NotesSearch() {
  const { ui, setUi } = useApp();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div className="nt-search">
      <span>🔎</span>
      <input
        id="ntQuery"
        type="text"
        placeholder="Buscar en notas…"
        defaultValue={ui.notesQuery}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setUi({ notesQuery: v }), 250);
        }}
      />
    </div>
  );
}

/* Barra de vistas + zoom (viewToolbarHTML / wireViewToolbar literales) */
function ViewToolbar() {
  const { getViewMode, setViewMode, getZoom, setZoom } = useApp();
  const cur = getViewMode("notes");
  return (
    <div className="vt-wrap">
      <div className="vt-seg" role="group" aria-label="Modo de vista">
        {T.VIEW_MODES.map((m) => (
          <button
            key={m[0]}
            className={"vt-btn" + (cur === m[0] ? " active" : "")}
            data-vm={m[0]}
            title={m[2]}
            onClick={() => setViewMode("notes", m[0])}
          >
            <span className="vt-ico">{m[1]}</span>
            <span className="vt-lbl">{m[2]}</span>
          </button>
        ))}
      </div>
      <div className="vt-zoom">
        <button className="vt-zbtn" data-zoom="out" title="Reducir tamaño" onClick={() => setZoom(-0.1)}>
          −
        </button>
        <span className="vt-zv">{Math.round(getZoom() * 100)}%</span>
        <button className="vt-zbtn" data-zoom="in" title="Aumentar tamaño" onClick={() => setZoom(0.1)}>
          +
        </button>
      </div>
    </div>
  );
}

function NotesGrid({
  list, mode, onOpts,
}: {
  list: T.NoteT[]; mode: string;
  onOpts: (id: string, anchor: HTMLElement) => void;
}) {
  const { ui } = useApp();
  const dragRef = useRef<string | null>(null);
  if (!list.length) {
    return (
      <div className="notes-empty">
        {ui.notesTab === "trash" ? "🗑" : ui.notesTab === "archived" ? "📦" : "📝"}
        <p>
          {ui.notesTab === "trash"
            ? "La papelera está vacía."
            : ui.notesTab === "archived"
              ? "No hay notas archivadas."
              : "No tienes notas. Pulsa «+ Nueva nota» para crear la primera."}
        </p>
      </div>
    );
  }
  if (mode === "list") {
    return (
      <div className="view-list zoomable">
        {list.map((n) => (
          <NoteRow key={n.id} n={n} />
        ))}
      </div>
    );
  }
  const wrapCls = mode === "board" ? "view-board zoomable" : "notes-grid";
  return (
    <>
      <div className="notes-hint">
        Arrastra una tarjeta para reordenarla · ⛶ abre la vista completa · ⋯ abre el panel de opciones
      </div>
      <div className={wrapCls}>
        {list.map((n) => (
          <NoteCard key={n.id} n={n} onOpts={onOpts} dragRef={dragRef} />
        ))}
        {mode === "grid" && <NotesEndzone />}
      </div>
    </>
  );
}

/* Tarjeta de nota (noteCardHTML + armNoteCards literales) */
function NoteCard({ n, onOpts, dragRef }: { n: T.NoteT; onOpts: (id: string, anchor: HTMLElement) => void; dragRef: React.MutableRefObject<string | null> }) {
  const tc = useTC();
  const { openModal } = useApp();
  const preview = T.stripTags(n.html || "").replace(/\s+/g, " ").trim().slice(0, 140);
  const atts = (n.attachments || []).length;

  return (
    <div className="card-wrap note-wrap">
    <div
      className="note-card rich"
      draggable={true}
      data-id={n.id}
      style={{ background: n.color || "#fef3c7" }}
      onClick={() => openModal("note", { id: n.id })}
      onDragStart={(e) => {
        dragRef.current = n.id;
        e.dataTransfer.setData(T.DT_NOTE, n.id);
        e.dataTransfer.setData("text/plain", "note:" + n.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove("dragging");
        dragRef.current = null;
      }}
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_NOTE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragRef.current || dragRef.current === n.id) return;
        e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={async (e) => {
        if (!T.hasDT(e, T.DT_NOTE)) return;
        e.preventDefault();
        e.currentTarget.classList.remove("drop-before");
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d === n.id) return;
        await tc.reorderNotes(d, n.id);
      }}
    >
      {n.pinned && (
        <span className="n-pin" title="Nota fijada">📌</span>
      )}
      {n.readLater && (
        <span className="n-rl" title="Marcada para leer después">🔖</span>
      )}
      <div className="n-title">{n.title || "Sin título"}</div>
      {preview && <div className="n-preview">{preview}</div>}
      {atts > 0 && (
        <div className="n-atts">📎 {atts} adjunto(s)</div>
      )}
      <span className="n-date">{T.fmtDateTime(n.updatedAt)}</span>
    </div>
    <button
      className="n-full"
      data-act="full"
      title="Pantalla completa"
      onClick={(e) => {
        e.stopPropagation();
        openModal("noteFull", { id: n.id });
      }}
    >
      ⛶
    </button>
    <button
      className="n-opts"
      data-act="opts"
      title="Opciones de la nota"
      onClick={(e) => {
        e.stopPropagation();
        onOpts(n.id, e.currentTarget);
      }}
    >
      ⋯
    </button>
    </div>
  );
}

/* Fila de nota en modo Lista (noteRowHTML + armNoteRows literales) */
function NoteRow({ n }: { n: T.NoteT }) {
  const { openModal } = useApp();
  const preview = T.stripTags(n.html || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const atts = (n.attachments || []).length;
  return (
    <div className="vrow note-row" data-id={n.id} onClick={() => openModal("note", { id: n.id })}>
      <span className="vrow-ic">📝</span>
      <div className="vrow-body">
        <div className="vrow-title">{n.title || "Sin título"}</div>
        {preview && <div className="vrow-sub">{preview}</div>}
      </div>
      {atts > 0 && <span className="vrow-meta">📎 {atts}</span>}
      <span className="vrow-meta">{T.fmtDateTime(n.updatedAt)}</span>
      <div className="vrow-actions">
        <button
          className="icon-btn"
          data-act="full"
          title="Pantalla completa"
          onClick={(e) => {
            e.stopPropagation();
            openModal("noteFull", { id: n.id });
          }}
        >
          ⛶
        </button>
      </div>
    </div>
  );
}

/* Zona al final de la cuadrícula: soltar aquí mueve la nota a la última posición.
   El arrastre se origina en las tarjetas (text/plain "note:<id>"); aquí se lee
   del dataTransfer porque el ref de origen no es visible desde la zona. */
function NotesEndzone() {
  const tc = useTC();
  return (
    <div
      className="notes-endzone"
      title="Arrastra aquí para mover la nota al final"
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_NOTE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={async (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drop-before");
        const m = /^note:(.+)$/.exec(e.dataTransfer.getData("text/plain") || "");
        if (!m) return;
        await tc.moveNoteToEnd(m[1]);
      }}
    />
  );
}

/* Panel de opciones de la nota ⋯ (notePopover literal) */
export function NotePopover({
  noteId, rect, notes, onClose,
}: {
  noteId: string; rect: DOMRect; notes: T.NoteT[]; onClose: () => void;
}) {
  const tc = useTC();
  const { openModal } = useApp();
  const popRef = useRef<HTMLDivElement>(null);
  const n = notes.find((x) => x.id === noteId);

  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el) return;
    el.style.top = Math.min(window.innerHeight - el.offsetHeight - 12, rect.bottom + 6) + "px";
    el.style.left = Math.max(8, Math.min(window.innerWidth - 250, rect.right - 230)) + "px";
  }, [rect]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", outside);
      document.addEventListener("keydown", esc);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  if (!n) return null;
  const inTrash = !!n.deletedAt;

  const pickColor = () =>
    openModal("colorPick", {
      current: n.color || "#fff7c4",
      onPick: async (hex: string) => {
        await tc.saveNote({ ...n, color: hex, updatedAt: Date.now() });
      },
    });

  const item = (label: string, act: string, danger?: boolean) => (
    <button key={act} className={"np-item" + (danger ? " danger" : "")} data-a={act}
      onClick={async () => {
        onClose();
        if (act === "edit") openModal("note", { id: noteId });
        else if (act === "full") openModal("noteFull", { id: noteId });
        else if (act === "pin") await tc.toggleNotePin(noteId);
        else if (act === "archive") {
          await tc.saveNote({ ...n, archived: !n.archived, updatedAt: Date.now() });
          tc.toast(n.archived ? "Nota desarchivada" : "Nota archivada");
        }
        else if (act === "readlater") {
          await tc.toggleNoteReadLater(noteId);
          tc.toast(n.readLater ? "Quitado de «Haciendo»" : "Añadido a «Haciendo»");
        }
        else if (act === "trash") {
          if (!confirm("¿Enviar esta nota a la papelera?")) return;
          await tc.trashNote(noteId);
          await tc.logActivity("delete", "Enviaste una nota a la papelera", n.title || "Sin título");
          tc.toast("Nota enviada a la papelera");
        }
        else if (act === "restore") {
          await tc.restoreNote(noteId);
          tc.toast("Nota restaurada");
        }
      }}>
      {label}
    </button>
  );

  return (
    <div className="note-pop" id="notePop" ref={popRef}>
      <div className="np-title">{n.title || "Nota"}</div>
      <div className="np-label">🎨 STYLE</div>
      <button className="np-colorbtn" id="npColor" title="Cambiar color (paleta o personalizado)" onClick={pickColor}>
        <span className="np-cdot" style={{ background: n.color || "#fff7c4" }}></span>
        <span>Color…</span>
      </button>
      <div className="np-sep"></div>
      {inTrash
        ? item("↩️ Restaurar", "restore")
        : (
          <>
            {item("✏️ Editar", "edit")}
            {item("⛶ Pantalla completa", "full")}
            {item(n.pinned ? "📍 Desfijar" : "📌 Fijar", "pin")}
            {item(n.archived ? "📤 Desarchivar" : "📦 Archivar", "archive")}
            {item(n.readLater ? "🔖 Quitar de «Haciendo»" : "🔖 Haciendo", "readlater")}
            {item("🗑 Enviar a papelera", "trash", true)}
          </>
        )}
    </div>
  );
}
