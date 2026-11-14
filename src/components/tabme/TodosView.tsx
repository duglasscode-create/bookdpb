"use client";
/* ============================================================
   BookDPB — Tareas de Mis Items (v2.6.0)
   La lista del día calcada del borrador que Duglass aprobó
   (referencia: «ToDo – Keep It Simple»): tareas con categorías
   propias (color + Emoji/Iconos UI/Imagen, como las demás
   categorías), al marcar una hecha baja sola a «🔥 Completadas»
   de hoy; las pendientes de días anteriores siguen en la lista.
   Drag & drop: reordenar categorías y tareas, y soltar una tarea
   sobre una categoría para moverla.
   ============================================================ */
import React, { useRef, useState } from "react";
import * as T from "@/lib/tc";
import { useTC } from "@/lib/tc-store";
import { useApp } from "./tc-ui";
import { YtIconEl } from "./YoutubeViews";

type DragState = { type: string; id: string } | null;

export function TodosView() {
  const tc = useTC();
  const { goHome, goItem, liveTodoCats, liveTodoTasks, openModal } = useApp();
  const dragRef = useRef<DragState>(null);
  const [filterCat, setFilterCat] = useState<string>("__all");

  const cats = liveTodoCats();
  const tasks = liveTodoTasks().slice().sort(T.byOrder);
  const todayK = T.localDStr(new Date());
  const pending = tasks.filter((t) => !t.done);
  const doneToday = tasks.filter((t) => t.done && t.doneDay === todayK);
  const fecha = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const catById = (id: string | null) => (id ? cats.find((c) => c.id === id) || null : null);
  const vis = (t: T.TodoTask) =>
    filterCat === "__all" || (filterCat === "__none" ? !t.catId : t.catId === filterCat);

  const delTask = async (t: T.TodoTask) => {
    if (!confirm("¿Enviar a la papelera la tarea «" + t.title + "»? Podrás recuperarla desde MIS ITEMS → Papelera durante 30 días.")) return;
    await tc.deleteTodoTask(t.id);
    tc.toast("Tarea enviada a la papelera");
  };

  const chipDropProps = (catId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (T.hasDT(e, T.DT_TODOTASK) || T.hasDT(e, T.DT_TODOCAT)) { e.preventDefault(); e.currentTarget.classList.add("drop-ok"); }
    },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove("drop-ok"),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      e.currentTarget.classList.remove("drop-ok");
      const ds = dragRef.current;
      if (!ds) return;
      if (ds.type === T.DT_TODOTASK) {
        const t = tasks.find((x) => x.id === ds.id);
        if (t && t.catId !== catId) { void tc.saveTodoTask({ ...t, catId }); tc.toast("Tarea movida de categoría"); }
      } else if (ds.type === T.DT_TODOCAT && ds.id !== catId) {
        void tc.reorderTodoCats(ds.id, catId);
      }
      dragRef.current = null;
    },
  });

  const row = (t: T.TodoTask) => {
    const c = catById(t.catId);
    return (
      <div key={t.id} className={"tk-row" + (t.done ? " done" : "")} draggable
        style={{ borderLeftColor: c ? c.color : "var(--muted)" }}
        onDragStart={(e) => {
          dragRef.current = { type: T.DT_TODOTASK, id: t.id };
          e.dataTransfer.setData(T.DT_TODOTASK, t.id);
          e.dataTransfer.effectAllowed = "move";
          e.currentTarget.classList.add("dragging");
        }}
        onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); dragRef.current = null; }}
        onDragOver={(e) => {
          if (!T.hasDT(e, T.DT_TODOTASK)) return;
          e.preventDefault();
          const ds = dragRef.current;
          if (ds && ds.id !== t.id) e.currentTarget.classList.add("drop-before");
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
        onDrop={(e) => {
          if (!T.hasDT(e, T.DT_TODOTASK)) return;
          e.preventDefault(); e.stopPropagation();
          e.currentTarget.classList.remove("drop-before");
          void tc.reorderTodoTasks(e.dataTransfer.getData(T.DT_TODOTASK), t.id);
        }}>
        <span className="tk-grip" title="Arrastra para reordenar">⠿</span>
        <input type="checkbox" className="tk-check" checked={t.done}
          title={t.done ? "Desmarcar: vuelve a pendientes" : "Marcar hecha: baja a Completadas"}
          onChange={() => void tc.toggleTodoTask(t.id)} />
        <button className="tk-title" title="Editar tarea" onClick={() => openModal("todo", { id: t.id })}>{t.title}</button>
        {c ? (
          <span className="tk-cat" title={"Categoría: " + c.name}>
            <span className="tk-cic" style={{ background: c.color }}>
              {c.icon ? <YtIconEl icon={c.icon} iconType={c.iconType} size={11} /> : "📌"}
            </span>
            {c.name}
          </span>
        ) : null}
        <button className="icon-btn" title="Editar tarea" onClick={() => openModal("todo", { id: t.id })}>✎</button>
        <button className="icon-btn" title="Enviar a la papelera" onClick={() => void delTask(t)}>🗑️</button>
      </div>
    );
  };

  const visPend = pending.filter(vis);
  const visDone = doneToday.filter(vis);

  return (
    <>
      <h2 id="viewTitle">
        <button className="crumb" title="Volver a Home" onClick={goHome}>🏠 Home</button>
        <span className="crumb-sep">/</span>
        <button className="crumb" title="Volver a Mis Items" onClick={() => goItem("misitems")}>📗 Mis Items</button>
        <span className="crumb-sep">/</span>
        <span>✅ Tareas</span>
      </h2>
      <div id="viewMeta" className="view-meta">
        <div className="pg-subline">
          {"Tareas de hoy · " + fecha + " · " + pending.length + " pendiente(s) · " + doneToday.length + " hecha(s) hoy"}
        </div>
      </div>
      <div id="viewActions" className="view-actions">
        <div className="vt-wrap">
          <button className="btn primary" onClick={() => openModal("todo", {})}>＋ Nueva tarea</button>
          <button className="btn" onClick={() => openModal("todocat", {})}>＋ Nueva categoría</button>
        </div>
      </div>

      <div className="tk-strip">
        <span className={"tk-chip" + (filterCat === "__all" ? " sel" : "")}
          onClick={() => setFilterCat("__all")}>
          <span className="tk-cic" style={{ background: "var(--muted)" }}>🗂️</span>
          Todas
          <span className="tk-cc">{pending.length}</span>
        </span>
        {cats.map((c) => (
          <span key={c.id} className={"tk-chip" + (filterCat === c.id ? " sel" : "")} draggable
            onClick={() => setFilterCat(c.id)}
            onDragStart={(e) => {
              dragRef.current = { type: T.DT_TODOCAT, id: c.id };
              e.dataTransfer.setData(T.DT_TODOCAT, c.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => { dragRef.current = null; }}
            {...chipDropProps(c.id)}>
            <span className="tk-cic" style={{ background: c.color }}>
              {c.icon ? <YtIconEl icon={c.icon} iconType={c.iconType} size={14} /> : "📌"}
            </span>
            {c.name}
            <span className="tk-cc">{pending.filter((t) => t.catId === c.id).length}</span>
            <button className="tk-cedit" title="Editar categoría"
              onClick={(e) => { e.stopPropagation(); openModal("todocat", { id: c.id }); }}>✎</button>
          </span>
        ))}
        {tasks.some((t) => !t.catId) ? (
          <span className={"tk-chip" + (filterCat === "__none" ? " sel" : "")}
            onClick={() => setFilterCat("__none")}>
            <span className="tk-cic" style={{ background: "var(--muted)" }}>▫️</span>
            Sin categoría
            <span className="tk-cc">{pending.filter((t) => !t.catId).length}</span>
          </span>
        ) : null}
      </div>

      <div className="tk-sec">✅ Tasks</div>
      <div className="tk-list">
        {visPend.length ? visPend.map(row) : (
          <div className="tk-empty">Sin tareas pendientes aquí. Pulsa «＋ Nueva tarea» para crear la primera.</div>
        )}
      </div>

      <div className="tk-sec">🔥 Completed Tasks</div>
      <div className="tk-list">
        {visDone.length ? visDone.map(row) : (
          <div className="tk-empty">Todavía nada completado hoy. Al marcar una tarea, baja aquí sola.</div>
        )}
      </div>

      <p className="hab-foot">
        Arrastra las categorías para reordenarlas y las tareas para reordenarlas; suelta una tarea sobre una categoría para cambiarla de categoría.
        Las pendientes de días anteriores siguen en la lista hasta que las hagas; en Completadas se ven las que marcas hoy.
      </p>
    </>
  );
}
