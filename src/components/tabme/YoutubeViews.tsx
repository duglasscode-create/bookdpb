/* BookDPB — YoutubeViews.tsx (v2.3.8)
   Vistas del bloque «Youtube Manager»: Listas, detalle de lista,
   Suscripciones (canales por categorías) y Completadas.
   Mismo lenguaje visual que el resto de BookDPB (tarjetas, crumbs,
   barra Cuadrícula/Lista/Tablero + zoom) y drag & drop en todo:
   sidebar, listas, sublistas, videos, tablero y canales. */
"use client";
import React, { useEffect, useRef, useState } from "react";
import * as T from "@/lib/tc";
import { useTC } from "@/lib/tc-store";
import { useApp, useDnD } from "./tc-ui";

type DragState = { type: string; id: string } | null;
const DT_YTCAT = "application/x-tbc-ytcatrow";

/* ---------- utilidades ---------- */

export function ytStatus(v: T.YtVideo): "none" | "part" | "done" {
  if (v.watched) return "done";
  if ((v.progressSec || 0) > 0) return "part";
  return "none";
}
export function ytListStats(videos: T.YtVideo[]) {
  const seen = new Set<string>();
  let invested = 0;
  videos.forEach((v) => { if (!seen.has(v.youtubeId)) { seen.add(v.youtubeId); invested += v.secondsWatched || 0; } });
  const sumPct = videos.reduce((a, v) => {
    if (v.watched) return a + 100;
    if (v.durationSec) return a + Math.min(100, Math.round(((v.progressSec || 0) / v.durationSec) * 100));
    return a;
  }, 0);
  return {
    total: videos.length,
    watched: videos.filter((v) => v.watched).length,
    invested,
    pct: videos.length ? Math.round(sumPct / videos.length) : 0,
  };
}
export function ytListDone(l: T.YtList, videos: T.YtVideo[]): boolean {
  const vs = videos.filter((v) => v.listId === l.id);
  return vs.length > 0 && vs.every((v) => v.watched);
}

export function YtIconEl({ icon, iconType, size }: { icon: string; iconType: string; size?: number }) {
  const s = size || 18;
  if (iconType === "img" && icon) {
    return <img src={icon} alt="" style={{ width: s, height: s, borderRadius: 5, objectFit: "cover", verticalAlign: "-3px" }} />;
  }
  return <span style={{ fontSize: s - 2 }}>{icon || "🎬"}</span>;
}

/* Cabecera de página equivalente a PageHead de Views (mismas clases CSS) */
function YtHead({ titleNode, subline, vkey, primary, hideModes }:
  { titleNode: React.ReactNode; subline?: string; vkey: string; primary?: React.ReactNode; hideModes?: boolean }) {
  const { getViewMode, setViewMode, getZoom, setZoom } = useApp();
  const cur = getViewMode(vkey);
  return (
    <>
      <h2 id="viewTitle">{titleNode}</h2>
      <div id="viewMeta" className="view-meta">
        {subline ? <div className="pg-subline">{subline}</div> : null}
      </div>
      <div id="viewActions" className="view-actions">
        {hideModes ? (
          <div className="vt-wrap">{primary}</div>
        ) : (
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
          {primary}
        </div>
        )}
      </div>
    </>
  );
}

function YtEmpty({ icon, lines }: { icon: string; lines: string[] }) {
  return (
    <div id="emptyState" className="empty">
      <span className="big">{icon}</span>
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  );
}

function YtCrumbs({ trail }: { trail: { label: React.ReactNode; go?: () => void }[] }) {
  const { goHome, goYt } = useApp();
  return (
    <>
      <button className="crumb" title="Volver a Home" onClick={goHome}>🏠 Home</button>
      <span className="crumb-sep">/</span>
      <button className="crumb" onClick={() => goYt("ytlists")}><T.YtLogo size={15} /> Youtube Manager</button>
      {trail.map((t, i) => (
        <React.Fragment key={i}>
          <span className="crumb-sep">/</span>
          {t.go
            ? <button className="crumb" onClick={t.go}>{t.label}</button>
            : <span>{t.label}</span>}
        </React.Fragment>
      ))}
    </>
  );
}

/* La foto real del canal (avatar) en círculo, como en la extensión
   Youtube Playlist. Si aún no hay foto: el favicon del dominio y, en
   último término, la inicial del canal. */
export function YtChannelAvatar({ ch, favSize }: { ch: T.YtChannel; favSize?: number }) {
  const fav = ch.url ? T.faviconFor(ch.url) : "";
  if (ch.avatarUrl) return <img className="yt-avatar-img" src={ch.avatarUrl} alt="" loading="lazy" />;
  if (fav) return <img src={fav} alt="" style={{ width: favSize || 26, height: favSize || 26 }} />;
  return <>{(ch.name || "?").charAt(0).toUpperCase()}</>;
}

/* ---------- botón de visto (marcar / desmarcar) ---------- */

function YtSeenBtn({ v, big }: { v: T.YtVideo; big?: boolean }) {
  const tc = useTC();
  const st = ytStatus(v);
  const label = st === "done" ? "✓" : st === "part" ? "◐" : "○";
  const title = st === "done" ? "Visto — clic para desmarcar" : "Marcar como visto";
  return (
    <button className={"yt-seen " + st + (big ? " big" : "")} title={title}
      onClick={(e) => {
        e.stopPropagation();
        tc.setYtWatched(v.youtubeId, st !== "done");
        tc.toast(st === "done" ? "Desmarcado como visto" : "Marcado como visto ✓");
      }}>{label}</button>
  );
}

/* ---------- tarjeta de lista ---------- */

