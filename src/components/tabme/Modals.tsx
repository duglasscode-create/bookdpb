/* BookDPB — Modals.tsx
   Porte literal de los modales de TabmeCode v1.6.3 (newtab.js) a React.
   Infraestructura: overlay .modal-overlay > .modal (.modal-wide); cierra con
   clic en el overlay, Escape y botones con onClick={closeModal}. */
"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as T from "@/lib/tc";
import { useTC } from "@/lib/tc-store";
import { useApp } from "./tc-ui";

/* ---------- utilidades literales ---------- */

function fileToIconDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || "")) return reject(new Error("no-imagen"));
    if (file.size > 200 * 1024) return reject(new Error("muy-grande"));
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const max = 96;
          const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round((img.width || 1) * scale));
          c.height = Math.max(1, Math.round((img.height || 1) * scale));
          c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/png"));
        } catch (err) { reject(new Error("procesar")); }
      };
      img.onerror = () => reject(new Error("leer"));
      img.src = rd.result as string;
    };
    rd.onerror = () => reject(new Error("leer"));
    rd.readAsDataURL(file);
  });
}

async function copyText(t: string, toast: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(t);
    toast("Copiado");
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("Copiado"); }
    catch (e2) { toast("No se pudo copiar"); }
    ta.remove();
  }
}

/* ---------- shell del modal ---------- */

function ModalShell({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  const { closeModal } = useApp();
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.getElementById("colorPop")) closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeModal]);
  useEffect(() => {
    const el = boxRef.current?.querySelector('input[type="text"], textarea') as HTMLElement | null;
    if (el) {
      const t = setTimeout(() => el.focus(), 30);
      return () => clearTimeout(t);
    }
  }, []);
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className={"modal" + (wide ? " modal-wide" : "")} role="dialog" ref={boxRef}>
        {children}
      </div>
    </div>
  );
}

/* ---------- popover de color (paleta + HSV) ---------- */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => ("0" + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
  return "#" + h(r) + h(g) + h(b);
}
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 60;
  const c = v * s, x = c * (1 - Math.abs((h % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 1) { r = c; g = x; b = 0; } else if (h < 2) { r = x; g = c; b = 0; }
  else if (h < 3) { r = 0; g = c; b = x; } else if (h < 4) { r = 0; g = x; b = c; }
  else if (h < 5) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function ColorPopover({ anchor, initialHex, onPick, onClose }:
  { anchor: HTMLElement; initialHex: string; onPick: (hex: string) => void; onClose: () => void }) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => {
    const rgb = hexToRgb(initialHex) || [14, 165, 165];
    return rgbToHsv(rgb[0], rgb[1], rgb[2]);
  });
  const [hue, setHue] = useState(() => Math.round(hsv[0]));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const hexRef = useRef<HTMLInputElement>(null);
  const rRef = useRef<HTMLInputElement>(null);
  const gRef = useRef<HTMLInputElement>(null);
  const bRef = useRef<HTMLInputElement>(null);
  const prevRef = useRef<HTMLSpanElement>(null);
  const svDown = useRef(false);

  const paint = (h: number, s: number, v: number) => {
    const c = hsvToRgb(h, s, v);
    const hex = rgbToHex(c[0], c[1], c[2]);
    if (prevRef.current) prevRef.current.style.background = hex;
    if (hexRef.current) hexRef.current.value = hex;
    if (rRef.current) rRef.current.value = String(c[0]);
    if (gRef.current) gRef.current.value = String(c[1]);
    if (bRef.current) bRef.current.value = String(c[2]);
    const cv = cvRef.current;
    const ctx = cv?.getContext("2d");
    if (cv && ctx) {
      const base = hsvToRgb(h, 1, 1);
      const g1 = ctx.createLinearGradient(0, 0, cv.width, 0);
      g1.addColorStop(0, "#ffffff");
      g1.addColorStop(1, "rgb(" + base[0] + "," + base[1] + "," + base[2] + ")");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, cv.width, cv.height);
      const g2 = ctx.createLinearGradient(0, 0, 0, cv.height);
      g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, "#000000");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, cv.width, cv.height);
      const px = s * cv.width, py = (1 - v) * cv.height;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.stroke();
    }
  };

  useEffect(() => { paint(hsv[0], hsv[1], hsv[2]); });
  useEffect(() => {
    const r = anchor.getBoundingClientRect();
    const pop = popRef.current;
    if (!pop) return;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    setPos({
      top: Math.max(8, Math.min(window.innerHeight - ph - 8, r.bottom + 6)),
      left: Math.max(8, Math.min(window.innerWidth - pw - 8, r.left)),
    });
    const outside = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", outside);
      document.addEventListener("keydown", esc);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAll = (h: number, s: number, v: number) => {
    setHue(Math.round(h));
    setHsv([h, s, v]);
    paint(h, s, v);
  };
  const pick = (x: number, y: number) => {
    const cv = cvRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (x - r.left) / r.width));
    const v = Math.max(0, Math.min(1, 1 - (y - r.top) / r.height));
    setAll(hsv[0], s, v);
  };
  const fromRGBInputs = () => {
    const c = [
      parseInt(rRef.current?.value || "0", 10) || 0,
      parseInt(gRef.current?.value || "0", 10) || 0,
      parseInt(bRef.current?.value || "0", 10) || 0,
    ];
    const nh = rgbToHsv(c[0], c[1], c[2]);
    setAll(nh[0], nh[1], nh[2]);
  };
  const choose = () => {
    const hex = rgbToHex(...hsvToRgb(hsv[0], hsv[1], hsv[2]));
    onClose(); onPick(hex);
  };

  return createPortal(
    <div className="color-pop" id="colorPop" ref={popRef}
      style={pos ? { position: "fixed", top: pos.top, left: pos.left } : { position: "fixed", visibility: "hidden" }}>
      <div className="cp-swatches">
        {T.PALETTE.map((c) => (
          <button key={c} type="button" className="swatch" style={{ background: c }} title={c}
            onClick={() => { onClose(); onPick(c); }} />
        ))}
      </div>
      <div className="cp-label">Personalizado</div>
      <canvas id="cpSV" width={200} height={140} className="cp-sat" ref={cvRef}
        onPointerDown={(e) => { svDown.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); pick(e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (svDown.current) pick(e.clientX, e.clientY); }}
        onPointerUp={() => { svDown.current = false; }} />
      <input type="range" id="cpHue" min={0} max={359} value={hue} className="cp-hue" aria-label="Tono"
        onChange={(e) => setAll(parseInt(e.target.value, 10) || 0, hsv[1], hsv[2])} />
      <div className="cp-fields">
        <span className="cp-prev" id="cpPrev" ref={prevRef}></span>
        <label>HEX<input id="cpHex" maxLength={7} spellCheck={false} autoComplete="off" ref={hexRef}
          onChange={(e) => {
            const c = hexToRgb(e.target.value);
            if (c) { const nh = rgbToHsv(c[0], c[1], c[2]); setAll(nh[0], nh[1], nh[2]); }
            else e.target.value = rgbToHex(...hsvToRgb(hsv[0], hsv[1], hsv[2]));
          }} /></label>
        <label>R<input id="cpR" type="number" min={0} max={255} ref={rRef} onChange={fromRGBInputs} /></label>
        <label>G<input id="cpG" type="number" min={0} max={255} ref={gRef} onChange={fromRGBInputs} /></label>
        <label>B<input id="cpB" type="number" min={0} max={255} ref={bRef} onChange={fromRGBInputs} /></label>
      </div>
      <div className="cp-actions"><button type="button" className="btn primary" id="cpOk" onClick={choose}>Elegir</button></div>
    </div>,
    document.body
  );
}

