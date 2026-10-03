/* BookDPB — tc.ts
   Tipos, constantes y utilidades portadas literalmente de TabmeCode v1.6.3
   (lib/store.js + newtab.js). El DOM/CSS es el original; solo cambia el
   almacenamiento (Supabase en vez de chrome.storage). */

export type Space = {
  id: string; name: string; color: string; icon: string; iconType: string;
  order: number; deletedAt: number | null;
};
export type Folder = {
  id: string; spaceId: string; parentId: string | null; name: string;
  color: string; icon: string; iconType: string; order: number; deletedAt: number | null;
};
export type Bookmark = {
  id: string; folderId: string | null; title: string; url: string; favicon: string;
  tags: string[]; note: string; favorite: boolean; readLater: boolean;
  createdAt: number; lastOpened: number | null; order: number; favOrder: number; deletedAt: number | null;
};
export type NoteAttachment = { name: string; kind: string; dataUrl: string };
export type NoteT = {
  id: string; title: string; html: string; linksText: string; color: string;
  pinned: boolean; archived: boolean; readLater: boolean;
  order: number; attachments: NoteAttachment[];
  createdAt: number; updatedAt: number; deletedAt: number | null;
};
export type Account = {
  id: string; name: string; url: string; username: string; email: string;
  password: string; note: string; favorite: boolean; icon: string; iconType: string;
  order: number; createdAt: number; deletedAt: number | null;
};
export type Assistant = Account;
export type Reminder = {
  id: string; title: string; when: number; note: string; url: string;
  color: string; icon: string; iconType: string; done: boolean;
  order: number; createdAt: number; deletedAt: number | null;
};
export type Activity = { id: string; type: string; text: string; detail: string; at: number };
export type Settings = {
  darkMode: boolean; activeSpaceId: string | null; activeFolderId: string | null;
  displayName: string; openInSameTab: boolean; compactMode: boolean;
  collapseFolders: boolean; sidebarPinned: boolean;
  collapsedFolders: Record<string, boolean>; expandedSpaces: Record<string, boolean>;
  expandedItems: Record<string, boolean>;
  viewModes: Record<string, string>; cardZoom: number;
  itemOrder: string[]; itemExpanded: Record<string, boolean>;
  sidebarLayout: string[]; tagColors: Record<string, string>;
};
export type DB = {
  spaces: Space[]; folders: Folder[]; bookmarks: Bookmark[]; notes: NoteT[];
  accounts: Account[]; assistants: Assistant[]; reminders: Reminder[];
  activity: Activity[]; settings: Settings;
};

/* ---------- Constantes literales del original ---------- */

export const PALETTE = ['#0ea5a5', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444',
  '#22c55e', '#64748b', '#14b8a6', '#06b6d4', '#a855f7', '#d946ef',
  '#f97316', '#eab308', '#84cc16', '#10b981'];

export const NOTE_COLORS = ['#fef3c7', '#fce7f3', '#dbeafe', '#dcfce7', '#ede9fe', '#ffedd5', '#fef9c3', '#f1f5f9'];
export const MAX_ATTACH_BYTES = Math.floor(2.5 * 1024 * 1024);

export const ICON_SUGGESTIONS = ['📁', '🖼', '🎵', '🎬', '📝', '🔧', '💡', '⭐', '🎮', '📚', '💼', '🌐',
  '🛒', '🎨', '📊', '✈️', '🍳', '💪', '🏠', '🚗', '👨‍💻', '🎓', '📧', '🔖'];
export const ICON_TABS = [['emoji', '😀 Emoji'], ['img', '🖼 Imagen']] as const;

export const VIEW_MODES = [
  ['grid', '▦', 'Cuadrícula'],
  ['list', '☰', 'Lista'],
  ['board', '▤', 'Tablero'],
];

export const HIST_ICONS: Record<string, string> =
  { create: '➕', edit: '✎', delete: '🗑', favorite: '⭐', session: '📦' };

export const TRASH_DAYS = 30;

export const DT_SPACE = 'application/x-tbc-space';
export const DT_FOLDER = 'application/x-tbc-folder';
export const DT_BOOKMARK = 'application/x-tbc-bookmark';
export const DT_ACCOUNT = 'application/x-tbc-account';
export const DT_ASSISTANT = 'application/x-tbc-assistant';
export const DT_REMINDER = 'application/x-tbc-reminder';
export const DT_NOTE = 'application/x-tbc-note';