function YtListCard({ l, mini, dragRef }: { l: T.YtList; mini?: boolean; dragRef: React.RefObject<DragState> }) {
  const tc = useTC();
  const { goYtList, liveYtLists, liveYtVideos, openModal } = useApp();
  const { clearDropMarks } = useDnD();
  const videos = liveYtVideos().filter((v) => v.listId === l.id);
  const st = ytListStats(videos);
  const subs = liveYtLists().filter((s) => s.parentId === l.id).sort(T.byOrder);
  const done = ytListDone(l, liveYtVideos());
  const coverImg = l.iconType === "img" && l.icon ? l.icon : "";

  const del = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nSub = liveYtLists().filter((s) => s.parentId === l.id).length;
    let msg = "¿Enviar a la papelera la lista «" + l.name + "» con sus " + st.total + " video(s)?";
    if (nSub) msg += " También irán sus " + nSub + " sublista(s) con sus videos.";
    msg += " Podrás recuperarla desde MIS ITEMS → Papelera durante 30 días.";
    if (!confirm(msg)) return;
    await tc.deleteYtList(l.id);
    tc.toast("Lista enviada a la papelera");
  };

  return (
    <div className={"card folder-card yt-lcard" + (mini ? " yt-mini" : "")} draggable data-id={l.id}
      title="Arrastra para reordenar"
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act], .subchip")) return; goYtList(l.id); }}
      onDragStart={(e) => {
        if (dragRef) dragRef.current = { type: T.DT_YTLIST, id: l.id };
        e.dataTransfer.setData(T.DT_YTLIST, l.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); if (dragRef) dragRef.current = null; }}
      onDragOver={(e) => {
        if (T.hasDT(e, T.DT_YTLIST)) {
          e.preventDefault(); e.dataTransfer.dropEffect = "move";
          const ds = dragRef && dragRef.current;
          if (ds && ds.id !== l.id) {
            const dl = tc.db.ytLists.find((x) => x.id === ds.id);
            if (dl && (dl.parentId || null) === (l.parentId || null)) e.currentTarget.classList.add("drop-before");
          }
          return;
        }
        if (T.hasDT(e, T.DT_YTVIDEO)) { e.preventDefault(); e.currentTarget.classList.add("drop-target"); }
      }}
      onDragLeave={(e) => { e.currentTarget.classList.remove("drop-before"); e.currentTarget.classList.remove("drop-target"); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before"); e.currentTarget.classList.remove("drop-target");
        if (T.hasDT(e, T.DT_YTLIST)) {
          const did = e.dataTransfer.getData(T.DT_YTLIST);
          const dl = tc.db.ytLists.find((x) => x.id === did);
          if (dl && (dl.parentId || null) === (l.parentId || null)) tc.reorderYtLists(l.parentId || null, did, l.id);
          return;
        }
        if (T.hasDT(e, T.DT_YTVIDEO)) {
          const vid = e.dataTransfer.getData(T.DT_YTVIDEO);
          const v = tc.db.ytVideos.find((x) => x.id === vid);
          if (v && v.listId !== l.id) tc.moveYtVideoToList(vid, l.id).then(() => tc.toast("Video movido a «" + l.name + "»"));
        }
      }}>
      <div className="band" style={coverImg
        ? { backgroundImage: "url(" + coverImg + ")", backgroundSize: "cover", backgroundPosition: "center" }
        : { background: l.color }}>
        {!coverImg && <YtIconEl icon={l.icon} iconType={l.iconType} size={26} />}
        <span className="yt-band-n">{st.total} videos</span>
      </div>
      <div className="body">
        <div className="fname"><YtIconEl icon={l.icon} iconType={l.iconType} size={17} /> {l.name}</div>
        <div className="fmeta">{st.watched} visto(s) de {st.total}{st.invested ? " · ⏳ " + T.fmtInvested(st.invested) : ""}</div>
        <div className="yt-prog"><i style={{ width: st.pct + "%" }}></i></div>
        <div className="yt-lfoot">
          <span>{st.pct}% completado</span>
          {done ? <span className="yt-done-badge">🏁 Completada</span> : null}
          <span className="yt-lactions">
            <button className="icon-btn" data-act="edit" title="Editar lista"
              onClick={(e) => { e.stopPropagation(); openModal("ytlist", { id: l.id }); }}>✎</button>
            <button className="icon-btn" data-act="del" title="Enviar lista a la papelera" onClick={del}>×</button>
          </span>
        </div>
        {subs.length && !mini ? (
          <div className="subchips">{subs.map((sf) => (
            <button key={sf.id} className="subchip" title={sf.name}
              onClick={(e) => { e.stopPropagation(); goYtList(sf.id); }}
              onDragOver={(e) => { if (T.hasDT(e, T.DT_YTVIDEO)) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("drop-target"); } }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drop-target")}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation();
                e.currentTarget.classList.remove("drop-target");
                if (T.hasDT(e, T.DT_YTVIDEO)) {
                  const vid = e.dataTransfer.getData(T.DT_YTVIDEO);
                  const v = tc.db.ytVideos.find((x) => x.id === vid);
                  if (v && v.listId !== sf.id) tc.moveYtVideoToList(vid, sf.id).then(() => tc.toast("Video movido a «" + sf.name + "»"));
                }
              }}>
              <YtIconEl icon={sf.icon} iconType={sf.iconType} size={12} /><span>{sf.name}</span>
              <b>{liveYtVideos().filter((v) => v.listId === sf.id).length}</b>
            </button>
          ))}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- tarjeta / fila de video ---------- */