/* ---------- campo de color ---------- */

export function ColorField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const tc = useTC();
  const initial = /^#[0-9a-f]{6}$/i.test(value || "") ? (value as string).toLowerCase() : T.PALETTE[0];
  const [color, setColor] = useState(initial);
  const [popAnchor, setPopAnchor] = useState<HTMLElement | null>(null);
  const hexRef = useRef<HTMLInputElement>(null);
  const apply = (h: string) => { setColor(h); if (hexRef.current) hexRef.current.value = h; onChange(h); };
  return (
    <div className="field"><label>Color</label>
      <div className="color-field">
        <button type="button" className="color-prev" id="cfPrev" style={{ background: color }} title="Elegir color"
          onClick={(e) => { e.stopPropagation(); setPopAnchor(e.currentTarget); }} />
        <input type="text" id="cfHex" defaultValue={color} maxLength={7} spellCheck={false} autoComplete="off" ref={hexRef}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && v.charAt(0) !== "#") v = "#" + v;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) apply(v.toLowerCase());
            else { e.target.value = color; tc.toast("Color no válido (usa formato #rrggbb)"); }
          }} />
      </div>
      {popAnchor && (
        <ColorPopover anchor={popAnchor} initialHex={color}
          onPick={(h) => apply(h)} onClose={() => setPopAnchor(null)} />
      )}
    </div>
  );
}

/* ---------- selector de icono (emoji / imagen) ---------- */

export function IconPicker({ icon, iconType, onPick }:
  { icon: string; iconType: string; onPick: (v: { icon: string; iconType: string }) => void }) {
  const tc = useTC();
  const [tab, setTab] = useState(iconType === "img" ? "img" : "emoji");
  const [emoji, setEmoji] = useState(iconType !== "img" ? (icon || "") : "");
  const [img, setImg] = useState(iconType === "img" ? (icon || "") : "");
  const [urlText, setUrlText] = useState(iconType === "img" ? (icon || "") : "");
  const fileRef = useRef<HTMLInputElement>(null);
  const pick = (e: string, it: string) => onPick({ icon: e, iconType: it });

  return (
    <div className="field"><label>Icono</label>
      <div className="ip-tabs">
        <button type="button" className={"ip-tab" + (tab !== "img" ? " active" : "")}
          onClick={() => setTab("emoji")}>😀 Emoji</button>
        <button type="button" className={"ip-tab" + (tab === "img" ? " active" : "")}
          onClick={() => setTab("img")}>🖼 Imagen</button>
      </div>
      <div className={"ip-pane" + (tab === "img" ? " hidden" : "")}>
        <div className="icon-row">
          <span className="icon-preview" id="iconPrev">{emoji || "📁"}</span>
          <input type="text" id="mIcon" maxLength={12} placeholder="Pega un emoji…" autoComplete="off"
            value={emoji}
            onChange={(e) => { const v = e.target.value.trim().slice(0, 12); setEmoji(v); pick(v, "emoji"); }} />
        </div>
        <div className="icon-grid">
          {T.ICON_SUGGESTIONS.map((e) => (
            <button key={e} type="button" className={"icon-opt" + (e === emoji ? " selected" : "")}
              onClick={() => { setEmoji(e); pick(e, "emoji"); }}>{e}</button>
          ))}
          <button type="button" className="icon-opt icon-none" title="Sin icono"
            onClick={() => { setEmoji(""); pick("", "emoji"); }}>∅</button>
        </div>
      </div>
      <div className={"ip-pane" + (tab === "img" ? "" : " hidden")}>
        <div className="icon-row">
          <span className="icon-preview" id="iconPrevImg">
            {T.safeIconURL(img) ? <T.ImgIcon url={T.safeIconURL(img)} size={26} /> : "🖼"}
          </span>
          <input type="url" id="mIconUrl" placeholder="https://…/icono.png" autoComplete="off" spellCheck={false}
            value={urlText}
            onChange={(e) => {
              const v = e.target.value.trim();
              setUrlText(v);
              const u = T.safeIconURL(v);
              setImg(u || v);
              pick(u || "", u ? "img" : "emoji");
            }} />
        </div>
        <div className="ip-actions">
          <button type="button" className="btn" id="mIconBrowse"
            onClick={() => fileRef.current?.click()}>📤 Subir imagen…</button>
          <span className="ip-hint">PNG, JPG, SVG o WebP · máx. 200 KB (se reduce solo)</span>
        </div>
        <input type="file" id="mIconFile" ref={fileRef} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
          onChange={async (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = "";
            if (!file) return;
            try {
              const du = await fileToIconDataURL(file);
              setImg(du); setUrlText(""); pick(du, "img");
              tc.toast("Imagen lista");
            } catch (err) {
              tc.toast((err as Error).message === "muy-grande" ? "La imagen supera los 200 KB" : "No se pudo leer la imagen");
            }
          }} />
      </div>
    </div>
  );
}