export const ITEM_DEFS: Record<string, { label: string; icon: string; hint: string }> = {
  accounts: { label: 'Cuentas', icon: '🔑', hint: 'Usuarios y contraseñas de tus sitios' },
  assistants: { label: 'Asistentes IA', icon: '🤖', hint: 'Tus asistentes de IA favoritos' },
  reminders: { label: 'Recordatorios', icon: '⏰', hint: 'Avisos con fecha y hora' },
  favorites: { label: 'Favoritos', icon: '⭐', hint: 'Tus marcadores destacados' },
  history: { label: 'Historial', icon: '🕘', hint: 'Actividad reciente' },
  trash: { label: 'Papelera', icon: '🗑', hint: 'Elementos eliminados (30 días)' },
  readlater: { label: 'Haciendo', icon: '🔖', hint: 'En curso' },
};

/* ---------- Utilidades literales del original ---------- */

export function uid(prefix?: string): string {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
export function byOrder(a: { order?: number }, b: { order?: number }) {
  return (a.order || 0) - (b.order || 0);
}
export function nextOrder(list: { order?: number }[] | undefined): number {
  let m = 0;
  (list || []).forEach((x) => { if ((x.order || 0) > m) m = x.order || 0; });
  return m + 1;
}
/* Mueve dragId antes de beforeId (null = al final) y renumera order */
export function reorderList<T extends { id: string; order?: number }>(
  list: T[], dragId: string, beforeId: string | null): boolean {
  const from = list.findIndex((x) => x.id === dragId);
  if (from < 0 || dragId === beforeId) return false;
  const moved = list.splice(from, 1)[0];
  if (beforeId == null) {
    list.push(moved);
  } else {
    const to = list.findIndex((x) => x.id === beforeId);
    if (to < 0) list.push(moved);
    else list.splice(to, 0, moved);
  }
  list.forEach((x, i) => { x.order = i; });
  return true;
}
export function hasDT(e: React.DragEvent, type: string): boolean {
  try { return Array.prototype.indexOf.call(e.dataTransfer.types, type) >= 0; }
  catch { return false; }
}
export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}
export function faviconFor(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return 'https://www.google.com/s2/favicons?domain=' + u.hostname + '&sz=64';
  } catch { return ''; }
}
export function fmtDate(ts: number | null | undefined): string {
  try { return new Date(ts || 0).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}
export function fmtDateTime(ts: number | null | undefined): string {
  try {
    return new Date(ts || 0).toLocaleString('es-ES',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
export function localDStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
export function localTStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes());
}
/* Color de etiqueta por hash, estable entre sesiones */
export function hashColor(str: string): string {
  let h = 0;
  str = String(str || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
/* Sanea una URL de icono: solo http(s) o data:image */
export function safeIconURL(u: string | null | undefined): string {
  u = String(u || '').trim();
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(u)) return u;
  if (/^https?:\/\/[^\s<>"']+$/i.test(u)) return u;
  return '';
}
export function stripTags(html: string): string {
  if (typeof document === 'undefined') return String(html || '').replace(/<[^>]*>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '');
  return tmp.textContent || '';
}
export function sanitizeNoteHTML(html: string): string {
  if (typeof document === 'undefined') return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '');
  tmp.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
  tmp.querySelectorAll('*').forEach((el) => {
    Array.prototype.slice.call(el.attributes).forEach((a: Attr) => {
      const n = a.name.toLowerCase();
      if (n.indexOf('on') === 0) el.removeAttribute(a.name);
      if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
  });
  return tmp.innerHTML;
}
export function noteKindOf(file: { type?: string; name?: string }): string {
  const t = file.type || '';
  const name = (file.name || '').toLowerCase();
  if (t.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(name)) return 'image';
  if (t.indexOf('video/') === 0 || /\.(mp4|webm|ogv|mov)$/.test(name)) return 'video';
  if (t.indexOf('audio/') === 0 || /\.(mp3|wav|ogg|m4a)$/.test(name)) return 'audio';
  if (t === 'application/pdf' || /\.pdf$/.test(name)) return 'pdf';
  if (t.indexOf('text/') === 0 || /\.(txt|md|csv|json)$/.test(name)) return 'text';
  return 'other';
}
export function kindIcon(kind: string): string {
  return ({ image: '🖼', video: '🎬', audio: '🎵', pdf: '📄', text: '📝', other: '📎' } as Record<string, string>)[kind] || '📎';
}

/* ---------- Iconos (idénticos al original) ---------- */

export function FolderSVG({ size = 22, fill = '#ffffff' }: { size?: number; fill?: string }) {
  return (
    <svg className="folder-svg" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 6.5a2 2 0 0 1 2-2h4.1a2 2 0 0 1 1.6.8l1.5 2h7.8a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V6.5z" fill={fill} />
      <path d="M2.5 9.5h19v8a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-8z" fill={fill} fillOpacity="0.5" />
    </svg>
  );
}
export function ImgIcon({ url, size = 22 }: { url: string; size?: number }) {
  const u = safeIconURL(url);
  if (!u) return null;
  return <img className="f-img" width={size} height={size} src={u} alt="" loading="lazy"
    style={{ width: size + 'px', height: size + 'px' }} />;
}
export function FolderIconEl({ f, size = 22, fallbackFill }: { f: Partial<Folder | Space> | null; size?: number; fallbackFill?: string }) {
  if (f && f.icon) {
    if (f.iconType === 'img' && safeIconURL(f.icon)) return <ImgIcon url={f.icon} size={size} />;
    return <span className="f-emoji" style={{ fontSize: size + 'px' }}>{f.icon}</span>;
  }
  return <FolderSVG size={size} fill={fallbackFill || (f && (f as Folder).color) || '#8b9bb4'} />;
}
export function SpaceIconEl({ sp }: { sp: Partial<Space> | null }) {
  if (sp && sp.icon) {
    if (sp.iconType === 'img' && safeIconURL(sp.icon)) return <ImgIcon url={sp.icon} size={18} />;
    return <span className="f-emoji sp-emoji">{sp.icon}</span>;
  }
  return <span className="dot" style={{ background: (sp && (sp as Space).color) || '#64748b' }}></span>;
}
/* Icono de cuenta/asistente/recordatorio: imagen, emoji o logo del dominio */
export function ItemIconEl({ a, size = 40 }: { a: Partial<Account | Reminder> | null; size?: number }) {
  if (a && (a as Account).icon) {
    if ((a as Account).iconType === 'img' && safeIconURL((a as Account).icon!))
      return <ImgIcon url={(a as Account).icon!} size={size} />;
    return <span className="f-emoji" style={{ fontSize: size + 'px' }}>{(a as Account).icon}</span>;
  }
  const fav = faviconFor((a && (a as Account).url) || '');
  const letter = (((a && ((a as Account).name || (a as Reminder).title)) || '?').trim().charAt(0) || '?').toUpperCase();
  if (!fav) return <span className="fav-letter" style={{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.45) + 'px' }}>{letter}</span>;
  return <FavImg src={fav} letter={letter} size={size} />;
}
/* Favicon de marcador con respaldo a letra inicial (sin handlers inline) */
export function FavImg({ src, letter, size }: { src: string; letter: string; size?: number }) {
  const st = size ? { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.5) + 'px' } : undefined;
  return (
    <img className="fav" loading="lazy" src={src} alt="" data-letter={letter}
      style={size ? { width: size + 'px', height: size + 'px' } : undefined}
      onError={(e) => {
        const s = document.createElement('span');
        s.className = 'fav-letter';
        s.textContent = letter;
        if (st) Object.assign(s.style, st);
        e.currentTarget.replaceWith(s);
      }} />
  );
}
export function favEl(b: { favicon?: string; url: string; title: string }, size?: number) {
  const src = b.favicon || faviconFor(b.url);
  const letter = ((b.title || b.url || '?').trim().charAt(0) || '?').toUpperCase();
  if (!src) {
    return <span className="fav-letter" style={size ? { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px' } : undefined}>{letter}</span>;
  }
  return <FavImg src={src} letter={letter} size={size} />;
}

/* ---------- Árbol ---------- */
export function folderTreeIds(folders: Folder[], rootId: string): string[] {
  const out: string[] = [rootId];
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.includes(f.parentId) && !out.includes(f.id)) { out.push(f.id); grew = true; }
    }
  }
  return out;
}
export function countInTree(bookmarks: Bookmark[], folders: Folder[], folderId: string): number {
  const ids = new Set(folderTreeIds(folders, folderId));
  return bookmarks.filter((b) => b.folderId && ids.has(b.folderId) && !b.deletedAt).length;
}

export const DEFAULT_SETTINGS: Settings = {
  darkMode: false, activeSpaceId: null, activeFolderId: null,
  displayName: '', openInSameTab: false, compactMode: false,
  collapseFolders: false, sidebarPinned: false,
  collapsedFolders: {}, expandedSpaces: {}, expandedItems: {},
  viewModes: {}, cardZoom: 1, itemOrder: [], itemExpanded: {},
  sidebarLayout: [], tagColors: {},
};