function YtVideoCard({ v, dragRef }: { v: T.YtVideo; dragRef: React.RefObject<DragState> }) {
  const tc = useTC();
  const { playYt, ytPlayer } = useApp();
  const { clearDropMarks } = useDnD();
  const st = ytStatus(v);
  const pct = v.durationSec ? Math.min(100, Math.round((v.progressSec / v.durationSec) * 100)) : 0;
  const playing = ytPlayer && ytPlayer.videoId === v.id;
  const del = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Enviar a la papelera el video «" + v.title + "»? Podrás recuperarlo desde MIS ITEMS → Papelera durante 30 días.")) return;
    tc.deleteYtVideo(v.id).then(() => tc.toast("Video enviado a la papelera"));
  };
  return (
    <div className={"card yt-vcard" + (playing ? " playing" : "")} draggable data-id={v.id}
      title="Arrastra para reordenar · Clic para reproducir"
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act], .yt-seen")) return; playYt(v.listId, v.id); }}
      onDragStart={(e) => {
        if (dragRef) dragRef.current = { type: T.DT_YTVIDEO, id: v.id };
        e.dataTransfer.setData(T.DT_YTVIDEO, v.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); if (dragRef) dragRef.current = null; }}
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_YTVIDEO)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "move";
        const ds = dragRef && dragRef.current;
        if (ds && ds.id !== v.id) e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, T.DT_YTVIDEO)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        const did = e.dataTransfer.getData(T.DT_YTVIDEO);
        const dv = tc.db.ytVideos.find((x) => x.id === did);
        if (!dv || dv.id === v.id) return;
        if (dv.listId !== v.listId) { tc.moveYtVideoToList(did, v.listId); return; }
        if (ytStatus(dv) !== ytStatus(v)) tc.setYtWatched(dv.youtubeId, v.watched);
        tc.reorderYtVideos(v.listId, did, v.id);
      }}>
      <div className="yt-thumb">
        <img src={v.thumbnail || T.ytThumb(v.youtubeId)} alt="" loading="lazy" />
        <span className="yt-play">▶</span>
        {v.durationSec ? <span className="yt-dur">{T.fmtDur(v.durationSec)}</span> : null}
        {v.noEmbed ? <span className="yt-noembed-badge" title="Este video no permite inserción">⛔</span> : null}
        <YtSeenBtn v={v} />
        {st === "part" ? <div className="yt-vprog"><i style={{ width: pct + "%" }}></i></div> : null}
      </div>
      <div className="yt-vbody">
        <div className="yt-vtitle" title={v.title}>{v.title}</div>
        <div className="yt-vchan">{v.channelName || "youtube.com"}
          <button className="icon-btn yt-vdel" data-act="del" title="Enviar video a la papelera" onClick={del}>×</button>
        </div>
      </div>
    </div>
  );
}

function YtVideoRow({ v, dragRef }: { v: T.YtVideo; dragRef: React.RefObject<DragState> }) {
  const tc = useTC();
  const { playYt, ytPlayer } = useApp();
  const { clearDropMarks } = useDnD();
  const playing = ytPlayer && ytPlayer.videoId === v.id;
  return (
    <div className={"vrow yt-vrow" + (playing ? " playing" : "")} draggable data-id={v.id}
      title="Arrastra para reordenar · Clic para reproducir"
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act], .yt-seen")) return; playYt(v.listId, v.id); }}
      onDragStart={(e) => {
        if (dragRef) dragRef.current = { type: T.DT_YTVIDEO, id: v.id };
        e.dataTransfer.setData(T.DT_YTVIDEO, v.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); if (dragRef) dragRef.current = null; }}
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_YTVIDEO)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "move";
        const ds = dragRef && dragRef.current;
        if (ds && ds.id !== v.id) e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, T.DT_YTVIDEO)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        const did = e.dataTransfer.getData(T.DT_YTVIDEO);
        const dv = tc.db.ytVideos.find((x) => x.id === did);
        if (dv && dv.listId === v.listId && dv.id !== v.id) tc.reorderYtVideos(v.listId, did, v.id);
      }}>
      <span className="yt-row-thumb"><img src={v.thumbnail || T.ytThumb(v.youtubeId)} alt="" loading="lazy" /></span>
      <div className="vrow-body">
        <div className="vrow-title">{v.title}</div>
        <div className="vrow-sub">{v.channelName || "youtube.com"}{v.noEmbed ? " · ⛔ sin inserción" : ""}</div>
      </div>
      {v.durationSec ? <span className="vrow-meta">{T.fmtDur(v.durationSec)}</span> : null}
      <YtSeenBtn v={v} />
    </div>
  );
}

/* ---------- Vista: Listas ---------- */

