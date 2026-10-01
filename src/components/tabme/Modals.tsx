"use client";
import { useState, useEffect, useRef } from "react";
import { TABME_PALETTE, type TabmeStore, type TBookmark } from "@/lib/tabme-store";
import { X, Star, Download, Upload, Moon, Sun } from "lucide-react";
import { iconText } from "./icons";


function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="t-modal-backdrop" onClick={onClose}>
      <div className="t-modal" style={wide ? { maxWidth: 640 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-[16px] font-bold">{title}</h3>
          <button className="t-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}

// Lista plana de carpetas con indentación para un space
export function folderOptions(store: TabmeStore, spaceId: string | null): { id: string; label: string }[] {
  if (!spaceId) return [];
  const out: { id: string; label: string }[] = [];
  const walk = (parentId: string, depth: number) => {
    store.folders.filter((f) => f.parentId === parentId).forEach((f) => {
      out.push({ id: f.id, label: `${"— ".repeat(depth)}${iconText(f.icon, "📁")} ${f.name}` });
      walk(f.id, depth + 1);
    });
  };
  walk(spaceId, 0);
  return out;
}

function TagPicker({ store, selected, onChange }: { store: TabmeStore; selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  if (!store.tags.length) return <p className="text-xs" style={{ color: "var(--muted)" }}>Sin etiquetas. Créalas en la sección Etiquetas.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {store.tags.map((t) => (
        <button key={t.id} type="button" onClick={() => toggle(t.id)} className="t-chip"
          style={selected.includes(t.id) ? { borderColor: t.color, color: t.color, background: "var(--accent-soft)" } : undefined}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />#{t.name}
        </button>
      ))}
    </div>
  );
}

/* ============ Guardar marcador ============ */
export function SaveBookmarkModal({ store, onClose, preset }: {
  store: TabmeStore; onClose: () => void; preset?: { spaceId?: string; folderId?: string };
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spaceId, setSpaceId] = useState(preset?.spaceId || store.spaces[0]?.id || "");
  const [folderId, setFolderId] = useState(preset?.folderId || "");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!url.trim()) { setError("Pega una URL primero."); return; }
    setSaving(true); setError("");
    try {
      await store.createBookmark({ url, title: title || url, description, spaceId: spaceId || null, folderId: folderId || null, tagIds, favorite });
      onClose();
    } catch (e: any) { setError(e.message || "No se pudo guardar."); }
    setSaving(false);
  };

  return (
    <Shell title="🔖 Guardar marcador" onClose={onClose}>
      <Field label="URL">
        <input className="t-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ejemplo.com" autoFocus inputMode="url" />
      </Field>
      <Field label="Título">
        <input className="t-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del marcador" />
      </Field>
      <Field label="Descripción (opcional)">
        <textarea className="t-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Una nota rápida..." />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Space">
          <select className="t-input" value={spaceId} onChange={(e) => { setSpaceId(e.target.value); setFolderId(""); }}>
            {store.spaces.map((s) => <option key={s.id} value={s.id}>{iconText(s.icon, "📦")} {s.name}</option>)}
          </select>
        </Field>
        <Field label="Carpeta">
          <select className="t-input" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Sin clasificar (auto)</option>
            {folderOptions(store, spaceId).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Etiquetas">
        <TagPicker store={store} selected={tagIds} onChange={setTagIds} />
      </Field>
      <button type="button" onClick={() => setFavorite((f) => !f)} className="t-btn t-btn-ghost mb-4">
        <Star size={15} fill={favorite ? "currentColor" : "none"} style={favorite ? { color: "var(--accent)" } : undefined} />
        {favorite ? "Es favorito" : "Marcar como favorito"}
      </button>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="t-btn t-btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
      </div>
    </Shell>
  );
}

/* ============ Editar marcador ============ */
export function EditBookmarkModal({ store, bm, onClose }: { store: TabmeStore; bm: TBookmark; onClose: () => void }) {
  const [title, setTitle] = useState(bm.title);
  const [url, setUrl] = useState(bm.url);
  const [description, setDescription] = useState(bm.description || "");
  const [tagIds, setTagIds] = useState<string[]>(bm.tags.map((t) => t.id));
  // space actual de la carpeta del marcador
  const currentSpaceId = (() => {
    let pid: string | null = bm.folderId;
    const seen = new Set<string>();
    while (pid && !seen.has(pid)) {
      seen.add(pid);
      if (store.spaces.some((s) => s.id === pid)) return pid;
      pid = store.folders.find((f) => f.id === pid)?.parentId || null;
    }
    return store.spaces[0]?.id || "";
  })();
  const [spaceId, setSpaceId] = useState(currentSpaceId);
  const [folderId, setFolderId] = useState(bm.folderId || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await store.updateBookmark(bm.id, { title, url, description });
    await store.setBookmarkTags(bm.id, tagIds);
    const newFolder = folderId || null;
    if (newFolder !== bm.folderId) await store.moveBookmark(bm.id, newFolder);
    setSaving(false);
    onClose();
  };

  return (
    <Shell title="✏️ Editar marcador" onClose={onClose}>
      <Field label="Título"><input className="t-input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="URL"><input className="t-input" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" /></Field>
      <Field label="Descripción"><textarea className="t-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Space">
          <select className="t-input" value={spaceId} onChange={(e) => { setSpaceId(e.target.value); setFolderId(""); }}>
            {store.spaces.map((s) => <option key={s.id} value={s.id}>{iconText(s.icon, "📦")} {s.name}</option>)}
          </select>
        </Field>
        <Field label="Carpeta">
          <select className="t-input" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Sin carpeta</option>
            {folderOptions(store, spaceId).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Etiquetas"><TagPicker store={store} selected={tagIds} onChange={setTagIds} /></Field>
      <div className="flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="t-btn t-btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
      </div>
    </Shell>
  );
}

/* ============ Space / Carpeta ============ */
export function CollectionModal({ store, onClose, parentId, isSpace, editId }: {
  store: TabmeStore; onClose: () => void; parentId: string | null; isSpace: boolean; editId?: string;
}) {
  const existing = editId ? [...store.spaces, ...store.folders].find((c) => c.id === editId) : null;
  const [name, setName] = useState(existing?.name || "");
  const [icon, setIcon] = useState(existing?.icon || "");
  const [color, setColor] = useState(existing?.color || "default");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) { setError("Ponle un nombre."); return; }
    setSaving(true); setError("");
    try {
      if (editId) await store.updateCollection(editId, { name, icon, color });
      else await store.createCollection(name, icon, color, isSpace ? null : parentId);
      onClose();
    } catch (e: any) { setError(e.message || "No se pudo guardar."); }
    setSaving(false);
  };

  return (
    <Shell title={editId ? "✏️ Editar" : isSpace ? "📦 Nuevo space" : "📁 Nueva carpeta"} onClose={onClose}>
      <Field label="Nombre">
        <input className="t-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={isSpace ? "Ej. Trabajo" : "Ej. Herramientas IA"} autoFocus />
      </Field>
      <Field label="Icono (emoji)">
        <input className="t-input" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="📁" maxLength={4} style={{ fontSize: 20 }} />
      </Field>
      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {TABME_PALETTE.map((c) => (
            <button key={c} type="button" className={`t-swatch ${color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setColor(c)} title={c} />
          ))}
        </div>
      </Field>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="t-btn t-btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
      </div>
    </Shell>
  );
}

/* ============ Confirmar ============ */
export function ConfirmModal({ title, message, dangerLabel, onYes, onClose }: {
  title: string; message: string; dangerLabel: string; onYes: () => void; onClose: () => void;
}) {
  return (
    <Shell title={title} onClose={onClose}>
      <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{message}</p>
      <div className="flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="t-btn t-btn-danger flex-1" onClick={() => { onYes(); onClose(); }}>{dangerLabel}</button>
      </div>
    </Shell>
  );
}

/* ============ Nueva etiqueta ============ */
export function TagModal({ store, onClose }: { store: TabmeStore; onClose: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TABME_PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await store.createTag(name, color);
    setSaving(false);
    onClose();
  };
  return (
    <Shell title="🏷️ Nueva etiqueta" onClose={onClose}>
      <Field label="Nombre"><input className="t-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. ia" autoFocus /></Field>
      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {TABME_PALETTE.map((c) => (
            <button key={c} type="button" className={`t-swatch ${color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </Field>
      <div className="flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="t-btn t-btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Crear"}</button>
      </div>
    </Shell>
  );
}

/* ============ Ajustes / Importar / Exportar ============ */
export function SettingsModal({ store, onClose, theme, onToggleTheme }: {
  store: TabmeStore; onClose: () => void; theme: "dark" | "light"; onToggleTheme: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  const doImport = async (file: File) => {
    setImporting(true); setMsg("");
    try {
      const json = JSON.parse(await file.text());
      await store.importData(json);
      setMsg("✅ Importación completada.");
    } catch (e: any) { setMsg("❌ " + (e.message || "Archivo no válido.")); }
    setImporting(false);
  };

  return (
    <Shell title="⚙️ Ajustes" onClose={onClose}>
      <button className="t-btn t-btn-ghost mb-3 w-full justify-start" onClick={onToggleTheme}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      </button>
      <button className="t-btn t-btn-ghost mb-3 w-full justify-start" onClick={() => store.exportData()}>
        <Download size={16} /> Exportar respaldo (JSON)
      </button>
      <button className="t-btn t-btn-ghost mb-3 w-full justify-start" onClick={() => fileRef.current?.click()} disabled={importing}>
        <Upload size={16} /> {importing ? "Importando..." : "Importar respaldo (JSON)"}
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} />
      {msg && <p className="mb-3 text-sm">{msg}</p>}
      <div className="t-card mt-2 p-4 text-xs leading-relaxed" style={{ background: "var(--card-2)" }}>
        <p style={{ color: "var(--muted)" }}>
          📊 {store.spaces.length} spaces · {store.folders.length} carpetas · {store.bookmarks.length} marcadores · {store.notes.length} notas · {store.accounts.length} cuentas<br />
          BookDPB v2.0 — tus datos viven en tu Supabase privado.
        </p>
      </div>
    </Shell>
  );
}

/* ============ Nueva cuenta / editar ============ */
export function AccountModal({ store, onClose, editId }: { store: TabmeStore; onClose: () => void; editId?: string }) {
  const existing = editId ? store.accounts.find((a) => a.id === editId) : null;
  const [name, setName] = useState(existing?.name || "");
  const [url, setUrl] = useState(existing?.url || "");
  const [username, setUsername] = useState(existing?.username || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [password, setPassword] = useState(existing?.password || "");
  const [note, setNote] = useState(existing?.note || "");
  const [icon, setIcon] = useState(existing?.icon || "");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) { setError("Ponle un nombre."); return; }
    setSaving(true); setError("");
    try {
      const payload = { name, url, username, email, password, note, icon, iconType: icon ? "emoji" : "auto" };
      if (editId) await store.updateAccount(editId, payload);
      else await store.createAccount(payload);
      onClose();
    } catch (e: any) { setError(e.message || "No se pudo guardar."); }
    setSaving(false);
  };

  return (
    <Shell title={editId ? "✏️ Editar cuenta" : "🔑 Nueva cuenta"} onClose={onClose}>
      <Field label="Nombre"><input className="t-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Gmail" autoFocus /></Field>
      <Field label="URL"><input className="t-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Usuario"><input className="t-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario" autoComplete="off" /></Field>
        <Field label="Email"><input className="t-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@…" autoComplete="off" /></Field>
      </div>
      <Field label="Contraseña">
        <div className="flex gap-2">
          <input className="t-input" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" autoComplete="new-password" />
          <button type="button" className="t-btn t-btn-ghost" onClick={() => setShowPw((v) => !v)} title={showPw ? "Ocultar" : "Ver"}>👁</button>
        </div>
      </Field>
      <Field label="Nota"><textarea className="t-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota opcional…" /></Field>
      <Field label="Icono (emoji)"><input className="t-input" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🔑" maxLength={4} style={{ fontSize: 20 }} /></Field>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="t-btn t-btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
      </div>
    </Shell>
  );
}

/* ============ Ver cuenta (ver / copiar) ============ */
export function AccountDetailModal({ store, accountId, onClose, onEdit }: {
  store: TabmeStore; accountId: string; onClose: () => void; onEdit: () => void;
}) {
  const acc = store.accounts.find((a) => a.id === accountId);
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState("");
  if (!acc) return null;

  const copy = async (label: string, value: string | null) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(""), 1500); }
    catch { /* noop */ }
  };

  const row = (label: string, value: string | null, secret = false) => {
    if (!value && !secret) return null;
    const shown = secret ? (showPw ? (value || "—") : "••••••") : (value || "—");
    return (
      <div className="t-card mb-2 flex items-center gap-2 p-3" style={{ background: "var(--card-2)" }}>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)" }}>{label}</div>
          <div className="truncate text-[14px] font-semibold">{shown}</div>
        </div>
        {secret && (
          <button className="t-icon-btn" title={showPw ? "Ocultar" : "Ver"} onClick={() => setShowPw((v) => !v)}>👁</button>
        )}
        {value && (
          <button className="t-btn t-btn-ghost" style={{ minHeight: 34, padding: "6px 10px", fontSize: 12 }} onClick={() => copy(label, value)}>
            {copied === label ? "✓ Copiado" : "⧉ Copiar"}
          </button>
        )}
      </div>
    );
  };

  return (
    <Shell title={`🔑 ${acc.name}`} onClose={onClose}>
      {acc.url && (
        <a href={acc.url} target="_blank" rel="noopener noreferrer" className="t-btn t-btn-primary mb-3 w-full">↗ Abrir {acc.url.replace(/^https?:\/\//, "").split("/")[0]}</a>
      )}
      {row("Usuario", acc.username)}
      {row("Email", acc.email)}
      {row("Contraseña", acc.password, true)}
      {acc.note && (
        <div className="t-card mb-2 p-3" style={{ background: "var(--card-2)" }}>
          <div className="text-[11px] font-bold uppercase" style={{ color: "var(--muted)" }}>Nota</div>
          <div className="text-[14px]">{acc.note}</div>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cerrar</button>
        <button className="t-btn t-btn-primary flex-1" onClick={onEdit}>✏️ Editar</button>
      </div>
    </Shell>
  );
}

/* ============ Nuevo asistente / editar ============ */
export function AssistantModal({ store, onClose, editId }: { store: TabmeStore; onClose: () => void; editId?: string }) {
  const existing = editId ? store.assistants.find((a) => a.id === editId) : null;
  const [name, setName] = useState(existing?.name || "");
  const [url, setUrl] = useState(existing?.url || "");
  const [note, setNote] = useState(existing?.note || "");
  const [icon, setIcon] = useState(existing?.icon || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) { setError("Ponle un nombre."); return; }
    setSaving(true); setError("");
    try {
      const payload = { name, url, note, icon, iconType: icon ? "emoji" : "auto" };
      if (editId) await store.updateAssistant(editId, payload);
      else await store.createAssistant(payload);
      onClose();
    } catch (e: any) { setError(e.message || "No se pudo guardar."); }
    setSaving(false);
  };

  return (
    <Shell title={editId ? "✏️ Editar asistente" : "🤖 Nuevo asistente IA"} onClose={onClose}>
      <Field label="Nombre"><input className="t-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. ChatGPT" autoFocus /></Field>
      <Field label="URL"><input className="t-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" /></Field>
      <Field label="Nota"><input className="t-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Plan Plus" /></Field>
      <Field label="Icono (emoji)"><input className="t-input" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🤖" maxLength={4} style={{ fontSize: 20 }} /></Field>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="t-btn t-btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
      </div>
    </Shell>
  );
}

/* ============ Nuevo recordatorio / editar ============ */
export function ReminderModal({ store, onClose, editId }: { store: TabmeStore; onClose: () => void; editId?: string }) {
  const existing = editId ? store.reminders.find((r) => r.id === editId) : null;
  const [text, setText] = useState(existing?.text || "");
  const [remindAt, setRemindAt] = useState(existing?.remindAt ? existing.remindAt.slice(0, 16) : "");
  const [icon, setIcon] = useState(existing?.icon || "⏰");
  const [color, setColor] = useState(existing?.color || "default");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!text.trim()) { setError("Escribe el recordatorio."); return; }
    setSaving(true); setError("");
    try {
      const payload = { text, remindAt: remindAt ? new Date(remindAt).toISOString() : null, icon, color };
      if (editId) await store.updateReminder(editId, payload);
      else await store.createReminder(payload);
      onClose();
    } catch (e: any) { setError(e.message || "No se pudo guardar."); }
    setSaving(false);
  };

  return (
    <Shell title={editId ? "✏️ Editar recordatorio" : "⏰ Nuevo recordatorio"} onClose={onClose}>
      <Field label="Texto"><input className="t-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej. Revisar el respaldo" autoFocus /></Field>
      <Field label="Fecha y hora"><input className="t-input" type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Icono"><input className="t-input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} style={{ fontSize: 20 }} /></Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {TABME_PALETTE.map((c) => (
              <button key={c} type="button" className={`t-swatch ${color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </Field>
      </div>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="t-btn t-btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
      </div>
    </Shell>
  );
}

/* ============ Elegir tipo de item ============ */
export function NewItemModal({ onClose, onPick }: { onClose: () => void; onPick: (k: "account" | "assistant" | "reminder") => void }) {
  return (
    <Shell title="＋ Nuevo item" onClose={onClose}>
      <div className="flex flex-col gap-2">
        <button className="t-btn t-btn-ghost w-full justify-start" onClick={() => onPick("account")}>🔑 Cuenta</button>
        <button className="t-btn t-btn-ghost w-full justify-start" onClick={() => onPick("assistant")}>🤖 Asistente IA</button>
        <button className="t-btn t-btn-ghost w-full justify-start" onClick={() => onPick("reminder")}>⏰ Recordatorio</button>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="t-btn t-btn-ghost flex-1" onClick={onClose}>Cancelar</button>
      </div>
    </Shell>
  );
}

/* ============ Ayuda ============ */
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="❓ Ayuda de BookDPB" onClose={onClose} wide>
      <div className="help-sec">
        <h4>🗂 Spaces y carpetas</h4>
        <p>Los <b>spaces</b> son tus grandes áreas (trabajo, personal…). Dentro van <b>carpetas</b> y <b>subcarpetas</b> sin límite de niveles. Pasa el ratón sobre una fila del sidebar para ver <b>＋</b> (nueva subcarpeta), <b>✎</b> (editar) y <b>×</b> (eliminar). Arrastra las filas para reordenarlas.</p>
      </div>
      <div className="help-sec">
        <h4>🔖 Marcadores</h4>
        <ul>
          <li><b>Arrastrar</b> una tarjeta a un space o carpeta la mueve allí.</li>
          <li>Al pasar el ratón sobre la tarjeta: <b>⭐/☆</b> favorito, <b>🔖</b> leer después, <b>✎</b> editar, <b>×</b> papelera.</li>
          <li><b>Todas las carpetas</b> muestra cada carpeta como tarjeta con sus favoritos.</li>
        </ul>
      </div>
      <div className="help-sec">
        <h4>🗂 Mis Items</h4>
        <p>Agrupa <b>⭐ Favoritos</b>, <b>🔑 Cuentas</b> (usuario, email, contraseña con ver/copiar), <b>🤖 Asistentes IA</b>, <b>⏰ Recordatorios</b>, <b>🕘 Historial</b>, <b>🗑 Papelera</b> y <b>🔖 Leer después</b>. Las filas se reordenan arrastrando.</p>
      </div>
      <div className="help-sec">
        <h4>⬆️ Barra superior</h4>
        <ul>
          <li><b>💾</b> Guardar respaldo (descarga un JSON con todo).</li>
          <li><b>📑</b> Detectar duplicados (misma URL guardada varias veces).</li>
          <li><b>📁＋ / 🔖＋ / ✏️</b> Nueva carpeta, nuevo marcador, nueva nota.</li>
          <li><b>⚙️</b> Ajustes, importar/exportar y tema claro/oscuro.</li>
        </ul>
      </div>
      <div className="help-sec">
        <h4>⌨️ Atajos</h4>
        <p>Pulsa <b>/</b> en cualquier momento para ir al buscador.</p>
      </div>
      <div className="flex gap-2">
        <button className="t-btn t-btn-primary flex-1" onClick={onClose}>Entendido</button>
      </div>
    </Shell>
  );
}