/* ---------- select de carpetas agrupado por space ---------- */

export function FolderSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { liveSpaces, liveFolders } = useApp();
  const spaces = liveSpaces();
  const folders = liveFolders();
  const tree = (spaceId: string, parentId: string | null, depth: number): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    folders
      .filter((f) => f.spaceId === spaceId && (f.parentId || null) === parentId)
      .sort(T.byOrder)
      .forEach((f) => {
        const pad = depth ? "  ".repeat(depth) + "↳ " : "";
        out.push(
          <option key={f.id} value={f.id}>{pad}{f.icon ? f.icon + " " : ""}{f.name}</option>
        );
        out.push(...tree(spaceId, f.id, depth + 1));
      });
    return out;
  };
  return (
    <select id="mFolder" value={value} onChange={(e) => onChange(e.target.value)}>
      {spaces.map((sp) => {
        const opts = tree(sp.id, null, 0);
        return opts.length ? <optgroup key={sp.id} label={sp.name}>{opts}</optgroup> : null;
      })}
    </select>
  );
}

/* ---------- modal space ---------- */

function SpaceModal({ id, edit }: { id?: string; edit?: T.Space }) {
  const tc = useTC();
  const { closeModal, goSpace } = useApp();
  const db = tc.db;
  const sp = edit || (id ? db.spaces.find((s) => s.id === id) : undefined);
  const nameRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef(sp ? sp.color : T.PALETTE[0]);
  const iconRef = useRef({ icon: sp ? sp.icon : "", iconType: sp ? sp.iconType : "emoji" });

  const save = async () => {
    const name = nameRef.current?.value.trim() || "";
    if (!name) { tc.toast("Escribe un nombre"); return; }
    const ic = iconRef.current;
    if (sp) {
      await tc.saveSpace({ ...sp, name, color: colorRef.current, icon: ic.icon, iconType: ic.iconType });
      await tc.logActivity("edit", "Editaste un space", name);
    } else {
      const nsp = await tc.createSpace(name, colorRef.current, ic.icon, ic.iconType);
      await tc.logActivity("create", "Creaste un space", name);
      goSpace(nsp.id);
    }
    closeModal();
    tc.toast("Space guardado");
  };

  return (
    <ModalShell>
      <h3>{sp ? "Editar space" : "Nuevo space"}</h3>
      <div className="field"><label>Nombre</label>
        <input type="text" id="mName" ref={nameRef} defaultValue={sp ? sp.name : ""} placeholder="p. ej. Proyecto web" />
      </div>
      <IconPicker icon={iconRef.current.icon} iconType={iconRef.current.iconType}
        onPick={(v) => { iconRef.current = v; }} />
      <ColorField value={colorRef.current} onChange={(h) => { colorRef.current = h; }} />
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cancelar</button>
        <button className="btn primary" id="mSave" onClick={save}>Guardar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- modal carpeta (+ flujo "¿en qué space?") ---------- */

function FolderModal({ id, edit, parentId, spaceId }:
  { id?: string; edit?: T.Folder; parentId?: string | null; spaceId?: string | null }) {
  const tc = useTC();
  const { closeModal, goFolder, liveSpaces, folderById } = useApp();
  const db = tc.db;
  const spaces = liveSpaces();
  const f = edit || (id ? folderById(id) : undefined);
  const parent = !f && parentId ? folderById(parentId) : undefined;

  const [pickedSpaceId, setPickedSpaceId] = useState<string | null>(() => {
    if (f || parent) return null;
    if (spaceId) return spaceId;
    if (spaces.length === 1) return spaces[0].id;
    return null;
  });
  const nameRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef(f ? f.color : T.PALETTE[1]);
  const iconRef = useRef({ icon: f ? f.icon : "", iconType: f ? f.iconType : "emoji" });

  const resolvedSpaceId = f ? f.spaceId : (parent ? parent.spaceId : pickedSpaceId);
  const sp = db.spaces.find((s) => s.id === resolvedSpaceId);

  useEffect(() => {
    if (!f && !parent && !pickedSpaceId && spaces.length === 0) {
      tc.toast("Primero crea un space");
      closeModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!f && !parent && !pickedSpaceId) {
    if (spaces.length === 0) return null;
    // Flujo newFolderFlow: pregunta en qué space crearla
    return (
      <ModalShell>
        <h3>¿En qué space creas la carpeta?</h3>
        <div className="space-pick">
          {spaces.map((s) => (
            <button key={s.id} className="btn space-pick-btn" onClick={() => setPickedSpaceId(s.id)}>
              <T.SpaceIconEl sp={s} />{s.name}
            </button>
          ))}
        </div>
        <div className="modal-actions"><button className="btn" onClick={closeModal}>Cancelar</button></div>
      </ModalShell>
    );
  }
  if (!sp) return null;

  const where = !f ? (
    <div className="field"><label>Ubicación</label>
      <div className="where-line">
        <T.SpaceIconEl sp={sp} /> {sp.name}
        {parent ? (<span> / <T.FolderIconEl f={parent} size={16} /> {parent.name}</span>) : null}
      </div>
    </div>
  ) : null;

  const save = async () => {
    const name = nameRef.current?.value.trim() || "";
    if (!name) { tc.toast("Escribe un nombre"); return; }
    const ic = iconRef.current;
    if (f) {
      await tc.saveFolder({ ...f, name, color: colorRef.current, icon: ic.icon, iconType: ic.iconType });
      await tc.logActivity("edit", "Editaste una carpeta", name);
    } else {
      const nf = await tc.createFolder(sp.id, parent ? parent.id : null, name, colorRef.current, ic.icon, ic.iconType);
      await tc.logActivity("create", "Creaste una carpeta", name);
      goFolder(nf.id);
    }
    closeModal();
    tc.toast("Carpeta guardada");
  };

  return (
    <ModalShell>
      <h3>{f ? "Editar carpeta" : (parent ? "Nueva subcarpeta" : "Nueva carpeta")}</h3>
      {where}
      <div className="field"><label>Nombre</label>
        <input type="text" id="mName" ref={nameRef} defaultValue={f ? f.name : ""} placeholder="p. ej. Documentación" />
      </div>
      <IconPicker icon={iconRef.current.icon} iconType={iconRef.current.iconType}
        onPick={(v) => { iconRef.current = v; }} />
      <ColorField value={colorRef.current} onChange={(h) => { colorRef.current = h; }} />
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cancelar</button>
        <button className="btn primary" id="mSave" onClick={save}>Guardar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- modal marcador (editar / añadir) ----------
   kind "bookmark": con {id} edita; sin id añade (preset opcional {url, folderId}). */

function BookmarkModal({ id, url, folderId }: { id?: string; url?: string; folderId?: string }) {
  const tc = useTC();
  const b = id ? tc.db.bookmarks.find((x) => x.id === id) : undefined;
  if (b) return <BookmarkEditModal b={b} />;
  return <BookmarkAddModal url={url} folderId={folderId} />;
}

function BookmarkEditModal({ b }: { b: T.Bookmark }) {
  const tc = useTC();
  const { closeModal, openModal } = useApp();
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [folderId, setFolderId] = useState(b?.folderId || "");
  if (!b) return null;

  const save = async () => {
    const url = urlRef.current?.value.trim() || "";
    if (!url) { tc.toast("La URL no puede estar vacía"); return; }
    const title = titleRef.current?.value.trim() || url;
    const tags = (tagsRef.current?.value || "").split(",").map((t) => t.trim()).filter(Boolean);
    const note = noteRef.current?.value || "";
    await tc.saveBookmark({ ...b, title, url, folderId: folderId || null, tags, note });
    await tc.logActivity("edit", "Editaste un marcador", title);
    closeModal();
    tc.toast("Marcador actualizado");
  };

  return (
    <ModalShell>
      <h3>Editar marcador</h3>
      <div className="field"><label>Título</label>
        <input type="text" id="mTitle" ref={titleRef} defaultValue={b.title} />
      </div>
      <div className="field"><label>URL</label>
        <input type="url" id="mUrl" ref={urlRef} defaultValue={b.url} />
      </div>
      <div className="field"><label>Carpeta</label>
        <FolderSelect value={folderId} onChange={setFolderId} />
      </div>
      <div className="field"><label>Etiquetas (separadas por comas)</label>
        <input type="text" id="mTags" ref={tagsRef} defaultValue={(b.tags || []).join(", ")} />
      </div>
      <div className="field"><label>Nota</label>
        <textarea id="mNote" ref={noteRef} defaultValue={b.note || ""}></textarea>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cancelar</button>
        <button className="btn" id="mRemind"
          onClick={() => { closeModal(); openModal("reminder", { title: b.title, url: b.url }); }}>⏰ Recordatorio</button>
        <button className="btn primary" id="mSave" onClick={save}>Guardar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- modal añadir marcador ---------- */

function BookmarkAddModal({ url, folderId }: { url?: string; folderId?: string }) {
  const tc = useTC();
  const { ui, closeModal } = useApp();
  const db = tc.db;
  const defFolder = folderId || ui.folderId || (db.folders[0] && db.folders[0].id) || "";
  const [selFolder, setSelFolder] = useState(defFolder);
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const save = async () => {
    let url = urlRef.current?.value.trim() || "";
    if (!url) { tc.toast("Escribe una URL"); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(url)) { tc.toast("URL no válida"); return; }
    if (!selFolder) { tc.toast("No hay ninguna carpeta; crea una primero"); return; }
    const title = titleRef.current?.value.trim() || T.domainOf(url) || url;
    const tags = (tagsRef.current?.value || "").split(",").map((t) => t.trim()).filter(Boolean);
    const note = noteRef.current?.value || "";
    await tc.createBookmark({ url, title, note, folderId: selFolder, tags, favorite: false });
    await tc.logActivity("create", "Creaste un marcador", title);
    closeModal();
    tc.toast("Marcador guardado");
  };

  return (
    <ModalShell>
      <h3>➕ Añadir marcador</h3>
      <div className="field"><label>Título (opcional)</label>
        <input type="text" id="mTitle" ref={titleRef} placeholder="Si lo dejas vacío se usa el dominio" />
      </div>
      <div className="field"><label>URL</label>
        <input type="url" id="mUrl" ref={urlRef} defaultValue={url || ""}
          placeholder="https://ejemplo.com" autoComplete="off" spellCheck={false} />
      </div>
      <div className="field"><label>Carpeta</label>
        <FolderSelect value={selFolder} onChange={setSelFolder} />
      </div>
      <div className="field"><label>Etiquetas (separadas por comas)</label>
        <input type="text" id="mTags" ref={tagsRef} placeholder="trabajo, leer" />
      </div>
      <div className="field"><label>Nota</label>
        <textarea id="mNote" ref={noteRef} placeholder="Nota opcional…"></textarea>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cancelar</button>
        <button className="btn primary" id="mSave" onClick={save}>Guardar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- modal importar / exportar ----------
   NOTA: «Desde marcadores de Chrome» no es portable a web (requiere el
   permiso `bookmarks` de la extensión); se omite según la spec §10. */

function IOModal() {
  const tc = useTC();
  const { ui, closeModal } = useApp();
  const folderNameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const r = await tc.parseImportFile(file);
      if (r.fullBackup) {
        /* PENDIENTE: la restauración completa necesita un método bulk en el
           store (reemplazar todos los datos de una vez); no existe en el
           contrato actual. Se deja el confirm literal y se anota. */
        if (!confirm("¿Restaurar la copia de seguridad completa? Se reemplazarán todos los datos actuales.")) return;
        tc.toast("La restauración completa aún no está disponible en la versión web");
        return;
      }
      const folderName = folderNameRef.current?.value.trim() || "Importados";
      await tc.ingestImportItems(r.items, ui.spaceId || "", folderName);
      closeModal();
    } catch (err) {
      tc.toast("Archivo no válido: " + ((err as Error) && (err as Error).message));
    }
  };

  return (
    <ModalShell>
      <h3>📥 Importar / Exportar</h3>
      <div className="field"><label>Importar a la carpeta</label>
        <input type="text" id="mFolderName" ref={folderNameRef} defaultValue="Importados" />
      </div>
      <div className="io-grid">
        <button className="btn" id="ioFile" onClick={() => fileRef.current?.click()}>Desde archivo…</button>
      </div>
      <input type="file" id="ioFileInput" ref={fileRef} accept=".json,.html,.htm,.csv,.txt" className="hidden" onChange={onFile} />
      <div className="field" style={{ marginTop: 14 }}><label>Exportar todos los marcadores</label></div>
      <div className="io-grid">
        <button className="btn" id="ioExpJson" onClick={() => { tc.exportJSON(); tc.toast("Copia JSON descargada"); }}>JSON (copia completa)</button>
        <button className="btn" id="ioExpHtml" onClick={() => { tc.exportHTML(); tc.toast("HTML descargado"); }}>HTML</button>
        <button className="btn" id="ioExpCsv" onClick={() => { tc.exportCSV(); tc.toast("CSV descargado"); }}>CSV</button>
        <button className="btn" id="ioExpTxt" onClick={() => { tc.exportTXT(); tc.toast("TXT descargado"); }}>TXT</button>
      </div>
      <div className="modal-actions"><button className="btn" onClick={closeModal}>Cerrar</button></div>
    </ModalShell>
  );
}

/* ---------- modal editar etiquetas ---------- */

function TagsModal() {
  const tc = useTC();
  const { closeModal, tagColorOf } = useApp();
  const db = useTC().db;
  const counts = useRef<Record<string, number>>({});
  if (!Object.keys(counts.current).length) {
    db.bookmarks.forEach((b) => (b.tags || []).forEach((t) => {
      counts.current[t] = (counts.current[t] || 0) + 1;
    }));
  }
  const names = Object.keys(counts.current).sort();
  const [rows, setRows] = useState(() =>
    names.map((t) => ({ old: t, name: t, color: tagColorOf(t), gone: false })));
  const [popFor, setPopFor] = useState<{ anchor: HTMLElement; idx: number } | null>(null);

  const apply = async () => {
    for (const r of rows) {
      if (r.gone || !r.name) {
        await tc.deleteTag(r.old);
      } else if (r.name !== r.old) {
        await tc.renameTag(r.old, r.name);
        await tc.setTagColor(r.name, r.color);
      } else {
        await tc.setTagColor(r.old, r.color);
      }
    }
    closeModal();
    tc.toast("Etiquetas actualizadas");
  };

  return (
    <ModalShell>
      <h3>🏷 Editar etiquetas</h3>
      {rows.length ? (
        <div id="tagEditList">
          {rows.map((r, i) => (
            <div key={r.old} className="tag-edit-row" style={r.gone ? { opacity: 0.45 } : undefined}>
              <button className="tag-cdot" style={{ background: r.color }} title="Cambiar color de la etiqueta"
                onClick={(e) => setPopFor({ anchor: e.currentTarget, idx: i })} />
              <input type="text" value={r.name}
                onChange={(e) => setRows((prev) => prev.map((x, j) =>
                  j === i ? { ...x, name: e.target.value.trim(), gone: false } : x))} />
              <span className="tcount">{counts.current[r.old]} marcador(es)</span>
              <button className="icon-btn" title="Eliminar etiqueta"
                onClick={() => setRows((prev) => prev.map((x, j) =>
                  j === i ? { ...x, name: "", gone: true } : x))}>×</button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 13.5 }}>No hay etiquetas todavía. Añade etiquetas al editar un marcador.</p>
      )}
      {rows.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Pulsa el punto de color para cambiarlo (paleta o color personalizado). Vacía el nombre de una etiqueta para eliminarla de todos los marcadores.
        </p>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cancelar</button>
        {rows.length > 0 && <button className="btn primary" id="mSave" onClick={apply}>Aplicar cambios</button>}
      </div>
      {popFor && (
        <ColorPopover anchor={popFor.anchor} initialHex={rows[popFor.idx].color}
          onPick={(hex) => setRows((prev) => prev.map((x, j) =>
            j === popFor.idx ? { ...x, color: hex } : x))}
          onClose={() => setPopFor(null)} />
      )}
    </ModalShell>
  );
}

/* ---------- modal cuenta / asistente (editar) ----------
   kind "account": props { id?, kind?: "view", coll?: "accounts"|"assistants" }.
   Con kind==="view" muestra el detalle de credenciales. */

function AccountModal({ id, kind, coll }: { id?: string; kind?: string; coll?: "accounts" | "assistants" }) {
  const tc = useTC();
  const { closeModal } = useApp();
  const db = tc.db;
  const collection = coll === "assistants" ? "assistants" : "accounts";
  const arr = collection === "accounts" ? db.accounts : db.assistants;
  const a = id ? arr.find((x) => x.id === id) : undefined;
  const isAcc = collection === "accounts";
  const label = isAcc ? "cuenta" : "asistente";

  if (kind === "view" && a) return <AccountDetailModal a={a} coll={collection} />;

  const nameRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [showPass, setShowPass] = useState(false);
  const iconRef = useRef({ icon: a ? a.icon : "", iconType: a ? a.iconType : "emoji" });

  const save = async () => {
    const name = nameRef.current?.value.trim() || "";
    let url = urlRef.current?.value.trim() || "";
    if (!name) { tc.toast("Escribe un nombre"); return; }
    if (!url) { tc.toast("Escribe la URL"); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const ic = iconRef.current;
    const payload = {
      name, url,
      username: userRef.current?.value.trim() || "",
      email: emailRef.current?.value.trim() || "",
      password: passRef.current?.value || "",
      note: noteRef.current?.value || "",
      icon: ic.icon, iconType: ic.iconType,
    };
    if (a) {
      if (isAcc) await tc.saveAccount({ ...a, ...payload });
      else await tc.saveAssistant({ ...a, ...payload });
      await tc.logActivity("edit", "Editaste " + (isAcc ? "una cuenta" : "un asistente"), name);
    } else {
      if (isAcc) await tc.createAccount(payload);
      else await tc.createAssistant(payload);
      await tc.logActivity("create", "Añadiste " + (isAcc ? "una cuenta" : "un asistente"), name);
    }
    closeModal();
    tc.toast("Guardado");
  };

  return (
    <ModalShell>
      <h3>{(a ? "Editar " : "Nueva ") + label}</h3>
      <div className="field"><label>Nombre *</label>
        <input type="text" id="mName" ref={nameRef} defaultValue={a ? a.name : ""}
          placeholder={isAcc ? "Gmail, GitHub…" : "ChatGPT, Claude…"} />
      </div>
      <div className="field"><label>URL *</label>
        <input type="url" id="mUrl" ref={urlRef} defaultValue={a ? a.url : ""}
          placeholder="https://…" autoComplete="off" spellCheck={false} />
      </div>
      <div className="field-row">
        <div className="field"><label>Usuario</label>
          <input type="text" id="mUser" ref={userRef} defaultValue={a ? (a.username || "") : ""}
            placeholder="Nombre de usuario" autoComplete="off" spellCheck={false} />
        </div>
        <div className="field"><label>Email</label>
          <input type="email" id="mEmail" ref={emailRef} defaultValue={a ? (a.email || "") : ""}
            placeholder="correo@ejemplo.com" autoComplete="off" spellCheck={false} />
        </div>
      </div>
      <div className="field"><label>Contraseña</label>
        <div className="pw-wrap">
          <input type={showPass ? "text" : "password"} id="mPass" ref={passRef}
            defaultValue={a ? (a.password || "") : ""} placeholder="••••••••" autoComplete="new-password" />
          <button type="button" className="pw-toggle" id="mPassT" title="Mostrar/ocultar"
            onClick={() => setShowPass((v) => !v)}>{showPass ? "🙈" : "👁"}</button>
        </div>
      </div>
      <div className="field"><label>Nota (opcional)</label>
        <textarea id="mNote" ref={noteRef} defaultValue={a ? (a.note || "") : ""} placeholder="Notas adicionales…" />
      </div>
      <IconPicker icon={iconRef.current.icon} iconType={iconRef.current.iconType}
        onPick={(v) => { iconRef.current = v; }} />
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cancelar</button>
        <button className="btn primary" id="mSave" onClick={save}>Guardar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- detalle de cuenta / asistente (credenciales) ---------- */

function AccountDetailModal({ a, coll }: { a: T.Account; coll: "accounts" | "assistants" }) {
  const tc = useTC();
  const { closeModal, openModal } = useApp();
  const [shown, setShown] = useState(false);
  const rows: { l: string; v: string; raw: string; link?: boolean; pass?: boolean }[] = [];
  if (a.url) rows.push({ l: "Sitio web", v: T.domainOf(a.url), raw: a.url, link: true });
  if (a.username) rows.push({ l: "Usuario", v: a.username, raw: a.username });
  if (a.email) rows.push({ l: "Email", v: a.email, raw: a.email });
  if (a.password) rows.push({ l: "Contraseña", v: "••••••••", raw: a.password, pass: true });

  return (
    <ModalShell>
      <h3><T.ItemIconEl a={a} size={22} /> {a.name}</h3>
      {rows.length ? rows.map((r, i) => (
        <div className="cred-row" key={i}>
          <span className="cred-lbl">{r.l}</span>
          <span className={"cred-val" + (r.pass ? " cred-pass" : "")}>
            {r.pass && shown ? r.raw : r.v}
          </span>
          {r.pass && (
            <button className="icon-btn" title="Mostrar/ocultar" onClick={() => setShown((v) => !v)}>👁</button>
          )}
          {r.link && (
            <button className="icon-btn" title="Abrir sitio" onClick={() => tc.openUrl(r.raw)}>↗</button>
          )}
          <button className="icon-btn" title="Copiar" onClick={() => copyText(r.raw, tc.toast)}>📋</button>
        </div>
      )) : <p className="rl-empty">Sin credenciales guardadas.</p>}
      {a.note ? (
        <div className="field"><label>Nota</label>
          <div className="cred-note">{a.note.split("\n").map((ln, i) => (
            <React.Fragment key={i}>{i > 0 && <br />}{ln}</React.Fragment>
          ))}</div>
        </div>
      ) : null}
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cerrar</button>
        <button className="btn primary" id="mEdit"
          onClick={() => { closeModal(); openModal("account", { id: a.id, coll }); }}>✎ Editar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- modal recordatorio ---------- */

function ReminderModal({ id, title, url }: { id?: string; title?: string; url?: string }) {
  const tc = useTC();
  const { closeModal } = useApp();
  const db = tc.db;
  const r = id ? db.reminders.find((x) => x.id === id) : undefined;
  const base = r ? new Date(r.when) : new Date(Date.now() + 3600000);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef(r ? (r.color || T.NOTE_COLORS[0]) : T.NOTE_COLORS[0]);
  const iconRef = useRef({ icon: r ? r.icon : "", iconType: r ? r.iconType : "emoji" });

  const save = async () => {
    const title = titleRef.current?.value.trim() || "";
    const dateV = dateRef.current?.value || "";
    const timeV = timeRef.current?.value || "09:00";
    if (!title) { tc.toast("Escribe un título"); return; }
    const when = new Date(dateV + "T" + timeV).getTime();
    if (!dateV || isNaN(when)) { tc.toast("Fecha no válida"); return; }
    let url = urlRef.current?.value.trim() || "";
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    const note = noteRef.current?.value || "";
    const ic = iconRef.current;
    const payload = { title, when, note, url, color: colorRef.current, icon: ic.icon, iconType: ic.iconType };
    if (r) {
      await tc.saveReminder({ ...r, ...payload });
      await tc.logActivity("edit", "Editaste un recordatorio", title);
    } else {
      await tc.createReminder({ ...payload, done: false });
      await tc.logActivity("create", "Creaste un recordatorio", title);
    }
    closeModal();
    tc.toast("Recordatorio guardado");
  };

  return (
    <ModalShell>
      <h3>⏰ {r ? "Editar recordatorio" : "Nuevo recordatorio"}</h3>
      <div className="field"><label>Título</label>
        <input type="text" id="mTitle" ref={titleRef}
          defaultValue={r ? r.title : (title || "")} placeholder="¿Qué te aviso?" />
      </div>
      <div className="field-row">
        <div className="field"><label>Fecha</label>
          <input type="date" id="mDate" ref={dateRef} defaultValue={T.localDStr(base)} />
        </div>
        <div className="field"><label>Hora</label>
          <input type="time" id="mTime" ref={timeRef} defaultValue={T.localTStr(base)} />
        </div>
      </div>
      <div className="field"><label>Nota</label>
        <textarea id="mNote" ref={noteRef} defaultValue={r ? (r.note || "") : ""} />
      </div>
      <div className="field"><label>Enlace (opcional)</label>
        <input type="url" id="mUrl" ref={urlRef}
          defaultValue={r ? (r.url || "") : (url || "")} placeholder="https://…" autoComplete="off" spellCheck={false} />
      </div>
      <ColorField value={colorRef.current} onChange={(h) => { colorRef.current = h; }} />
      <IconPicker icon={iconRef.current.icon} iconType={iconRef.current.iconType}
        onPick={(v) => { iconRef.current = v; }} />
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cancelar</button>
        <button className="btn primary" id="mSave" onClick={save}>Guardar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- adjuntos y enlaces de notas (porte de attachmentHTML / renderNoteLinks) ---------- */

function AttachmentEl({ a, onRemove }: { a: T.NoteAttachment; onRemove?: () => void }) {
  let body: React.ReactNode;
  if (a.kind === "image") {
    body = <img src={a.dataUrl} alt={a.name} loading="lazy" />;
  } else if (a.kind === "video") {
    body = <video controls preload="metadata" src={a.dataUrl}></video>;
  } else {
    body = (
      <a className="att-file" href={a.dataUrl} download={a.name}>
        <span className="att-ico">{T.kindIcon(a.kind)}</span>
        <span className="att-name">{a.name}</span>
        <span className="att-dl">⬇</span>
      </a>
    );
  }
  return (
    <div className="att">{body}
      {onRemove ? <button className="att-rm" title="Quitar adjunto" onClick={onRemove}>×</button> : null}
    </div>
  );
}

function NoteLinks({ n }: { n: T.NoteT }) {
  const out: React.ReactNode[] = [];
  String(n.linksText || "").split("\n").forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const asImg = t.charAt(0) === "!";
    const url = asImg ? t.slice(1).trim() : t;
    if (!/^https?:/i.test(url)) return;
    if (asImg || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url)) {
      out.push(
        <a key={"l" + i} href={url} target="_blank" rel="noopener">
          <img src={url} alt="" loading="lazy" className="nl-img" />
        </a>
      );
    } else {
      out.push(
        <a key={"l" + i} className="nl-link" href={url} target="_blank" rel="noopener">🔗 {url}</a>
      );
    }
  });
  (n.attachments || []).forEach((a, i) => out.push(<AttachmentEl key={"a" + i} a={a} />));
  if (!out.length) return null;
  return (
    <div className="nl-block"><div className="nl-label">🔗 Enlaces y archivos</div>{out}</div>
  );
}

/* ---------- editor de notas ---------- */

function NoteEditorModal({ id, title }: { id?: string; title?: string }) {
  const tc = useTC();
  const { closeModal } = useApp();
  const db = tc.db;
  const n = id ? db.notes.find((x) => x.id === id) : undefined;
  const [attachments, setAttachments] = useState<T.NoteAttachment[]>(() =>
    n ? (n.attachments || []).slice() : []);
  const [color, setColor] = useState(n ? (n.color || T.NOTE_COLORS[0]) : T.NOTE_COLORS[0]);
  const titleRef = useRef<HTMLInputElement>(null);
  const linksRef = useRef<HTMLTextAreaElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cmd = (c: string) => {
    const area = areaRef.current;
    if (!area) return;
    area.focus();
    if (c === "image") {
      const url = prompt("URL de la imagen:");
      if (url && /^https?:/i.test(url.trim())) document.execCommand("insertImage", false, url.trim());
      else if (url) tc.toast("La URL debe empezar por http(s)");
    } else {
      document.execCommand(c, false, undefined);
    }
    area.focus();
  };

  const rteBtn = (c: string, tip: string, inner: React.ReactNode) => (
    <button key={c} type="button" className="rte-btn" title={tip}
      onClick={(e) => { e.preventDefault(); cmd(c); }}>{inner}</button>
  );

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files: File[] = Array.prototype.slice.call(input.files || []);
    input.value = "";
    let pending = files.length;
    if (!pending) return;
    const done = () => { pending--; };
    files.forEach((file) => {
      if (file.size > T.MAX_ATTACH_BYTES) {
        tc.toast("«" + file.name + "» supera los 2,5 MB y no se adjuntó");
        done(); return;
      }
      const rd = new FileReader();
      rd.onload = () => {
        setAttachments((prev) => [...prev, {
          name: file.name, kind: T.noteKindOf(file), dataUrl: rd.result as string,
        }]);
        done();
      };
      rd.onerror = () => { tc.toast("No se pudo leer «" + file.name + "»"); done(); };
      rd.readAsDataURL(file);
    });
  };

  const save = async () => {
    const titleV = titleRef.current?.value.trim() || "";
    const html = T.sanitizeNoteHTML(areaRef.current ? areaRef.current.innerHTML : "");
    const plain = T.stripTags(html).trim();
    const linksText = linksRef.current?.value || "";
    if (!titleV && !plain && !attachments.length && !linksText.trim()) {
      tc.toast("La nota está vacía"); return;
    }
    const now = Date.now();
    if (n) {
      await tc.saveNote({
        ...n, title: titleV || "Sin título", html, linksText,
        color, attachments, updatedAt: now,
      });
    } else {
      await tc.createNote({
        title: titleV || "Sin título", html, linksText, color, attachments,
        pinned: false, archived: false, deletedAt: null, readLater: false,
        order: T.nextOrder(db.notes), createdAt: now, updatedAt: now,
      });
      await tc.logActivity("create", "Creaste una nota", titleV || "Sin título");
    }
    closeModal();
    tc.toast("Nota guardada");
  };

  return (
    <ModalShell wide>
      <h3>{n ? "✏️ Editar nota" : "📝 Nueva nota"}</h3>
      <div className="field"><label>Título</label>
        <input type="text" id="nTitle" ref={titleRef} maxLength={120}
          placeholder="Título de la nota…" defaultValue={n ? (n.title || "") : (title || "")} />
      </div>
      <div className="field"><label>Nota</label>
        <div className="rte-toolbar" id="rteBar">
          {rteBtn("bold", "Negrita", <b>B</b>)}
          {rteBtn("italic", "Cursiva", <i>I</i>)}
          {rteBtn("underline", "Subrayado", <u>U</u>)}
          <span className="rte-sep"></span>
          {rteBtn("insertUnorderedList", "Lista con viñetas", "•≡")}
          {rteBtn("insertOrderedList", "Lista numerada", "1≡")}
          <span className="rte-sep"></span>
          {rteBtn("justifyLeft", "Alinear a la izquierda", "⬅")}
          {rteBtn("justifyCenter", "Centrar", "⬌")}
          {rteBtn("justifyRight", "Alinear a la derecha", "➡")}
          <span className="rte-sep"></span>
          {rteBtn("image", "Insertar imagen por URL", "🖼")}
          <label className="rte-color" title="Color del texto">A
            <input type="color" id="rteColor" defaultValue="#1c1e26"
              onChange={(e) => { areaRef.current?.focus(); document.execCommand("foreColor", false, e.target.value); }} />
          </label>
          {rteBtn("removeFormat", "Quitar formato", "🧹")}
        </div>
        <div className="rte-area" id="nHtml" ref={areaRef} contentEditable={true} spellCheck={true}
          dangerouslySetInnerHTML={{ __html: n ? T.sanitizeNoteHTML(n.html || "") : "" }} />
      </div>
      <div className="field"><label>🔗 Enlaces y archivos (uno por línea)</label>
        <textarea id="nLinks" ref={linksRef} defaultValue={(n && n.linksText) || ""}
          placeholder={"https://github.com\nhttps://ejemplo.com/foto.png\n!https://cualquier-url-de-imagen"} />
        <div className="att-hint">💡 Las imágenes y gif se ven como imagen, los vídeos con reproductor, y pdf/txt/audio como botón con su nombre. Las líneas que empiezan por <b>!</b> se muestran como imagen.</div>
      </div>
      <div className="field"><label>Adjuntos</label>
        <div id="nAtts" className="att-list">
          {attachments.length ? attachments.map((a, i) => (
            <AttachmentEl key={a.name + i} a={a}
              onRemove={() => setAttachments((prev) => prev.filter((x) => x !== a))} />
          )) : <span className="att-none">Sin adjuntos.</span>}
        </div>
        <div className="att-actions">
          <button type="button" className="btn" id="nUpload" onClick={() => fileRef.current?.click()}>📎 Subir archivos locales</button>
          <span className="att-types">imágenes, gif, vídeo, pdf, txt… (máx. 2,5 MB por archivo)</span>
        </div>
        <input type="file" id="nFile" ref={fileRef} className="hidden" multiple
          accept="image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.json,.gif" onChange={onFile} />
      </div>
      <ColorField value={color} onChange={setColor} />
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Cancelar</button>
        <button className="btn primary" id="nSave" onClick={save}>Guardar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- nota a pantalla completa ---------- */

function NoteFullModal({ id }: { id: string }) {
  const tc = useTC();
  const { closeModal, openModal } = useApp();
  const n = tc.db.notes.find((x) => x.id === id);
  if (!n) return null;
  return (
    <ModalShell wide>
      <div className="note-full" style={{ background: n.color || "#fef3c7" }}>
        <div className="nf-head"><h3>{n.title || "Sin título"}</h3>
          <button className="btn" title="Cerrar" onClick={closeModal}>✕</button></div>
        <div className="nf-body" dangerouslySetInnerHTML={{ __html: T.sanitizeNoteHTML(n.html || "") }} />
        <NoteLinks n={n} />
        <div className="nf-date">Actualizada: {T.fmtDateTime(n.updatedAt)}</div>
      </div>
      <div className="modal-actions">
        <button className="btn" id="nfEdit"
          onClick={() => { closeModal(); openModal("note", { id }); }}>✏️ Editar</button>
        <button className="btn primary" onClick={closeModal}>Cerrar</button>
      </div>
    </ModalShell>
  );
}

/* ---------- selector «＋ Nuevo item» (Mis Items) ---------- */

function ItemPickModal() {
  const { closeModal, openModal } = useApp();
  const pick = (k: string) => {
    closeModal();
    if (k === "accounts" || k === "assistants") openModal("account", { coll: k });
    else if (k === "reminders") openModal("reminder", {});
  };
  return (
    <ModalShell>
      <h3>＋ Nuevo item</h3>
      <div className="item-pick">
        <button className="btn item-pick-btn" onClick={() => pick("accounts")}>🔑 Cuenta</button>
        <button className="btn item-pick-btn" onClick={() => pick("assistants")}>🤖 Asistente IA</button>
        <button className="btn item-pick-btn" onClick={() => pick("reminders")}>⏰ Recordatorio</button>
      </div>
      <div className="modal-actions"><button className="btn" onClick={closeModal}>Cancelar</button></div>
    </ModalShell>
  );
}

/* ---------- color de nota vía popover (openColorPopover) ---------- */

function ColorPickModal({ current, onPick }: { current?: string; onPick?: (hex: string) => void }) {
  const { closeModal } = useApp();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  useEffect(() => { setAnchor(anchorRef.current); }, []);
  const finish = (hex?: string) => {
    closeModal();
    if (hex && onPick) onPick(hex);
  };
  return createPortal(
    <div className="modal-overlay" style={{ background: "transparent" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) finish(); }}>
      <button ref={anchorRef} aria-hidden tabIndex={-1}
        style={{ position: "fixed", top: "42%", left: "50%", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      {anchor && (
        <ColorPopover anchor={anchor} initialHex={current || "#fff7c4"}
          onPick={(hex) => finish(hex)} onClose={() => finish()} />
      )}
    </div>,
    document.body
  );
}

/* ================= Modals() ================= */

export function Modals() {
  const { modal } = useApp();
  if (!modal) return null;
  const p = (modal.props || {}) as any;
  switch (modal.kind) {
    case "space": return <SpaceModal id={p.id} edit={p.edit} />;
    case "folder": return <FolderModal id={p.id} edit={p.edit} parentId={p.parentId} spaceId={p.spaceId} />;
    case "bookmark": return <BookmarkModal id={p.id} url={p.url} folderId={p.folderId} />;
    case "io": return <IOModal />;
    case "tags": return <TagsModal />;
    case "account": return <AccountModal id={p.id} kind={p.kind} coll={p.coll} />;
    case "reminder": return <ReminderModal id={p.id} title={p.title} url={p.url} />;
    case "note": return <NoteEditorModal id={p.id} title={p.title} />;
    case "noteFull": return <NoteFullModal id={p.id} />;
    case "itemPick": return <ItemPickModal />;
    case "colorPick": return <ColorPickModal current={p.current} onPick={p.onPick} />;
    default: return null;
  }
}