export function YtListsView() {
  const tc = useTC();
  const { getViewMode, liveYtLists, liveYtVideos, openModal } = useApp();
  const dragRef = useRef<DragState>(null);
  const mode = getViewMode("ytlists");
  const tops = liveYtLists().filter((l) => !l.parentId).sort(T.byOrder);
  const allVideos = liveYtVideos();
  const g = ytListStats(allVideos);

  const primary = (
    <>
      <button className="btn" onClick={() => openModal("ytimport", {})}>📥 Importar playlist</button>
      <button className="btn primary" onClick={() => openModal("ytlist", { parentId: null })}>＋ Nueva lista</button>
    </>
  );

  let body: React.ReactNode;
  if (!tops.length) {
    body = <YtEmpty icon="🎬" lines={[
      "Todavía no tienes listas de YouTube.",
      "Crea la primera con «＋ Nueva lista», o importa una playlist entera de YouTube.",
    ]} />;
  } else if (mode === "list") {
    body = (
      <div className="view-list zoomable">
        {tops.map((l) => {
          const vs = allVideos.filter((v) => v.listId === l.id);
          const st = ytListStats(vs);
          return <YtListRow key={l.id} l={l} st={st} dragRef={dragRef} />;
        })}
        <div className="reorder-endzone" data-kind="ytlist"
          onDragOver={(e) => { if (T.hasDT(e, T.DT_YTLIST)) { e.preventDefault(); e.currentTarget.classList.add("drop-before"); } }}
          onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
          onDrop={(e) => {
            e.preventDefault(); e.currentTarget.classList.remove("drop-before");
            if (T.hasDT(e, T.DT_YTLIST)) tc.reorderYtLists(null, e.dataTransfer.getData(T.DT_YTLIST), null);
          }} />
      </div>
    );
  } else if (mode === "board") {
    const cols: { key: string; label: string; items: T.YtList[] }[] = [
      { key: "none", label: "Sin empezar", items: [] },
      { key: "part", label: "En curso", items: [] },
      { key: "done", label: "🏁 Completadas", items: [] },
    ];
    tops.forEach((l) => {
      const vs = allVideos.filter((v) => v.listId === l.id);
      if (ytListDone(l, allVideos)) cols[2].items.push(l);
      else if (vs.some((v) => v.watched || v.progressSec > 0)) cols[1].items.push(l);
      else cols[0].items.push(l);
    });
    body = (
      <div className="yt-board">
        {cols.map((c) => (
          <div key={c.key} className="yt-col">
            <h4>{c.label}<span>{c.items.length}</span></h4>
            {c.items.map((l) => <YtListCard key={l.id} l={l} mini dragRef={dragRef} />)}
            {!c.items.length ? <div className="yt-col-empty">Sin listas aquí</div> : null}
          </div>
        ))}
      </div>
    );
  } else {
    body = (
      <div id="cards" className="cards zoomable">
        {tops.map((l) => <YtListCard key={l.id} l={l} dragRef={dragRef} />)}
        <div className="reorder-endzone" data-kind="ytlist"
          onDragOver={(e) => { if (T.hasDT(e, T.DT_YTLIST)) { e.preventDefault(); e.currentTarget.classList.add("drop-before"); } }}
          onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
          onDrop={(e) => {
            e.preventDefault(); e.currentTarget.classList.remove("drop-before");
            if (T.hasDT(e, T.DT_YTLIST)) tc.reorderYtLists(null, e.dataTransfer.getData(T.DT_YTLIST), null);
          }} />
      </div>
    );
  }

  return (
    <>
      <YtHead vkey="ytlists" primary={primary}
        titleNode={<YtCrumbs trail={[{ label: <>🎬 Listas</> }]} />}
        subline={tops.length + " lista(s) · " + g.total + " video(s) · " + g.watched + " visto(s)" +
          (g.invested ? " · ⏳ Tiempo invertido: " + T.fmtInvested(g.invested) : "") +
          " · Arrastra para reordenar"} />
      {body}
    </>
  );
}

function YtListRow({ l, st, dragRef }: { l: T.YtList; st: ReturnType<typeof ytListStats>; dragRef: React.RefObject<DragState> }) {
  const tc = useTC();
  const { goYtList, openModal } = useApp();
  const { clearDropMarks } = useDnD();
  return (
    <div className="vrow" draggable data-id={l.id} title="Arrastra para reordenar"
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act]")) return; goYtList(l.id); }}
      onDragStart={(e) => {
        if (dragRef) dragRef.current = { type: T.DT_YTLIST, id: l.id };
        e.dataTransfer.setData(T.DT_YTLIST, l.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); if (dragRef) dragRef.current = null; }}
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_YTLIST)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "move";
        const ds = dragRef && dragRef.current;
        if (ds && ds.id !== l.id) e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, T.DT_YTLIST)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        tc.reorderYtLists(null, e.dataTransfer.getData(T.DT_YTLIST), l.id);
      }}>
      <span className="vrow-ic"><YtIconEl icon={l.icon} iconType={l.iconType} size={22} /></span>
      <div className="vrow-body">
        <div className="vrow-title">{l.name}</div>
        <div className="vrow-sub">{st.total} video(s) · {st.watched} visto(s) · {st.pct}%</div>
      </div>
      <span className="vrow-actions">
        <button className="icon-btn" data-act="edit" title="Editar lista"
          onClick={(e) => { e.stopPropagation(); openModal("ytlist", { id: l.id }); }}>✎</button>
      </span>
    </div>
  );
}

/* ---------- Vista: detalle de una lista ---------- */

