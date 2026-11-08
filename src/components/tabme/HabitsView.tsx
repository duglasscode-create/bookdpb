/* BookDPB — HabitsView.tsx (v2.5.0)
   Bloque «Hábitos»: la rutina diaria de Duglass. Rejilla de 14 días
   (tocar un círculo marca/desmarca ese día, también días pasados),
   racha 🔥 y total 🏆 por hábito, tiempo registrado por día
   (cronómetro por hora real — v2.5.1 ya no se pausa al cambiar de
   pestaña — o tiempo de vídeo de la categoría de listas vinculada), estadísticas por periodos y archivados.
   Mismo lenguaje visual que el resto de BookDPB y drag & drop para
   reordenar las filas. */
"use client";
import React, { useEffect, useReducer, useRef, useState } from "react";
import * as T from "@/lib/tc";
import { useTC } from "@/lib/tc-store";
import { useApp } from "./tc-ui";
import { YtIconEl } from "./YoutubeViews";

type DragState = { type: string; id: string } | null;

/* ---------- cálculos sobre el registro de días ---------- */

export function habEntry(days: T.HabitDay[], habitId: string, day: string): T.HabitDay | undefined {
  return days.find((r) => r.habitId === habitId && r.day === day);
}
export function habTotal(days: T.HabitDay[], habitId: string): number {
  return days.filter((r) => r.habitId === habitId && r.done).length;
}
export function habStreak(days: T.HabitDay[], habitId: string): number {
  const done = new Set(days.filter((r) => r.habitId === habitId && r.done).map((r) => r.day));
  const d = new Date();
  if (!done.has(T.localDStr(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (done.has(T.localDStr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function habBestStreak(days: T.HabitDay[], habitId: string): number {
  const ds = days.filter((r) => r.habitId === habitId && r.done).map((r) => r.day).sort();
  let best = 0, run = 0;
  let prev: Date | null = null;
  for (const k of ds) {
    const cur = new Date(k + "T12:00:00");
    if (prev && Math.round((cur.getTime() - prev.getTime()) / 86400000) === 1) run++;
    else run = 1;
    if (run > best) best = run;
    prev = cur;
  }
  return best;
}

const WD = ["L", "M", "X", "J", "V", "S", "D"];
const fmtClock = (sec: number) => {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(ss).padStart(2, "0");
};

/* ---------- vista ---------- */

export function HabitsView() {
  const tc = useTC();
  const { goHome, goFolder, liveHabits, liveYtListCats, openModal } = useApp();
  const dragRef = useRef<DragState>(null);
  const [off, setOff] = useState(0);
  const [showArch, setShowArch] = useState(false);
  const [timer, setTimer] = useState<{ id: string; start: number } | null>(null);
  const [, tick] = useReducer((x: number) => x + 1, 0);

  const days = tc.db.habitDays || [];
  const habits = liveHabits().filter((h) => !h.archived).sort(T.byOrder);
  const archived = liveHabits().filter((h) => h.archived).sort(T.byOrder);
  const listCats = liveYtListCats();
  const todayK = T.localDStr(new Date());
  const doneToday = habits.filter((h) => { const e = habEntry(days, h.id, todayK); return e && e.done; }).length;

  /* ventana de 14 días que termina hoy, HOY PRIMERO y de ahí hacia
     atrás (v2.5.1, como pidió Duglass; off = ventanas hacia atrás) */
  const end = new Date(); end.setDate(end.getDate() - off);
  const win: Date[] = [];
  for (let i = 0; i < 14; i++) { const d = new Date(end); d.setDate(d.getDate() - i); win.push(d); }
  const winLabel = win[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" }) +
    " – " + win[13].toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  /* cronómetro (v2.5.1): repintar cada segundo; el tiempo se calcula
     por hora real desde el arranque — NO se pausa al cambiar de
     pestaña ni de web, mientras la pestaña de BookDPB siga abierta */
  useEffect(() => {
    if (!timer) return;
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [timer]);
  const elapsedOf = (t: NonNullable<typeof timer>) => Math.max(0, Math.floor(
    (Date.now() - t.start) / 1000));

  const stopTimer = async (save: boolean) => {
    if (!timer) return;
    const t = timer;
    setTimer(null);
    const secs = elapsedOf(t);
    const h = (tc.db.habits || []).find((x) => x.id === t.id);
    if (!h) return;
    if (save && secs >= 60) {
      await tc.addHabitTime(h.id, secs);
      tc.toast("⏱ " + T.fmtInvested(secs) + " sumados a «" + h.name + "»");
    } else if (save) {
      tc.toast("Sesión muy corta (menos de 1 min): no se suma");
    }
  };
  const toggleTimer = (h: T.Habit) => {
    if (timer && timer.id === h.id) { void stopTimer(true); return; }
    if (timer) void stopTimer(true);
    setTimer({ id: h.id, start: Date.now() });
  };

  const toggleDay = (h: T.Habit, key: string) => {
    const e = habEntry(days, h.id, key);
    void tc.setHabitDay(h.id, key, { done: !(e && e.done) });
  };

  return (
    <>
      <h2 id="viewTitle">
        <button className="crumb" title="Volver a Home" onClick={goHome}>🏠 Home</button>
        <span className="crumb-sep">/</span>
        <span>🌱 Hábitos</span>
      </h2>
      <div id="viewMeta" className="view-meta">
        <div className="pg-subline">
          {"Hoy llevas " + doneToday + " de " + habits.length + " · Toca un círculo para marcar el día · El tiempo suma con el cronómetro o viendo vídeos de la categoría vinculada"}
        </div>
      </div>
      <div id="viewActions" className="view-actions">
        <div className="vt-wrap">
          <button className="btn" onClick={() => setShowArch(!showArch)}>
            {showArch ? "← Volver a mis hábitos" : "🗄️ Archivados (" + archived.length + ")"}
          </button>
          <button className="btn primary" onClick={() => openModal("habit", {})}>＋ Nuevo hábito</button>
        </div>
      </div>

      {showArch ? (
        archived.length ? (
          <div className="view-list zoomable">
            {archived.map((h) => (
              <div key={h.id} className="yt-catrow hab-archrow">
                <span className="yt-catrow-ico" style={{ background: h.color }}>
                  {h.icon ? <YtIconEl icon={h.icon} iconType={h.iconType} size={18} /> : <span style={{ fontSize: 15 }}>🌱</span>}
                </span>
                <span className="yt-catrow-name">{h.name}</span>
                <span className="yt-catrow-meta">🏆 {habTotal(days, h.id)} día(s) en total</span>
                <button className="btn sm" onClick={() => tc.saveHabit({ ...h, archived: false }).then(() => tc.toast("Hábito restaurado"))}>↩ Restaurar</button>
              </div>
            ))}
          </div>
        ) : (
          <div id="emptyState" className="empty">
            <span className="big">🗄️</span>
            <p>No tienes hábitos archivados.</p>
            <p>Archiva un hábito desde su botón ✎ cuando quieras pausarlo sin borrar su historial.</p>
          </div>
        )
      ) : !habits.length ? (
        <div id="emptyState" className="empty">
          <span className="big">🌱</span>
          <p>Todavía no tienes hábitos.</p>
          <p>Crea el primero con «＋ Nuevo hábito»: tu letón diario, tu curso, lo que quieras seguir cada día.</p>
        </div>
      ) : (
        <>
          <div className="hab-nav">
            <button className="vt-zbtn" title="14 días antes" onClick={() => setOff(off + 14)}>‹</button>
            <span className="hab-winlabel">{winLabel}</span>
            <button className="vt-zbtn" title="14 días después" disabled={off === 0} onClick={() => setOff(Math.max(0, off - 14))}>›</button>
            {off !== 0 ? <button className="btn sm" onClick={() => setOff(0)}>Hoy</button> : null}
          </div>
          <div className="hab-head">
            <span className="hab-hname"></span>
            <span className="hab-hstats"></span>
            <span className="hab-days hab-days-head">
              {win.map((d, i) => (
                <span key={i} className={"hab-dh" + (T.localDStr(d) === todayK ? " today" : "")}>
                  {WD[(d.getDay() + 6) % 7]}<small>{d.getDate()}</small>
                </span>
              ))}
            </span>
            <span className="hab-hacts"></span>
          </div>
          <div className="hab-rows">
            {habits.map((h) => {
              const total = habTotal(days, h.id);
              const streak = habStreak(days, h.id);
              const todayE = habEntry(days, h.id, todayK);
              const linked = h.ytLinkCat ? listCats.find((c) => c.id === h.ytLinkCat) : null;
              const linkedFolder = h.folderId ? (tc.db.folders || []).find((f) => f.id === h.folderId && !f.deletedAt) : null;
              const running = !!timer && timer.id === h.id;
              return (
                <div key={h.id} className={"hab-row" + (running ? " running" : "")} draggable
                  data-id={h.id}
                  onDragStart={(e) => {
                    dragRef.current = { type: T.DT_HABIT, id: h.id };
                    e.dataTransfer.setData(T.DT_HABIT, h.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.currentTarget.classList.add("dragging");
                  }}
                  onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); dragRef.current = null; }}
                  onDragOver={(e) => {
                    if (!T.hasDT(e, T.DT_HABIT)) return;
                    e.preventDefault();
                    const ds = dragRef.current;
                    if (ds && ds.id !== h.id) e.currentTarget.classList.add("drop-before");
                  }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
                  onDrop={(e) => {
                    if (!T.hasDT(e, T.DT_HABIT)) return;
                    e.preventDefault(); e.stopPropagation();
                    e.currentTarget.classList.remove("drop-before");
                    void tc.reorderHabits(e.dataTransfer.getData(T.DT_HABIT), h.id);
                  }}>
                  <span className="hab-grip" title="Arrastra para reordenar">⠿</span>
                  <span className="hab-ico" style={{ background: h.color }}>
                    {h.icon ? <YtIconEl icon={h.icon} iconType={h.iconType} size={20} /> : <span style={{ fontSize: 17 }}>🌱</span>}
                  </span>
                  <div className="hab-name-wrap">
                    <button className="hab-name" title="Ver estadísticas" onClick={() => openModal("habitstats", { id: h.id })}>
                      {h.name}
                    </button>
                    <span className="hab-sub">
                      {"🏆 " + total + " · 🔥 " + streak}
                      {todayE && todayE.seconds ? " · ⏱ hoy " + T.fmtInvested(todayE.seconds) : ""}
                      {linked ? " · 🔗 " + linked.name : ""}
                      {linkedFolder ? <> · <button className="hab-linkchip" title="Abrir su carpeta de recursos vinculada" onClick={() => goFolder(linkedFolder.id)}>📁 {linkedFolder.name}</button></> : null}
                    </span>
                  </div>
                  <span className="hab-days">
                    {win.map((d, i) => {
                      const key = T.localDStr(d);
                      const e2 = habEntry(days, h.id, key);
                      const isToday = key === todayK;
                      return (
                        <button key={i}
                          className={"hab-day" + (e2 && e2.done ? " done" : "") + (isToday ? " today" : "")}
                          style={e2 && e2.done ? { background: h.color, borderColor: h.color } : undefined}
                          title={d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) +
                            (e2 && e2.seconds ? " · " + T.fmtInvested(e2.seconds) : "")}
                          onClick={() => toggleDay(h, key)}>
                          {e2 && e2.done ? "✓" : ""}
                        </button>
                      );
                    })}
                  </span>
                  <span className="hab-acts">
                    {running ? <span className="hab-clock">{fmtClock(elapsedOf(timer))}</span> : null}
                    <button className={"icon-btn hab-timer" + (running ? " on" : "")}
                      title={running ? "Detener y sumar el tiempo" : "Cronómetro: cuenta por hora real — sigue aunque cambies de pestaña o de web"}
                      onClick={() => toggleTimer(h)}>{running ? "⏹" : "▶"}</button>
                    <button className="icon-btn" title="Editar hábito"
                      onClick={() => openModal("habit", { id: h.id })}>✎</button>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="hab-foot">
            El cronómetro ▶ cuenta por hora real: sigue sumando aunque cambias de pestaña o de web, mientras la pestaña de BookDPB siga abierta en el navegador.
            Si un hábito está vinculado a una categoría de listas, el tiempo de sus vídeos también suma y marca el día al llegar a 1 minuto.
          </p>
        </>
      )}
    </>
  );
}