export function YtListView() {
  const tc = useTC();
  const app = useApp();
  const { ui, goYt, goYtList, getViewMode, liveYtLists, liveYtVideos, ytListById, openModal } = app;
  const dragRef = useRef<DragState>(null);
  const mode = getViewMode("ytlist");
  const l = ytListById(ui.ytListId);
  if (!l || l.deletedAt) {
    goYt("ytlists");
    return null;
  }
  const parent = l.parentId ? ytListById(l.parentId) : undefined;
  const subs = liveYtLists().filter((s) => s.parentId === l.id).sort(T.byOrder);
  const videos = liveYtVideos().filter((v) => v.listId === l.id).sort(T.byOrder);
  const st = ytListStats(videos);

  const delList = async () => {
    let msg = "¿Enviar a la papelera la lista «" + l.name + "» con sus " + videos.length + " video(s)?";
    if (subs.length) msg += " También irán sus " + subs.length + " sublista(s) con sus videos.";
    msg += " Podrás recuperarla desde MIS ITEMS → Papelera durante 30 días.";
    if (!confirm(msg)) return;
    await tc.deleteYtList(l.id);
    tc.toast("Lista enviada a la papelera");
    goYt("ytlists");
  };

  const primary = (
    <>
      <button className="btn" onClick={() => openModal("ytimport", { listId: l.id })}>📥 Importar playlist</button>
      <button className="btn" onClick={() => openModal("ytlist", { parentId: l.id })}>＋ Sublista</button>
      <button className="btn" onClick={() => openModal("ytlist", { id: l.id })}>✎ Editar</button>
      <button className="btn primary" onClick={() => openModal("ytvideo", { listId: l.id })}>＋ Añadir video</button>
      <button className="btn danger" onClick={delList}>🗑 A la papelera</button>
    </>
  );

  let body: React.ReactNode;
  if (!videos.length) {
    body = <YtEmpty icon="🎬" lines={[
      "Esta lista está vacía.",
      "Añade un video pegando su URL, o importa una playlist entera de YouTube.",
    ]} />;
  } else if (mode === "list") {
    body = (
      <div className="view-list zoomable">
        {videos.map((v) => <YtVideoRow key={v.id} v={v} dragRef={dragRef} />)}
        <YtVideoEndzone listId={l.id} dragRef={dragRef} />
      </div>
    );
  } else if (mode === "board") {
    const cols: { key: "none" | "part" | "done"; label: string }[] = [
      { key: "none", label: "Por ver" },
      { key: "part", label: "En curso" },
      { key: "done", label: "Vistos ✓" },
    ];
    body = (
      <div className="yt-board">
        {cols.map((c) => {
          const vs = videos.filter((v) => ytStatus(v) === c.key);
          return (
            <div key={c.key} className="yt-col" data-col={c.key}
              onDragOver={(e) => { if (T.hasDT(e, T.DT_YTVIDEO)) { e.preventDefault(); e.currentTarget.classList.add("drop-target"); } }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drop-target")}
              onDrop={(e) => {
                e.preventDefault(); e.currentTarget.classList.remove("drop-target");
                if (!T.hasDT(e, T.DT_YTVIDEO)) return;
                const did = e.dataTransfer.getData(T.DT_YTVIDEO);
                const dv = tc.db.ytVideos.find((x) => x.id === did);
                if (!dv || dv.listId !== l.id) return;
                applyBoardStatus(tc, dv, c.key);
              }}>
              <h4>{c.label}<span>{vs.length}</span></h4>
              {vs.map((v) => <YtVideoCard key={v.id} v={v} dragRef={dragRef} />)}
              {!vs.length ? <div className="yt-col-empty">Arrastra videos aquí</div> : null}
            </div>
          );
        })}
      </div>
    );
  } else {
    body = (
      <div id="cards" className="cards zoomable yt-vgrid">
        {videos.map((v) => <YtVideoCard key={v.id} v={v} dragRef={dragRef} />)}
        <YtVideoEndzone listId={l.id} dragRef={dragRef} grid />
      </div>
    );
  }

  return (
    <>
      <YtHead vkey="ytlist" primary={primary}
        titleNode={<YtCrumbs trail={[
          ...(parent ? [{ label: <><YtIconEl icon={parent.icon} iconType={parent.iconType} size={16} /> {parent.name}</>, go: () => goYtList(parent.id) }] : []),
          { label: <><YtIconEl icon={l.icon} iconType={l.iconType} size={19} /> {l.name}</> },
        ]} />}
        subline={videos.length + " video(s) · " + st.watched + " visto(s)" +
          (st.invested ? " · ⏳ " + T.fmtInvested(st.invested) + " invertidos" : "") +
          " · Arrastra para reordenar · Clic en el círculo para marcar/desmarcar visto"} />
      {subs.length ? (
        <>
          <div className="yt-sec-title">📁 Sublistas ({subs.length})</div>
          <div className="cards zoomable yt-subgrid">
            {subs.map((s) => <YtListCard key={s.id} l={s} mini dragRef={dragRef} />)}
          </div>
          <div className="yt-sec-title">🎬 Videos</div>
        </>
      ) : null}
      {body}
    </>
  );
}

function applyBoardStatus(tc: ReturnType<typeof useTC>, v: T.YtVideo, target: "none" | "part" | "done") {
  if (target === "done") { tc.setYtWatched(v.youtubeId, true); return; }
  if (target === "none") { tc.setYtWatched(v.youtubeId, false); return; }
  /* En curso: si estaba visto, se desmarca y se deja a medias */
  if (v.watched) tc.setYtWatched(v.youtubeId, false);
  tc.addYtProgress(v.youtubeId, v.durationSec ? Math.floor(v.durationSec / 2) : Math.max(1, v.progressSec || 0), 0);
}

function YtVideoEndzone({ listId, dragRef, grid }: { listId: string; dragRef: React.RefObject<DragState>; grid?: boolean }) {
  const tc = useTC();
  return (
    <div className="reorder-endzone" data-kind="ytvideo"
      onDragOver={(e) => { if (T.hasDT(e, T.DT_YTVIDEO)) { e.preventDefault(); e.currentTarget.classList.add("drop-before"); } }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        e.preventDefault(); e.currentTarget.classList.remove("drop-before");
        if (!T.hasDT(e, T.DT_YTVIDEO)) return;
        const did = e.dataTransfer.getData(T.DT_YTVIDEO);
        const dv = tc.db.ytVideos.find((x) => x.id === did);
        if (!dv) return;
        if (dv.listId !== listId) tc.moveYtVideoToList(did, listId);
        else tc.reorderYtVideos(listId, did, null);
      }} />
  );
}

/* ---------- Vista: Suscripciones ---------- */

export function YtSubsView() {
  const tc = useTC();
  const { getViewMode, liveYtCats, liveYtChannels, liveYtVideos, openModal } = useApp();
  const dragRef = useRef<DragState>(null);
  const mode = getViewMode("ytsubs");
  const cats = liveYtCats().sort(T.byOrder);
  const channels = liveYtChannels().sort(T.byOrder);
  const videos = liveYtVideos();
  const videosOfChannel = (name: string) => videos.filter((v) => v.channelName && v.channelName === name).length;

  const sections: { cat: T.YtCategory | null; items: T.YtChannel[] }[] =
    cats.map((c) => ({ cat: c, items: channels.filter((ch) => ch.categoryId === c.id) }));
  const orphans = channels.filter((ch) => !ch.categoryId || !cats.find((c) => c.id === ch.categoryId));
  if (orphans.length) sections.push({ cat: null, items: orphans });

  /* Relleno de fotos: los canales que aún no tienen avatar lo piden una
     vez al servidor (que lo lee de su página pública) y queda guardado. */
  const triedAv = useRef<Set<string>>(new Set());
  const fillingAv = useRef(false);
  useEffect(() => {
    if (fillingAv.current) return;
    const missing = channels.filter((c) => c.url && !c.avatarUrl && !triedAv.current.has(c.id));
    if (!missing.length) return;
    fillingAv.current = true;
    let cancelled = false;
    (async () => {
      for (const ch of missing.slice(0, 40)) {
        triedAv.current.add(ch.id);
        if (cancelled) break;
        try {
          const r = await fetch("/api/yt?channel=" + encodeURIComponent(ch.url));
          const j = await r.json();
          if (!cancelled && r.ok && j && j.avatar) {
            const cur = tc.db.ytChannels.find((x) => x.id === ch.id);
            if (cur && !cur.avatarUrl) await tc.saveYtChannel({ ...cur, avatarUrl: j.avatar });
          }
        } catch { /* el siguiente */ }
      }
      fillingAv.current = false;
    })();
    return () => { cancelled = true; fillingAv.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  /* Categorías plegadas (se recuerda en settings, entre dispositivos) */
  const collapsedCats = tc.db.settings.ytCollapsedCats || [];
  const catKey = (cat: T.YtCategory | null) => (cat ? cat.id : "none");
  const isCollapsed = (cat: T.YtCategory | null) => collapsedCats.includes(catKey(cat));
  const toggleCat = (cat: T.YtCategory | null) => {
    const k = catKey(cat);
    tc.updateSettings({
      ytCollapsedCats: collapsedCats.includes(k)
        ? collapsedCats.filter((x) => x !== k)
        : [...collapsedCats, k],
    });
  };

  /* Soltar un canal sobre una sección/columna lo mueve a esa categoría */
  const overCat = (e: React.DragEvent) => {
    if (T.hasDT(e, T.DT_YTCHANNEL)) { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("drop-target"); }
  };
  const dropOnCat = (cat: T.YtCategory | null) => (e: React.DragEvent) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove("drop-target");
    if (!T.hasDT(e, T.DT_YTCHANNEL)) return;
    const did = e.dataTransfer.getData(T.DT_YTCHANNEL);
    const ch = tc.db.ytChannels.find((x) => x.id === did);
    const target = cat ? cat.id : null;
    if (ch && (ch.categoryId || null) !== target) {
      tc.saveYtChannel({ ...ch, categoryId: target, order: T.nextOrder(tc.db.ytChannels.filter((x) => (x.categoryId || null) === target)) })
        .then(() => tc.toast("Canal movido a «" + (cat ? cat.name : "Sin categoría") + "»"));
    }
  };

  const catHeader = (cat: T.YtCategory | null, items: T.YtChannel[], tog?: boolean) => (
    <div className="yt-cat-h" draggable={!!cat} data-cathead={cat ? cat.id : ""}
      onClick={(e) => {
        if (tog && (e.target as HTMLElement).closest("[data-tog]")) toggleCat(cat);
      }}
      onDragStart={(e) => {
        if (!cat) return;
        if (dragRef) dragRef.current = { type: DT_YTCAT, id: cat.id };
        e.dataTransfer.setData(DT_YTCAT, cat.id);
        e.dataTransfer.effectAllowed = "move";
        (e.currentTarget as HTMLElement).classList.add("dragging");
      }}
      onDragEnd={(e) => { (e.currentTarget as HTMLElement).classList.remove("dragging"); if (dragRef) dragRef.current = null; }}
      onDragOver={(e) => {
        if (!cat || !T.hasDT(e, DT_YTCAT)) return;
        e.preventDefault(); e.stopPropagation();
        const ds = dragRef && dragRef.current;
        if (ds && ds.id !== cat.id) (e.currentTarget as HTMLElement).classList.add("drop-before");
      }}
      onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-before")}
      onDrop={(e) => {
        if (!cat || !T.hasDT(e, DT_YTCAT)) return;
        e.preventDefault(); e.stopPropagation();
        (e.currentTarget as HTMLElement).classList.remove("drop-before");
        tc.reorderYtCategories(e.dataTransfer.getData(DT_YTCAT), cat.id);
      }}>
      {tog ? (
        <span className="yt-cat-chev" data-tog="1" title={isCollapsed(cat) ? "Desplegar categoría" : "Plegar categoría"}>
          {isCollapsed(cat) ? "▸" : "▾"}</span>
      ) : null}
      <span className="yt-cat-grip" title="Arrastra para reordenar la categoría">⠿</span>
      {cat ? <YtIconEl icon={cat.icon} iconType={cat.iconType} size={20} /> : <span style={{ fontSize: 17 }}>🗂️</span>}
      <span data-tog={tog ? "1" : undefined} style={tog ? { cursor: "pointer" } : undefined}>{cat ? cat.name : "Sin categoría"}</span>
      <span className="yt-cat-count">{items.length}</span>
      {cat ? (
        <span className="yt-cat-actions">
          <button className="icon-btn" title="Editar categoría"
            onClick={() => openModal("ytcat", { id: cat.id })}>✎</button>
          <button className="icon-btn" title="Enviar categoría a la papelera"
            onClick={() => {
              if (!confirm("¿Enviar a la papelera la categoría «" + cat.name + "»? Sus canales no se borran: quedan sin categoría mientras tanto. Podrás recuperarla desde MIS ITEMS → Papelera durante 30 días.")) return;
              tc.deleteYtCategory(cat.id).then(() => tc.toast("Categoría enviada a la papelera"));
            }}>×</button>
        </span>
      ) : null}
    </div>
  );

  let body: React.ReactNode;
  if (!channels.length && !cats.length) {
    body = <YtEmpty icon="📡" lines={[
      "Todavía no tienes canales en tus suscripciones.",
      "Añade el primero con «＋ Nuevo canal» y organízalos por categorías.",
    ]} />;
  } else if (mode === "board") {
    body = (
      <div className="yt-board yt-board-cats">
        {sections.map(({ cat, items }) => (
          <div key={cat ? cat.id : "none"} className="yt-col" data-cat={cat ? cat.id : ""}
            onDragOver={overCat} onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-target")}
            onDrop={dropOnCat(cat)}>
            {catHeader(cat, items)}
            {items.map((ch) => (
              <YtChannelCard key={ch.id} ch={ch} mini nVideos={videosOfChannel(ch.name)} dragRef={dragRef} />
            ))}
            {!items.length ? <div className="yt-col-empty">Sin canales aquí — arrastra uno</div> : null}
          </div>
        ))}
      </div>
    );
  } else {
    body = sections.map(({ cat, items }) => (
      <div key={cat ? cat.id : "none"} className="yt-cat-sec" data-cat={cat ? cat.id : ""}
        onDragOver={overCat} onDragLeave={(e) => (e.currentTarget as HTMLElement).classList.remove("drop-target")}
        onDrop={dropOnCat(cat)}>
        {catHeader(cat, items, true)}
        {isCollapsed(cat) ? null : items.length ? (
          mode === "list" ? (
            <div className="view-list zoomable" style={{ marginTop: 2 }}>
              {items.map((ch) => (
                <YtChannelRow key={ch.id} ch={ch} nVideos={videosOfChannel(ch.name)} dragRef={dragRef} />
              ))}
            </div>
          ) : (
            <div className="yt-chgrid zoomable">
              {items.map((ch) => (
                <YtChannelCard key={ch.id} ch={ch} nVideos={videosOfChannel(ch.name)} dragRef={dragRef} />
              ))}
            </div>
          )
        ) : <div className="yt-cat-empty">Sin canales en esta categoría — arrastra uno aquí</div>}
      </div>
    ));
  }

  return (
    <>
      <YtHead vkey="ytsubs"
        titleNode={<YtCrumbs trail={[{ label: <>📡 Suscripciones</> }]} />}
        subline={channels.length + " canal(es) en " + cats.length + " categoría(s) · Clic en una categoría para plegarla · Arrastra un canal a otra categoría para moverlo"}
        primary={<>
          <button className="btn" onClick={() => openModal("ytcat", {})}>＋ Nueva categoría</button>
          <button className="btn primary" onClick={() => openModal("ytchannel", {})}>＋ Nuevo canal</button>
        </>} />
      {body}
    </>
  );
}

function YtChannelCard({ ch, nVideos, dragRef, mini }: { ch: T.YtChannel; nVideos: number; dragRef: React.RefObject<DragState>; mini?: boolean }) {
  const tc = useTC();
  const { openModal } = useApp();
  const { clearDropMarks } = useDnD();
  const del = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Enviar a la papelera el canal «" + ch.name + "»? Podrás recuperarlo desde MIS ITEMS → Papelera durante 30 días.")) return;
    tc.deleteYtChannel(ch.id).then(() => tc.toast("Canal enviado a la papelera"));
  };
  return (
    <div className={"yt-chcard" + (mini ? " yt-mini" : "")} draggable data-id={ch.id} title="Arrastra para reordenar o cambiar de categoría"
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act]")) return; if (ch.url) tc.openUrl(ch.url); }}
      onDragStart={(e) => {
        if (dragRef) dragRef.current = { type: T.DT_YTCHANNEL, id: ch.id };
        e.dataTransfer.setData(T.DT_YTCHANNEL, ch.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); if (dragRef) dragRef.current = null; }}
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_YTCHANNEL)) return;
        e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
        const ds = dragRef && dragRef.current;
        if (ds && ds.id !== ch.id) e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, T.DT_YTCHANNEL)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        const did = e.dataTransfer.getData(T.DT_YTCHANNEL);
        const dc = tc.db.ytChannels.find((x) => x.id === did);
        if (!dc || dc.id === ch.id) return;
        if ((dc.categoryId || null) !== (ch.categoryId || null)) {
          tc.saveYtChannel({ ...dc, categoryId: ch.categoryId || null }).then(() =>
            tc.reorderYtChannels(ch.categoryId || null, did, ch.id));
        } else {
          tc.reorderYtChannels(ch.categoryId || null, did, ch.id);
        }
      }}>
      <span className="yt-avatar" style={{ background: "var(--card-2)" }}>
        <YtChannelAvatar ch={ch} />
      </span>
      <div className="yt-chmeta">
        <div className="yt-chname">{ch.name}</div>
        <div className="yt-chsub">{ch.handle || (ch.url ? T.domainOf(ch.url) : "")} · {nVideos} video(s) en tus listas</div>
      </div>
      <span className="yt-chactions">
        <button className="icon-btn" data-act="edit" title="Editar canal"
          onClick={(e) => { e.stopPropagation(); openModal("ytchannel", { id: ch.id }); }}>✎</button>
        <button className="icon-btn" data-act="del" title="Enviar canal a la papelera" onClick={del}>×</button>
      </span>
    </div>
  );
}

/* Fila de canal para el modo Lista de Suscripciones (mismo drag & drop
   que la tarjeta: reordenar dentro de la categoría o mover a otra). */
function YtChannelRow({ ch, nVideos, dragRef }: { ch: T.YtChannel; nVideos: number; dragRef: React.RefObject<DragState> }) {
  const tc = useTC();
  const { openModal } = useApp();
  const { clearDropMarks } = useDnD();
  const del = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Enviar a la papelera el canal «" + ch.name + "»? Podrás recuperarlo desde MIS ITEMS → Papelera durante 30 días.")) return;
    tc.deleteYtChannel(ch.id).then(() => tc.toast("Canal enviado a la papelera"));
  };
  return (
    <div className="vrow" draggable data-id={ch.id} title="Arrastra para reordenar o cambiar de categoría"
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-act]")) return; if (ch.url) tc.openUrl(ch.url); }}
      onDragStart={(e) => {
        if (dragRef) dragRef.current = { type: T.DT_YTCHANNEL, id: ch.id };
        e.dataTransfer.setData(T.DT_YTCHANNEL, ch.id);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add("dragging");
      }}
      onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); clearDropMarks(); if (dragRef) dragRef.current = null; }}
      onDragOver={(e) => {
        if (!T.hasDT(e, T.DT_YTCHANNEL)) return;
        e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
        const ds = dragRef && dragRef.current;
        if (ds && ds.id !== ch.id) e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        if (!T.hasDT(e, T.DT_YTCHANNEL)) return;
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        const did = e.dataTransfer.getData(T.DT_YTCHANNEL);
        const dc = tc.db.ytChannels.find((x) => x.id === did);
        if (!dc || dc.id === ch.id) return;
        if ((dc.categoryId || null) !== (ch.categoryId || null)) {
          tc.saveYtChannel({ ...dc, categoryId: ch.categoryId || null }).then(() =>
            tc.reorderYtChannels(ch.categoryId || null, did, ch.id));
        } else {
          tc.reorderYtChannels(ch.categoryId || null, did, ch.id);
        }
      }}>
      <span className="yt-avatar" style={{ background: "var(--card-2)", width: 30, height: 30, fontSize: 13 }}>
        <YtChannelAvatar ch={ch} favSize={18} />
      </span>
      <div className="vrow-body">
        <div className="vrow-title">{ch.name}</div>
        <div className="vrow-sub">{ch.handle || (ch.url ? T.domainOf(ch.url) : "")} · {nVideos} video(s) en tus listas</div>
      </div>
      <span className="vrow-actions">
        <button className="icon-btn" data-act="edit" title="Editar canal"
          onClick={(e) => { e.stopPropagation(); openModal("ytchannel", { id: ch.id }); }}>✎</button>
        <button className="icon-btn" data-act="del" title="Enviar canal a la papelera" onClick={del}>×</button>
      </span>
    </div>
  );
}

/* ---------- Vista: Completadas ---------- */

export function YtDoneView() {
  const { getViewMode, liveYtLists, liveYtVideos } = useApp();
  const dragRef = useRef<DragState>(null);
  const mode = getViewMode("ytdone");
  const allVideos = liveYtVideos();
  const done = liveYtLists().filter((l) => ytListDone(l, allVideos)).sort(T.byOrder);

  let body: React.ReactNode;
  if (!done.length) {
    body = <YtEmpty icon="🏁" lines={["Todavía no has completado ninguna lista."]} />;
  } else if (mode === "list") {
    body = (
      <div className="view-list zoomable">
        {done.map((l) => {
          const st = ytListStats(allVideos.filter((v) => v.listId === l.id));
          return <YtListRow key={l.id} l={l} st={st} dragRef={dragRef} />;
        })}
      </div>
    );
  } else if (mode === "board") {
    const cols: { key: string; label: string; items: T.YtList[] }[] = [
      { key: "top", label: "🎬 Listas", items: done.filter((l) => !l.parentId) },
      { key: "sub", label: "📂 Sublistas", items: done.filter((l) => !!l.parentId) },
    ].filter((c) => c.items.length);
    body = (
      <div className={"yt-board" + (cols.length === 2 ? " c2" : cols.length === 1 ? " c1" : "")}>
        {cols.map((c) => (
          <div key={c.key} className="yt-col">
            <h4>{c.label}<span>{c.items.length}</span></h4>
            {c.items.map((l) => <YtListCard key={l.id} l={l} mini dragRef={dragRef} />)}
          </div>
        ))}
      </div>
    );
  } else {
    body = (
      <div id="cards" className="cards zoomable">
        {done.map((l) => <YtListCard key={l.id} l={l} dragRef={dragRef} />)}
      </div>
    );
  }

  return (
    <>
      <YtHead vkey="ytdone"
        titleNode={<YtCrumbs trail={[{ label: <>🏁 Completadas</> }]} />}
        subline={done.length + " lista(s) completada(s) · Se mueven aquí solas al terminar la lista"} />
      {body}
    </>
  );
}

