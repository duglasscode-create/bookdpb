/* BookDPB — tc-store.tsx
   Capa de datos: mismo modelo que TabmeCode v1.6.3 (S.* + DB), persistido en
   Supabase en vez de chrome.storage.local. Sin borrar ni modificar datos
   existentes: todas las migraciones de esquema son aditivas (ver
   supabase-migracion-v2.1.sql) y la lectura es defensiva. */
"use client";
import React, {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import * as T from "./tc";

const ts = (v: string | number | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const t = typeof v === "number" ? v : new Date(v).getTime();
  return isNaN(t) ? null : t;
};
const iso = (t: number | null | undefined): string | null =>
  t ? new Date(t).toISOString() : null;

type Ctx = {
  userId: string;
  db: T.DB;
  loading: boolean;
  refresh: () => Promise<void>;
  toasts: { id: number; msg: string }[];
  toast: (msg: string) => void;
  openUrl: (url: string) => void;
  /* spaces / folders */
  saveSpace: (sp: T.Space) => Promise<void>;
  createSpace: (name: string, color: string, icon: string, iconType: string) => Promise<T.Space>;
  trashSpace: (id: string) => Promise<void>;
  restoreSpace: (id: string) => Promise<void>;
  purgeSpace: (id: string) => Promise<void>;
  reorderSpaces: (dragId: string, beforeId: string | null) => Promise<void>;
  saveFolder: (f: T.Folder) => Promise<void>;
  createFolder: (spaceId: string, parentId: string | null, name: string, color: string, icon: string, iconType: string) => Promise<T.Folder>;
  trashFolder: (id: string) => Promise<void>;
  restoreFolder: (id: string) => Promise<void>;
  purgeFolder: (id: string) => Promise<void>;
  reorderFolders: (dragId: string, beforeId: string | null) => Promise<void>;
  moveBookmarkTo: (bookmarkId: string, targetId: string | null) => Promise<void>;
  /* bookmarks */
  saveBookmark: (b: T.Bookmark) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleReadLater: (id: string) => Promise<void>;
  markBookmarkOpened: (id: string) => Promise<void>;
  moveNoteToEnd: (dragId: string) => Promise<void>;
  removeDuplicateBookmarks: () => Promise<number>;
  exportJSON: () => void; exportHTML: () => void; exportCSV: () => void; exportTXT: () => void;
  parseImportFile: (file: File) => Promise<{ fullBackup?: any; items: { title: string; url: string; tags: string[]; note: string }[] }>;
  ingestImportItems: (items: { title: string; url: string; tags: string[]; note: string }[], spaceId: string, folderName: string) => Promise<number>;
  createBookmark: (input: { url: string; title: string; note?: string; folderId?: string | null; tags?: string[]; favorite?: boolean }) => Promise<T.Bookmark>;
  trashBookmark: (id: string) => Promise<void>;
  restoreBookmark: (id: string) => Promise<void>;
  purgeBookmark: (id: string) => Promise<void>;
  reorderBookmarks: (folderId: string | null, dragId: string, beforeId: string | null) => Promise<void>;
  reorderFavorites: (dragId: string, beforeId: string | null) => Promise<void>;
  trashBookmarks: (ids: string[]) => Promise<void>;
  moveBookmarks: (ids: string[], folderId: string) => Promise<void>;
  /* tags */
  createTag: (name: string, color?: string) => Promise<void>;
  renameTag: (oldName: string, newName: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  setTagColor: (name: string, color: string) => Promise<void>;
  /* notes */
  saveNote: (n: T.NoteT) => Promise<void>;
  toggleNotePin: (id: string) => Promise<void>;
  toggleNoteReadLater: (id: string) => Promise<void>;
  createNote: (n: Partial<T.NoteT>) => Promise<T.NoteT>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  purgeNote: (id: string) => Promise<void>;
  reorderNotes: (dragId: string, beforeId: string | null) => Promise<void>;
  /* accounts / assistants */
  saveAccount: (a: T.Account) => Promise<void>;
  toggleAccountFavorite: (id: string) => Promise<void>;
  createAccount: (a: Partial<T.Account>) => Promise<T.Account>;
  trashAccount: (id: string) => Promise<void>;
  restoreAccount: (id: string) => Promise<void>;
  purgeAccount: (id: string) => Promise<void>;
  reorderAccounts: (dragId: string, beforeId: string | null) => Promise<void>;
  saveAssistant: (a: T.Assistant) => Promise<void>;
  toggleAssistantFavorite: (id: string) => Promise<void>;
  createAssistant: (a: Partial<T.Assistant>) => Promise<T.Assistant>;
  trashAssistant: (id: string) => Promise<void>;
  restoreAssistant: (id: string) => Promise<void>;
  purgeAssistant: (id: string) => Promise<void>;
  reorderAssistants: (dragId: string, beforeId: string | null) => Promise<void>;
  /* reminders */
  saveReminder: (r: T.Reminder) => Promise<void>;
  toggleReminderDone: (id: string) => Promise<void>;
  createReminder: (r: Partial<T.Reminder>) => Promise<T.Reminder>;
  trashReminder: (id: string) => Promise<void>;
  restoreReminder: (id: string) => Promise<void>;
  purgeReminder: (id: string) => Promise<void>;
  reorderReminders: (dragId: string, beforeId: string | null) => Promise<void>;
  /* activity + trash */
  logActivity: (type: string, text: string, detail?: string) => Promise<void>;
  clearActivity: () => Promise<void>;
  emptyTrash: () => Promise<void>;
  /* settings */
  updateSettings: (patch: Partial<T.Settings>) => void;
};

export const TCContext = createContext<Ctx | null>(null);
export const useTC = () => {
  const c = useContext(TCContext);
  if (!c) throw new Error("useTC fuera de TCProvider");
  return c;
};

export function TCProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [dbState, setDbState] = useState<T.DB>(() => ({
    spaces: [], folders: [], bookmarks: [], notes: [],
    accounts: [], assistants: [], reminders: [], activity: [],
    settings: { ...T.DEFAULT_SETTINGS },
  }));
  /* Ref espejo síncrono: permite leer el estado justo después de escribirlo
     sin depender de que React haya procesado el re-render. */
  const dbRef = useRef(dbState);
  const setDb = useCallback((updater: ((d: T.DB) => T.DB) | T.DB) => {
    const next = typeof updater === "function" ? updater(dbRef.current) : updater;
    dbRef.current = next;
    setDbState(next);
  }, []);
  const getDb = useCallback(() => dbRef.current, []);
  const db = dbState;
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const toastId = useRef(1);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsReady = useRef(false);

  const toast = useCallback((msg: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const openUrl = useCallback((url: string) => {
    if (!url) return;
    setDb((d) => d); // noop para eslint
    const sameTab = (window as unknown as { __tcSettings?: T.Settings }).__tcSettings?.openInSameTab;
    if (sameTab) window.location.href = url;
    else window.open(url, "_blank", "noopener");
  }, []);

  /* ---------- carga ---------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cols, bms, rels, tgs, bt, nts, acc, asi, rem, act, setRow] = await Promise.all([
        supabase.from("collections").select("*").eq("user_id", userId).order("position", { ascending: true }),
        supabase.from("bookmarks").select("*").eq("user_id", userId),
        supabase.from("bookmark_collections").select("bookmark_id, collection_id").eq("user_id", userId),
        supabase.from("tags").select("id, name, color").eq("user_id", userId),
        supabase.from("bookmark_tags").select("bookmark_id, tag_id").eq("user_id", userId),
        supabase.from("notes").select("*").eq("user_id", userId),
        supabase.from("accounts").select("*").eq("user_id", userId),
        supabase.from("assistants").select("*").eq("user_id", userId),
        supabase.from("reminders").select("*").eq("user_id", userId),
        supabase.from("activity_log").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
        supabase.from("user_settings").select("data").eq("user_id", userId).maybeSingle(),
      ]);
      const colRows: Record<string, any>[] = (cols.data || []) as Record<string, any>[];
      const spaceRows = colRows.filter((c) => !c.parent_id && !(c as any).is_deleted);
      const folderRows = colRows.filter((c) => c.parent_id);
      const spaces: T.Space[] = spaceRows.map((c: any, i: number) => ({
        id: c.id, name: c.name || "Space", color: c.color || T.PALETTE[0],
        icon: c.icon || "", iconType: c.icon_type || "emoji",
        order: c.position ?? i, deletedAt: ts(c.deleted_at),
      }));
      const spaceIds = new Set(spaces.map((s) => s.id));
      const folders: T.Folder[] = folderRows.map((c: any, i: number) => {
        // spaceId: subir por la cadena de padres hasta dar con un space
        let sid: string | null = null;
        let p: string | undefined = c.parent_id;
        const seen = new Set<string>();
        const byId = new Map(colRows.map((r: any) => [r.id, r]));
        while (p && !seen.has(p)) {
          seen.add(p);
          if (spaceIds.has(p)) { sid = p; break; }
          const pr: any = byId.get(p);
          p = pr ? pr.parent_id : undefined;
        }
        return {
          id: c.id, spaceId: sid || "", parentId: (spaceIds.has(c.parent_id) ? null : c.parent_id) || null,
          name: c.name || "Carpeta", color: c.color || T.PALETTE[1],
          icon: c.icon || "", iconType: c.icon_type || "emoji",
          order: c.position ?? i, deletedAt: ts(c.deleted_at),
        };
      });

      const relMap = new Map<string, string>();
      ((rels.data || []) as any[]).forEach((r) => { if (!relMap.has(r.bookmark_id)) relMap.set(r.bookmark_id, r.collection_id); });
      const tagById = new Map<string, { id: string; name: string; color: string }>();
      ((tgs.data || []) as any[]).forEach((t) => tagById.set(t.id, { id: t.id, name: t.name, color: t.color }));
      const tagMap = new Map<string, string[]>();
      ((bt.data || []) as any[]).forEach((r) => {
        const t = tagById.get(r.tag_id);
        if (t) { const arr = tagMap.get(r.bookmark_id) || []; arr.push(t.name); tagMap.set(r.bookmark_id, arr); }
      });
      const bookmarks: T.Bookmark[] = ((bms.data || []) as any[]).map((b, i) => ({
        id: b.id, folderId: relMap.get(b.id) || null,
        title: b.title || b.url, url: b.url, favicon: b.icon || "",
        tags: tagMap.get(b.id) || [], note: b.description || "",
        favorite: !!b.is_favorite, readLater: b.read_status === "pending",
        createdAt: ts(b.created_at) || Date.now(),
        lastOpened: ts(b.last_opened),
        order: b.order_num ?? i,
        favOrder: b.fav_order ?? 0,
        deletedAt: b.is_deleted ? (ts(b.deleted_at) || Date.now()) : null,
      }));
      const notes: T.NoteT[] = ((nts.data || []) as any[]).map((n: any, i: number) => ({
        id: n.id, title: n.title || "Sin título", html: n.content || "",
        linksText: n.links_text || "", color: n.color && /^#/.test(n.color) ? n.color : T.NOTE_COLORS[0],
        pinned: !!n.pinned, archived: !!n.archived, readLater: !!n.read_later,
        order: n.position ?? i,
        attachments: Array.isArray(n.attachments) ? n.attachments : [],
        createdAt: ts(n.created_at) || Date.now(), updatedAt: ts(n.updated_at) || Date.now(),
        deletedAt: n.deleted || n.is_deleted ? (ts(n.deleted_at) || Date.now()) : null,
      }));
      const accounts: T.Account[] = ((acc.data || []) as any[]).map((a: any, i: number) => ({
        id: a.id, name: a.name || "", url: a.url || "", username: a.username || "",
        email: a.email || "", password: a.password || "", note: a.note || "", favorite: !!a.is_favorite,
        icon: a.icon || "", iconType: a.icon_type || "auto",
        order: a.position ?? i, createdAt: ts(a.created_at) || Date.now(),
        deletedAt: a.is_deleted ? (ts(a.deleted_at) || Date.now()) : null,
      }));
      const assistants: T.Assistant[] = ((asi.data || []) as any[]).map((a: any, i: number) => ({
        id: a.id, name: a.name || "", url: a.url || "", username: a.username || "",
        email: a.email || "", password: a.password || "", note: a.note || "", favorite: !!a.is_favorite,
        icon: a.icon || "", iconType: a.icon_type || "auto",
        order: a.position ?? i, createdAt: ts(a.created_at) || Date.now(),
        deletedAt: a.is_deleted ? (ts(a.deleted_at) || Date.now()) : null,
      }));
      const reminders: T.Reminder[] = ((rem.data || []) as any[]).map((r: any, i: number) => ({
        id: r.id, title: r.text || r.title || "", when: ts(r.remind_at) || Date.now(),
        note: r.note || "", url: r.url || "", color: r.color || T.NOTE_COLORS[0],
        icon: r.icon || "⏰", iconType: r.icon_type || "emoji", done: !!r.done,
        order: r.position ?? i, createdAt: ts(r.created_at) || Date.now(),
        deletedAt: r.is_deleted ? (ts(r.deleted_at) || Date.now()) : null,
      }));
      const activity: T.Activity[] = ((act.data || []) as any[]).map((a: any) => ({
        id: a.id, type: a.action || "create",
        text: a.details || "", detail: a.entity_name || "", at: ts(a.created_at) || Date.now(),
      }));
      let settings: T.Settings = { ...T.DEFAULT_SETTINGS };
      if (setRow.data && (setRow.data as any).data) {
        settings = { ...T.DEFAULT_SETTINGS, ...((setRow.data as any).data as object) };
      }

      setDb({ spaces, folders, bookmarks, notes, accounts, assistants, reminders, activity, settings });
      (window as unknown as { __tcSettings?: T.Settings }).__tcSettings = settings;
      settingsReady.current = true;

      /* Aviso de recordatorios vencidos al abrir (la app solo avisa con la app abierta) */
      const due = reminders.filter((r) => !r.done && !r.deletedAt && r.when < Date.now());
      if (due.length) {
        setTimeout(() => toast(`⏰ Tienes ${due.length} recordatorio(s) vencido(s)`), 1200);
      }
    } catch (e) {
      console.error("Error cargando BookDPB:", e);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { load(); }, [load]);

  /* ---------- settings (persistencia diferida) ---------- */
  const updateSettings = useCallback((patch: Partial<T.Settings>) => {
    setDb((d) => {
      const settings = { ...d.settings, ...patch };
      (window as unknown as { __tcSettings?: T.Settings }).__tcSettings = settings;
      return { ...d, settings };
    });
  }, []);
  useEffect(() => {
    if (!settingsReady.current) return;
    if (settingsTimer.current) clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(async () => {
      try {
        const data = (await (async () => {
          let s: T.Settings | null = null;
          setDb((d) => { s = d.settings; return d; });
          return s;
        })());
        await supabase.from("user_settings").upsert(
          { user_id: userId, data: data as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
          { onConflict: "user_id" });
      } catch { /* la tabla puede no existir aún: se sigue en memoria */ }
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.settings]);

  /* ---------- helpers genéricos ---------- */
  const logActivity = useCallback(async (type: string, text: string, detail?: string) => {
    const entry = { id: T.uid("a"), type, text, detail: detail || "", at: Date.now() };
    setDb((d) => ({ ...d, activity: [entry, ...d.activity].slice(0, 500) }));
    try {
      await supabase.from("activity_log").insert({
        user_id: userId, action: type, entity_type: "", entity_id: null,
        entity_name: detail || null, details: text,
      });
    } catch { /* no bloquea */ }
  }, [supabase, userId]);

  const clearActivity = useCallback(async () => {
    setDb((d) => ({ ...d, activity: [] }));
    await supabase.from("activity_log").delete().eq("user_id", userId);
  }, [supabase, userId]);

  /* ----- collections (spaces + folders) ----- */
  const colRow = (kind: "space" | "folder", x: T.Space | T.Folder, parentId: string | null) => ({
    user_id: userId,
    name: x.name, color: x.color, icon: x.icon || null, icon_type: (x as T.Folder).iconType || "emoji",
    position: x.order ?? 0, parent_id: parentId,
    is_deleted: !!x.deletedAt, deleted_at: iso(x.deletedAt),
  });

  const saveSpace = useCallback(async (sp: T.Space) => {
    setDb((d) => ({ ...d, spaces: d.spaces.map((s) => (s.id === sp.id ? sp : s)) }));
    await supabase.from("collections").update({
      name: sp.name, color: sp.color, icon: sp.icon || null, icon_type: sp.iconType,
      position: sp.order, is_deleted: !!sp.deletedAt, deleted_at: iso(sp.deletedAt),
    }).eq("id", sp.id);
  }, [supabase]);

  const createSpace = useCallback(async (name: string, color: string, icon: string, iconType: string) => {
    const sp: T.Space = {
      id: T.uid("sp"), name, color, icon, iconType,
      order: 0, deletedAt: null,
    };
    setDb((d) => { sp.order = T.nextOrder(d.spaces); return { ...d, spaces: [...d.spaces, sp] }; });
    const { data } = await supabase.from("collections").insert({
      ...colRow("space", sp, null), position: sp.order,
    }).select("id").single();
    if (data && (data as any).id && (data as any).id !== sp.id) {
      const nid = (data as any).id as string;
      setDb((d) => ({ ...d, spaces: d.spaces.map((s) => (s.id === sp.id ? { ...s, id: nid } : s)) }));
      return { ...sp, id: nid };
    }
    return sp;
  }, [supabase, userId]);

  const trashSpace = useCallback(async (id: string) => {
    const now = Date.now();
    setDb((d) => {
      const fids = new Set(d.folders.filter((f) => f.spaceId === id).map((f) => f.id));
      return {
        ...d,
        spaces: d.spaces.map((s) => (s.id === id ? { ...s, deletedAt: now } : s)),
        folders: d.folders.map((f) => (f.spaceId === id ? { ...f, deletedAt: now } : f)),
        bookmarks: d.bookmarks.map((b) => (b.folderId && fids.has(b.folderId) ? { ...b, deletedAt: now } : b)),
      };
    });
    const cur = getDb();
    const fids = cur.folders.filter((f) => f.spaceId === id).map((f) => f.id);
    await supabase.from("collections").update({ is_deleted: true, deleted_at: new Date(now).toISOString() })
      .eq("user_id", userId).in("id", [id, ...fids]);
    const bmIds = cur.bookmarks.filter((b) => b.folderId && fids.includes(b.folderId)).map((b) => b.id);
    if (bmIds.length) await supabase.from("bookmarks").update({ is_deleted: true, deleted_at: new Date(now).toISOString() }).in("id", bmIds);
  }, [supabase, userId, setDb, getDb]);

  const restoreSpace = useCallback(async (id: string) => {
    setDb((d) => {
      const fids = new Set(d.folders.filter((f) => f.spaceId === id).map((f) => f.id));
      return {
        ...d,
        spaces: d.spaces.map((s) => (s.id === id ? { ...s, deletedAt: null } : s)),
        folders: d.folders.map((f) => (f.spaceId === id ? { ...f, deletedAt: null } : f)),
        bookmarks: d.bookmarks.map((b) => (b.folderId && fids.has(b.folderId) ? { ...b, deletedAt: null } : b)),
      };
    });
    const cur = getDb();
    const fids = cur.folders.filter((f) => f.spaceId === id).map((f) => f.id);
    await supabase.from("collections").update({ is_deleted: false, deleted_at: null })
      .eq("user_id", userId).in("id", [id, ...fids]);
    const bmIds = cur.bookmarks.filter((b) => b.folderId && fids.includes(b.folderId)).map((b) => b.id);
    if (bmIds.length) await supabase.from("bookmarks").update({ is_deleted: false, deleted_at: null }).in("id", bmIds);
  }, [supabase, userId, setDb, getDb]);

  const purgeSpace = useCallback(async (id: string) => {
    const cur = getDb();
    const fids = cur.folders.filter((f) => f.spaceId === id).map((f) => f.id);
    const bmIds = cur.bookmarks.filter((b) => b.folderId && fids.includes(b.folderId)).map((b) => b.id);
    setDb((d) => ({
      ...d,
      spaces: d.spaces.filter((s) => s.id !== id),
      folders: d.folders.filter((f) => f.spaceId !== id),
      bookmarks: d.bookmarks.filter((b) => !(b.folderId && fids.includes(b.folderId))),
    }));
    if (bmIds.length) {
      await supabase.from("bookmark_tags").delete().in("bookmark_id", bmIds);
      await supabase.from("bookmark_collections").delete().in("bookmark_id", bmIds);
      await supabase.from("bookmarks").delete().in("id", bmIds);
    }
    await supabase.from("collections").delete().eq("user_id", userId).in("id", [id, ...fids]);
  }, [supabase, userId, setDb, getDb]);

  const reorderSpaces = useCallback(async (dragId: string, beforeId: string | null) => {
    let list: T.Space[] = [];
    setDb((d) => {
      list = d.spaces.filter((s) => !s.deletedAt).slice().sort(T.byOrder);
      if (!T.reorderList(list, dragId, beforeId)) return d;
      const m = new Map(list.map((s) => [s.id, s.order]));
      return { ...d, spaces: d.spaces.map((s) => (m.has(s.id) ? { ...s, order: m.get(s.id)! } : s)) };
    });
    await Promise.all(list.map((s) =>
      supabase.from("collections").update({ position: s.order }).eq("id", s.id)));
  }, [supabase]);

  const saveFolder = useCallback(async (f: T.Folder) => {
    const parentId = f.parentId || f.spaceId;
    setDb((d) => ({ ...d, folders: d.folders.map((x) => (x.id === f.id ? f : x)) }));
    await supabase.from("collections").update({
      name: f.name, color: f.color, icon: f.icon || null, icon_type: f.iconType,
      position: f.order, parent_id: parentId,
      is_deleted: !!f.deletedAt, deleted_at: iso(f.deletedAt),
    }).eq("id", f.id);
  }, [supabase]);

  const createFolder = useCallback(async (spaceId: string, parentId: string | null, name: string, color: string, icon: string, iconType: string) => {
    const f: T.Folder = {
      id: T.uid("f"), spaceId, parentId, name, color, icon, iconType, order: 0, deletedAt: null,
    };
    setDb((d) => { f.order = T.nextOrder(d.folders); return { ...d, folders: [...d.folders, f] }; });
    const { data } = await supabase.from("collections").insert({
      ...colRow("folder", f, parentId || spaceId), position: f.order,
    }).select("id").single();
    if (data && (data as any).id && (data as any).id !== f.id) {
      const nid = (data as any).id as string;
      setDb((d) => ({ ...d, folders: d.folders.map((x) => (x.id === f.id ? { ...x, id: nid } : x)) }));
      return { ...f, id: nid };
    }
    return f;
  }, [supabase, userId]);

  const trashFolder = useCallback(async (id: string) => {
    const now = Date.now();
    const ids = T.folderTreeIds(getDb().folders, id);
    const idSet = new Set(ids);
    setDb((d) => ({
      ...d,
      folders: d.folders.map((f) => (idSet.has(f.id) ? { ...f, deletedAt: now } : f)),
      bookmarks: d.bookmarks.map((b) => (b.folderId && idSet.has(b.folderId) ? { ...b, deletedAt: now } : b)),
    }));
    await supabase.from("collections").update({ is_deleted: true, deleted_at: new Date(now).toISOString() })
      .eq("user_id", userId).in("id", ids);
    const bmIds = getDb().bookmarks.filter((b) => b.folderId && ids.includes(b.folderId)).map((b) => b.id);
    if (bmIds.length) await supabase.from("bookmarks").update({ is_deleted: true, deleted_at: new Date(now).toISOString() }).in("id", bmIds);
  }, [supabase, userId, setDb, getDb]);

  const restoreFolder = useCallback(async (id: string) => {
    const ids = T.folderTreeIds(getDb().folders, id);
    const idSet = new Set(ids);
    setDb((d) => ({
      ...d,
      folders: d.folders.map((f) => (idSet.has(f.id) ? { ...f, deletedAt: null } : f)),
      bookmarks: d.bookmarks.map((b) => (b.folderId && idSet.has(b.folderId) ? { ...b, deletedAt: null } : b)),
    }));
    await supabase.from("collections").update({ is_deleted: false, deleted_at: null })
      .eq("user_id", userId).in("id", ids);
    const bmIds = getDb().bookmarks.filter((b) => b.folderId && ids.includes(b.folderId)).map((b) => b.id);
    if (bmIds.length) await supabase.from("bookmarks").update({ is_deleted: false, deleted_at: null }).in("id", bmIds);
  }, [supabase, userId, setDb, getDb]);

  const purgeFolder = useCallback(async (id: string) => {
    const cur = getDb();
    const ids = T.folderTreeIds(cur.folders, id);
    const bmIds = cur.bookmarks.filter((b) => b.folderId && ids.includes(b.folderId)).map((b) => b.id);
    setDb((d) => ({
      ...d,
      folders: d.folders.filter((f) => !ids.includes(f.id)),
      bookmarks: d.bookmarks.filter((b) => !bmIds.includes(b.id)),
    }));
    if (bmIds.length) {
      await supabase.from("bookmark_tags").delete().in("bookmark_id", bmIds);
      await supabase.from("bookmark_collections").delete().in("bookmark_id", bmIds);
      await supabase.from("bookmarks").delete().in("id", bmIds);
    }
    await supabase.from("collections").delete().eq("user_id", userId).in("id", ids);
  }, [supabase, userId, setDb, getDb]);

  const reorderFolders = useCallback(async (dragId: string, beforeId: string | null) => {
    const st = { list: [] as T.Folder[], spaceId: "", parent: null as string | null };
    setDb((d) => {
      const drag = d.folders.find((f) => f.id === dragId);
      if (!drag) return d;
      st.spaceId = drag.spaceId; st.parent = drag.parentId || null;
      st.list = d.folders.filter((f) => f.spaceId === st.spaceId && (f.parentId || null) === st.parent && !f.deletedAt).sort(T.byOrder);
      if (!T.reorderList(st.list, dragId, beforeId)) return d;
      const m = new Map(st.list.map((f) => [f.id, f.order]));
      return { ...d, folders: d.folders.map((f) => (m.has(f.id) ? { ...f, order: m.get(f.id)! } : f)) };
    });
    await Promise.all(st.list.map((f) =>
      supabase.from("collections").update({ position: f.order }).eq("id", f.id)));
  }, [supabase]);

  const moveBookmarkTo = useCallback(async (bookmarkId: string, targetId: string | null) => {
    // targetId puede ser space, carpeta o null (sin carpeta)
    const d0 = getDb();
    let folderId: string | null = targetId;
    if (targetId && d0.spaces.some((s) => s.id === targetId)) {
      const kids = d0.folders.filter((f) => f.spaceId === targetId && !f.parentId && !f.deletedAt).sort(T.byOrder);
      if (kids.length === 0) {
        // crea "Sin clasificar" como el original
        const nf = await createFolder(targetId, null, "Sin clasificar", "#64748b", "", "emoji");
        folderId = nf.id;
      } else folderId = kids[0].id;
    }
    setDb((d) => ({
      ...d,
      bookmarks: d.bookmarks.map((b) => (b.id === bookmarkId ? { ...b, folderId } : b)),
    }));
    await supabase.from("bookmark_collections").delete().eq("bookmark_id", bookmarkId).eq("user_id", userId);
    if (folderId) {
      await supabase.from("bookmark_collections").insert({
        bookmark_id: bookmarkId, collection_id: folderId, user_id: userId,
      });
    }
    const b = getDb().bookmarks.find((x) => x.id === bookmarkId);
    await logActivity("edit", "Moviste un marcador", b?.title || "");
  }, [supabase, userId, createFolder, logActivity, setDb, getDb]);

  /* ----- bookmarks ----- */
  const bmRow = (b: T.Bookmark) => ({
    user_id: userId, url: b.url, title: b.title, description: b.note || null,
    icon: b.favicon || null, is_favorite: b.favorite,
    read_status: b.readLater ? "pending" : "read",
    is_deleted: !!b.deletedAt, deleted_at: iso(b.deletedAt),
    order_num: b.order ?? 0, last_opened: iso(b.lastOpened),
  });

  const saveBookmark = useCallback(async (b: T.Bookmark) => {
    setDb((d) => ({ ...d, bookmarks: d.bookmarks.map((x) => (x.id === b.id ? b : x)) }));
    await supabase.from("bookmarks").update(bmRow(b)).eq("id", b.id);
    await syncBookmarkTags(b.id, b.tags || []);
  }, [supabase, userId, setDb]);

  const createBookmark = useCallback(async (input: { url: string; title: string; note?: string; folderId?: string | null; tags?: string[]; favorite?: boolean }) => {
    let url = input.url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const b: T.Bookmark = {
      id: T.uid("b"), folderId: input.folderId || null, title: input.title.trim() || url,
      url, favicon: "", tags: input.tags || [], note: input.note || "",
      favorite: !!input.favorite, readLater: false,
      createdAt: Date.now(), lastOpened: null, order: 0, favOrder: 0, deletedAt: null,
    };
    setDb((d) => { b.order = T.nextOrder(d.bookmarks); return { ...d, bookmarks: [...d.bookmarks, b] }; });
    const { data } = await supabase.from("bookmarks").insert(bmRow(b)).select("id").single();
    let nid = b.id;
    if (data && (data as any).id && (data as any).id !== b.id) {
      nid = (data as any).id as string;
      setDb((d) => ({ ...d, bookmarks: d.bookmarks.map((x) => (x.id === b.id ? { ...x, id: nid } : x)) }));
    }
    if (b.folderId) {
      await supabase.from("bookmark_collections").insert({
        bookmark_id: nid, collection_id: b.folderId, user_id: userId,
      });
    }
    if (b.tags.length) await syncBookmarkTags(nid, b.tags);
    return { ...b, id: nid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  const syncBookmarkTags = async (bookmarkId: string, tags: string[]) => {
    // tags: nombres; crea los que falten
    const ids: string[] = [];
    setDb((d) => d); // noop
    const { data: existing } = await supabase.from("tags").select("id, name").eq("user_id", userId);
    const byName = new Map<string, string>(((existing || []) as any[]).map((t) => [t.name.toLowerCase(), t.id]));
    for (const name of tags) {
      const key = name.toLowerCase();
      let id = byName.get(key);
      if (!id) {
        const { data } = await supabase.from("tags").insert({
          user_id: userId, name, color: T.hashColor(name),
        }).select("id").single();
        id = (data as any)?.id;
        if (id) byName.set(key, id);
      }
      if (id) ids.push(id);
    }
    await supabase.from("bookmark_tags").delete().eq("bookmark_id", bookmarkId).eq("user_id", userId);
    if (ids.length) {
      await supabase.from("bookmark_tags").insert(ids.map((tag_id) => ({ bookmark_id: bookmarkId, tag_id, user_id: userId })));
    }
    setDb((d) => ({
      ...d,
      bookmarks: d.bookmarks.map((b) => (b.id === bookmarkId ? { ...b, tags: [...tags] } : b)),
    }));
  };

  const trashBookmark = useCallback(async (id: string) => {
    const now = Date.now();
    setDb((d) => ({ ...d, bookmarks: d.bookmarks.map((b) => (b.id === id ? { ...b, deletedAt: now } : b)) }));
    await supabase.from("bookmarks").update({ is_deleted: true, deleted_at: new Date(now).toISOString() }).eq("id", id);
  }, [supabase]);

  const restoreBookmark = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, bookmarks: d.bookmarks.map((b) => (b.id === id ? { ...b, deletedAt: null } : b)) }));
    await supabase.from("bookmarks").update({ is_deleted: false, deleted_at: null }).eq("id", id);
  }, [supabase]);

  const purgeBookmark = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, bookmarks: d.bookmarks.filter((b) => b.id !== id) }));
    await supabase.from("bookmark_tags").delete().eq("bookmark_id", id);
    await supabase.from("bookmark_collections").delete().eq("bookmark_id", id);
    await supabase.from("bookmarks").delete().eq("id", id);
  }, [supabase]);

  const reorderBookmarks = useCallback(async (folderId: string | null, dragId: string, beforeId: string | null) => {
    let list: T.Bookmark[] = [];
    setDb((d) => {
      list = d.bookmarks.filter((b) => (b.folderId || null) === (folderId || null) && !b.deletedAt).sort(T.byOrder);
      if (!T.reorderList(list, dragId, beforeId)) return d;
      const m = new Map(list.map((b) => [b.id, b.order]));
      return { ...d, bookmarks: d.bookmarks.map((b) => (m.has(b.id) ? { ...b, order: m.get(b.id)! } : b)) };
    });
    await Promise.all(list.map((b) =>
      supabase.from("bookmarks").update({ order_num: b.order }).eq("id", b.id)));
  }, [supabase]);

  /* Reordenar Favoritos: usa fav_order propio para no tocar el orden de las carpetas */
  const reorderFavorites = useCallback(async (dragId: string, beforeId: string | null) => {
    let list: T.Bookmark[] = [];
    setDb((d) => {
      list = d.bookmarks.filter((b) => b.favorite && !b.deletedAt)
        .sort((a, b) => (a.favOrder - b.favOrder) || T.byOrder(a, b));
      const tmp = list.map((b) => ({ id: b.id, order: b.favOrder }));
      if (!T.reorderList(tmp, dragId, beforeId)) return d;
      const m = new Map(tmp.map((x) => [x.id, x.order]));
      list.forEach((b) => { b.favOrder = m.get(b.id)!; });
      return { ...d, bookmarks: [...d.bookmarks] };
    });
    await Promise.all(list.map((b) =>
      supabase.from("bookmarks").update({ fav_order: b.favOrder }).eq("id", b.id)));
  }, [supabase]);

  /* Borrado múltiple: papelera (recuperable) en una sola operación */
  const trashBookmarks = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const now = Date.now();
    const set = new Set(ids);
    setDb((d) => ({
      ...d,
      bookmarks: d.bookmarks.map((b) => (set.has(b.id) ? { ...b, deletedAt: now } : b)),
    }));
    await supabase.from("bookmarks")
      .update({ is_deleted: true, deleted_at: new Date(now).toISOString() })
      .in("id", ids);
  }, [supabase]);

  /* Mover varios marcadores a una carpeta */
  const moveBookmarks = useCallback(async (ids: string[], folderId: string) => {
    if (!ids.length || !folderId) return;
    const set = new Set(ids);
    setDb((d) => ({
      ...d,
      bookmarks: d.bookmarks.map((b) => (set.has(b.id) ? { ...b, folderId } : b)),
    }));
    await supabase.from("bookmark_collections").delete().in("bookmark_id", ids).eq("user_id", userId);
    await supabase.from("bookmark_collections").insert(
      ids.map((bid) => ({ bookmark_id: bid, collection_id: folderId, user_id: userId })));
  }, [supabase, userId]);

  /* ----- tags ----- */
  const createTag = useCallback(async (name: string, color?: string) => {
    const nm = name.trim();
    if (!nm) return;
    let exists = false;
    setDb((d) => { exists = d.bookmarks.some((b) => b.tags.some((t) => t.toLowerCase() === nm.toLowerCase())); return d; });
    if (exists) { toast("Esa etiqueta ya existe"); return; }
    await supabase.from("tags").insert({ user_id: userId, name: nm, color: color || T.hashColor(nm) });
    await logActivity("create", "Creaste una etiqueta", nm);
    toast("Etiqueta creada");
  }, [supabase, userId, toast, logActivity]);

  const renameTag = useCallback(async (oldName: string, newName: string) => {
    const nn = newName.trim();
    if (!nn || nn === oldName) return;
    setDb((d) => ({
      ...d,
      bookmarks: d.bookmarks.map((b) => ({
        ...b, tags: b.tags.map((t) => (t === oldName ? nn : t)),
      })),
      settings: {
        ...d.settings,
        tagColors: { ...d.settings.tagColors, [nn]: d.settings.tagColors[oldName] || T.hashColor(nn) },
      },
    }));
    const { data: row } = await supabase.from("tags").select("id").eq("user_id", userId).eq("name", oldName).maybeSingle();
    if (row) await supabase.from("tags").update({ name: nn }).eq("id", (row as any).id);
    await logActivity("edit", "Renombraste una etiqueta", nn);
  }, [supabase, userId, logActivity]);

  const deleteTag = useCallback(async (name: string) => {
    setDb((d) => ({
      ...d,
      bookmarks: d.bookmarks.map((b) => ({ ...b, tags: b.tags.filter((t) => t !== name) })),
    }));
    const { data: row } = await supabase.from("tags").select("id").eq("user_id", userId).eq("name", name).maybeSingle();
    if (row) {
      await supabase.from("bookmark_tags").delete().eq("tag_id", (row as any).id);
      await supabase.from("tags").delete().eq("id", (row as any).id);
    }
    await logActivity("delete", "Eliminaste una etiqueta", name);
  }, [supabase, userId, logActivity]);

  const setTagColor = useCallback(async (name: string, color: string) => {
    setDb((d) => ({
      ...d,
      settings: { ...d.settings, tagColors: { ...d.settings.tagColors, [name]: color } },
    }));
    const { data: row } = await supabase.from("tags").select("id").eq("user_id", userId).eq("name", name).maybeSingle();
    if (row) await supabase.from("tags").update({ color }).eq("id", (row as any).id);
  }, [supabase, userId]);

  /* ----- notes ----- */
  const noteRow = (n: T.NoteT) => ({
    user_id: userId, title: n.title, content: n.html, links_text: n.linksText || "",
    color: n.color, pinned: n.pinned, archived: n.archived, read_later: n.readLater,
    position: n.order ?? 0,
    attachments: n.attachments as unknown as Record<string, unknown>[],
    deleted: !!n.deletedAt, deleted_at: iso(n.deletedAt),
    updated_at: new Date(n.updatedAt).toISOString(),
  });

  const saveNote = useCallback(async (n: T.NoteT) => {
    const nu = { ...n, updatedAt: Date.now() };
    setDb((d) => ({ ...d, notes: d.notes.map((x) => (x.id === n.id ? nu : x)) }));
    await supabase.from("notes").update(noteRow(nu)).eq("id", n.id);
  }, [supabase, userId]);

  const createNote = useCallback(async (input: Partial<T.NoteT>) => {
    const now = Date.now();
    const n: T.NoteT = {
      id: T.uid("n"), title: input.title || "Sin título", html: input.html || "",
      linksText: input.linksText || "", color: input.color || T.NOTE_COLORS[0],
      pinned: false, archived: false, readLater: false, order: 0,
      attachments: input.attachments || [],
      createdAt: now, updatedAt: now, deletedAt: null,
    };
    setDb((d) => { n.order = T.nextOrder(d.notes); return { ...d, notes: [...d.notes, n] }; });
    const { data } = await supabase.from("notes").insert(noteRow(n)).select("id").single();
    if (data && (data as any).id && (data as any).id !== n.id) {
      const nid = (data as any).id as string;
      setDb((d) => ({ ...d, notes: d.notes.map((x) => (x.id === n.id ? { ...x, id: nid } : x)) }));
      return { ...n, id: nid };
    }
    return n;
  }, [supabase, userId]);

  const trashNote = useCallback(async (id: string) => {
    const now = Date.now();
    setDb((d) => ({ ...d, notes: d.notes.map((n) => (n.id === id ? { ...n, deletedAt: now, updatedAt: now } : n)) }));
    await supabase.from("notes").update({ deleted: true, deleted_at: new Date(now).toISOString() }).eq("id", id);
  }, [supabase]);

  const restoreNote = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, notes: d.notes.map((n) => (n.id === id ? { ...n, deletedAt: null, archived: false } : n)) }));
    await supabase.from("notes").update({ deleted: false, deleted_at: null }).eq("id", id);
  }, [supabase]);

  const purgeNote = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
    await supabase.from("notes").delete().eq("id", id);
  }, [supabase]);

  const reorderNotes = useCallback(async (dragId: string, beforeId: string | null) => {
    let list: T.NoteT[] = [];
    setDb((d) => {
      list = d.notes.filter((n) => !n.deletedAt).slice().sort((a, b) =>
        ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || T.byOrder(a, b));
      if (!T.reorderList(list, dragId, beforeId)) return d;
      const m = new Map(list.map((n) => [n.id, n.order]));
      return { ...d, notes: d.notes.map((n) => (m.has(n.id) ? { ...n, order: m.get(n.id)! } : n)) };
    });
    await Promise.all(list.map((n) =>
      supabase.from("notes").update({ position: n.order }).eq("id", n.id)));
  }, [supabase]);

  /* ----- accounts / assistants ----- */
  const accRow = (a: T.Account) => ({
    user_id: userId, name: a.name, url: a.url || null,
    username: a.username || null, email: a.email || null,
    password: a.password || null, note: a.note || null,
    icon: a.icon || null, icon_type: a.iconType || "auto",
    is_favorite: !!a.favorite,
    position: a.order ?? 0, is_deleted: !!a.deletedAt, deleted_at: iso(a.deletedAt),
  });

  const saveAccount = useCallback(async (a: T.Account) => {
    setDb((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === a.id ? a : x)) }));
    await supabase.from("accounts").update(accRow(a)).eq("id", a.id);
  }, [supabase, userId]);
  const createAccount = useCallback(async (input: Partial<T.Account>) => {
    const a: T.Account = {
      id: T.uid("ac"), name: input.name || "", url: input.url || "",
      username: input.username || "", email: input.email || "",
      password: input.password || "", note: input.note || "", favorite: false,
      icon: input.icon || "", iconType: input.iconType || "auto",
      order: 0, createdAt: Date.now(), deletedAt: null,
    };
    setDb((d) => { a.order = T.nextOrder(d.accounts); return { ...d, accounts: [...d.accounts, a] }; });
    const { data } = await supabase.from("accounts").insert(accRow(a)).select("id").single();
    if (data && (data as any).id && (data as any).id !== a.id) {
      const nid = (data as any).id as string;
      setDb((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === a.id ? { ...x, id: nid } : x)) }));
      return { ...a, id: nid };
    }
    return a;
  }, [supabase, userId]);
  const trashAccount = useCallback(async (id: string) => {
    const now = Date.now();
    setDb((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, deletedAt: now } : a)) }));
    await supabase.from("accounts").update({ is_deleted: true, deleted_at: new Date(now).toISOString() }).eq("id", id);
  }, [supabase]);
  const restoreAccount = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, deletedAt: null } : a)) }));
    await supabase.from("accounts").update({ is_deleted: false, deleted_at: null }).eq("id", id);
  }, [supabase]);
  const purgeAccount = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, accounts: d.accounts.filter((a) => a.id !== id) }));
    await supabase.from("accounts").delete().eq("id", id);
  }, [supabase]);
  const reorderAccounts = useCallback(async (dragId: string, beforeId: string | null) => {
    let list: T.Account[] = [];
    setDb((d) => {
      list = d.accounts.filter((a) => !a.deletedAt).sort(T.byOrder);
      if (!T.reorderList(list, dragId, beforeId)) return d;
      const m = new Map(list.map((a) => [a.id, a.order]));
      return { ...d, accounts: d.accounts.map((a) => (m.has(a.id) ? { ...a, order: m.get(a.id)! } : a)) };
    });
    await Promise.all(list.map((a) => supabase.from("accounts").update({ position: a.order }).eq("id", a.id)));
  }, [supabase]);

  const saveAssistant = useCallback(async (a: T.Assistant) => {
    setDb((d) => ({ ...d, assistants: d.assistants.map((x) => (x.id === a.id ? a : x)) }));
    await supabase.from("assistants").update(accRow(a)).eq("id", a.id);
  }, [supabase, userId]);
  const createAssistant = useCallback(async (input: Partial<T.Assistant>) => {
    const a: T.Assistant = {
      id: T.uid("ai"), name: input.name || "", url: input.url || "",
      username: input.username || "", email: input.email || "",
      password: input.password || "", note: input.note || "", favorite: false,
      icon: input.icon || "", iconType: input.iconType || "auto",
      order: 0, createdAt: Date.now(), deletedAt: null,
    };
    setDb((d) => { a.order = T.nextOrder(d.assistants); return { ...d, assistants: [...d.assistants, a] }; });
    const { data } = await supabase.from("assistants").insert(accRow(a)).select("id").single();
    if (data && (data as any).id && (data as any).id !== a.id) {
      const nid = (data as any).id as string;
      setDb((d) => ({ ...d, assistants: d.assistants.map((x) => (x.id === a.id ? { ...x, id: nid } : x)) }));
      return { ...a, id: nid };
    }
    return a;
  }, [supabase, userId]);
  const trashAssistant = useCallback(async (id: string) => {
    const now = Date.now();
    setDb((d) => ({ ...d, assistants: d.assistants.map((a) => (a.id === id ? { ...a, deletedAt: now } : a)) }));
    await supabase.from("assistants").update({ is_deleted: true, deleted_at: new Date(now).toISOString() }).eq("id", id);
  }, [supabase]);
  const restoreAssistant = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, assistants: d.assistants.map((a) => (a.id === id ? { ...a, deletedAt: null } : a)) }));
    await supabase.from("assistants").update({ is_deleted: false, deleted_at: null }).eq("id", id);
  }, [supabase]);
  const purgeAssistant = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, assistants: d.assistants.filter((a) => a.id !== id) }));
    await supabase.from("assistants").delete().eq("id", id);
  }, [supabase]);
  const reorderAssistants = useCallback(async (dragId: string, beforeId: string | null) => {
    let list: T.Assistant[] = [];
    setDb((d) => {
      list = d.assistants.filter((a) => !a.deletedAt).sort(T.byOrder);
      if (!T.reorderList(list, dragId, beforeId)) return d;
      const m = new Map(list.map((a) => [a.id, a.order]));
      return { ...d, assistants: d.assistants.map((a) => (m.has(a.id) ? { ...a, order: m.get(a.id)! } : a)) };
    });
    await Promise.all(list.map((a) => supabase.from("assistants").update({ position: a.order }).eq("id", a.id)));
  }, [supabase]);

  /* ----- reminders ----- */
  const remRow = (r: T.Reminder) => ({
    user_id: userId, text: r.title, remind_at: iso(r.when),
    note: r.note || null, url: r.url || null,
    color: r.color, icon: r.icon || "⏰", icon_type: r.iconType || "emoji",
    done: r.done, position: r.order ?? 0,
    is_deleted: !!r.deletedAt, deleted_at: iso(r.deletedAt),
  });
  const saveReminder = useCallback(async (r: T.Reminder) => {
    setDb((d) => ({ ...d, reminders: d.reminders.map((x) => (x.id === r.id ? r : x)) }));
    await supabase.from("reminders").update(remRow(r)).eq("id", r.id);
  }, [supabase, userId]);
  const createReminder = useCallback(async (input: Partial<T.Reminder>) => {
    const r: T.Reminder = {
      id: T.uid("rm"), title: input.title || "", when: input.when || Date.now() + 3600000,
      note: input.note || "", url: input.url || "", color: input.color || T.NOTE_COLORS[0],
      icon: input.icon || "⏰", iconType: input.iconType || "emoji", done: false,
      order: 0, createdAt: Date.now(), deletedAt: null,
    };
    setDb((d) => { r.order = T.nextOrder(d.reminders); return { ...d, reminders: [...d.reminders, r] }; });
    const { data } = await supabase.from("reminders").insert(remRow(r)).select("id").single();
    if (data && (data as any).id && (data as any).id !== r.id) {
      const nid = (data as any).id as string;
      setDb((d) => ({ ...d, reminders: d.reminders.map((x) => (x.id === r.id ? { ...x, id: nid } : x)) }));
      return { ...r, id: nid };
    }
    return r;
  }, [supabase, userId]);
  const trashReminder = useCallback(async (id: string) => {
    const now = Date.now();
    setDb((d) => ({ ...d, reminders: d.reminders.map((r) => (r.id === id ? { ...r, deletedAt: now } : r)) }));
    await supabase.from("reminders").update({ is_deleted: true, deleted_at: new Date(now).toISOString() }).eq("id", id);
  }, [supabase]);
  const restoreReminder = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, reminders: d.reminders.map((r) => (r.id === id ? { ...r, deletedAt: null } : r)) }));
    await supabase.from("reminders").update({ is_deleted: false, deleted_at: null }).eq("id", id);
  }, [supabase]);
  const purgeReminder = useCallback(async (id: string) => {
    setDb((d) => ({ ...d, reminders: d.reminders.filter((r) => r.id !== id) }));
    await supabase.from("reminders").delete().eq("id", id);
  }, [supabase]);
  const reorderReminders = useCallback(async (dragId: string, beforeId: string | null) => {
    let list: T.Reminder[] = [];
    setDb((d) => {
      list = d.reminders.filter((r) => !r.deletedAt).sort(T.byOrder);
      if (!T.reorderList(list, dragId, beforeId)) return d;
      const m = new Map(list.map((r) => [r.id, r.order]));
      return { ...d, reminders: d.reminders.map((r) => (m.has(r.id) ? { ...r, order: m.get(r.id)! } : r)) };
    });
    await Promise.all(list.map((r) => supabase.from("reminders").update({ position: r.order }).eq("id", r.id)));
  }, [supabase]);

  const emptyTrash = useCallback(async () => {
    const st = { spaces: [] as string[], folders: [] as string[], bookmarks: [] as string[], notes: [] as string[], accounts: [] as string[], assistants: [] as string[], reminders: [] as string[] };
    setDb((d) => {
      d.spaces.forEach((s) => { if (s.deletedAt) st.spaces.push(s.id); });
      d.folders.forEach((f) => { if (f.deletedAt) st.folders.push(f.id); });
      d.bookmarks.forEach((b) => { if (b.deletedAt) st.bookmarks.push(b.id); });
      d.notes.forEach((n) => { if (n.deletedAt) st.notes.push(n.id); });
      d.accounts.forEach((a) => { if (a.deletedAt) st.accounts.push(a.id); });
      d.assistants.forEach((a) => { if (a.deletedAt) st.assistants.push(a.id); });
      d.reminders.forEach((r) => { if (r.deletedAt) st.reminders.push(r.id); });
      return {
        ...d,
        spaces: d.spaces.filter((s) => !s.deletedAt),
        folders: d.folders.filter((f) => !f.deletedAt),
        bookmarks: d.bookmarks.filter((b) => !b.deletedAt),
        notes: d.notes.filter((n) => !n.deletedAt),
        accounts: d.accounts.filter((a) => !a.deletedAt),
        assistants: d.assistants.filter((a) => !a.deletedAt),
        reminders: d.reminders.filter((r) => !r.deletedAt),
      };
    });
    if (st.bookmarks.length) {
      await supabase.from("bookmark_tags").delete().in("bookmark_id", st.bookmarks);
      await supabase.from("bookmark_collections").delete().in("bookmark_id", st.bookmarks);
      await supabase.from("bookmarks").delete().in("id", st.bookmarks);
    }
    if (st.spaces.length || st.folders.length)
      await supabase.from("collections").delete().in("id", [...st.spaces, ...st.folders]);
    if (st.notes.length) await supabase.from("notes").delete().in("id", st.notes);
    if (st.accounts.length) await supabase.from("accounts").delete().in("id", st.accounts);
    if (st.assistants.length) await supabase.from("assistants").delete().in("id", st.assistants);
    if (st.reminders.length) await supabase.from("reminders").delete().in("id", st.reminders);
  }, [supabase]);

  /* ----- notas: mover al final ----- */
  const moveNoteToEnd = useCallback(async (dragId: string) => {
    let list: T.NoteT[] = [];
    setDb((d) => {
      list = d.notes.filter((n) => !n.deletedAt).slice().sort((a, b) =>
        ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || T.byOrder(a, b));
      if (!T.reorderList(list, dragId, null)) return d;
      const m = new Map(list.map((n) => [n.id, n.order]));
      return { ...d, notes: d.notes.map((n) => (m.has(n.id) ? { ...n, order: m.get(n.id)! } : n)) };
    });
    await Promise.all(list.map((n) =>
      supabase.from("notes").update({ position: n.order }).eq("id", n.id)));
  }, [supabase, setDb]);

  /* ----- eliminar duplicados (confirmación la pone quien llama) ----- */
  const removeDuplicateBookmarks = useCallback(async () => {
    const sorted = getDb().bookmarks.slice().sort((a, b) => a.createdAt - b.createdAt);
    const seen = new Map<string, T.Bookmark>();
    const keep: T.Bookmark[] = [];
    for (const b of sorted) {
      const key = String(b.url || "").split("#")[0].trim().toLowerCase();
      if (!key || !seen.has(key)) { seen.set(key, b); keep.push(b); }
    }
    const removed = getDb().bookmarks.length - keep.length;
    if (!removed) { toast("No hay marcadores duplicados"); return 0; }
    const keepIds = new Set(keep.map((b) => b.id));
    const goneIds = getDb().bookmarks.filter((b) => !keepIds.has(b.id)).map((b) => b.id);
    setDb((d) => ({ ...d, bookmarks: d.bookmarks.filter((b) => keepIds.has(b.id)) }));
    await supabase.from("bookmark_tags").delete().in("bookmark_id", goneIds);
    await supabase.from("bookmark_collections").delete().in("bookmark_id", goneIds);
    await supabase.from("bookmarks").delete().in("id", goneIds);
    await logActivity("delete", "Eliminaste marcadores duplicados", String(removed));
    toast("Eliminados " + removed + " marcador(es) duplicado(s)");
    return removed;
  }, [supabase, getDb, setDb, toast, logActivity]);

  /* ----- marcar como abierto (vista "Sin usar") ----- */
  const markBookmarkOpened = useCallback(async (id: string) => {
    const b = getDb().bookmarks.find((x) => x.id === id);
    if (!b || b.lastOpened) return;
    const now = Date.now();
    setDb((d) => ({ ...d, bookmarks: d.bookmarks.map((x) => (x.id === id ? { ...x, lastOpened: now } : x)) }));
    await supabase.from("bookmarks").update({ last_opened: new Date(now).toISOString() }).eq("id", id);
  }, [supabase, getDb, setDb]);

  /* ----- exportar ----- */
  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  };
  const stamp = () => {
    const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  };
  const exportJSON = useCallback(() => {
    const d = getDb();
    download("bookdpb-backup-" + stamp() + ".json", JSON.stringify({
      app: "TabmeCode", version: 2, exportedAt: new Date().toISOString(),
      spaces: d.spaces, folders: d.folders, bookmarks: d.bookmarks,
      notes: d.notes, tagColors: d.settings.tagColors || {},
      accounts: d.accounts, assistants: d.assistants,
      reminders: d.reminders, activity: d.activity, settings: d.settings,
    }, null, 2), "application/json");
  }, [getDb]);
  const exportHTML = useCallback(() => {
    const d = getDb();
    const live = d.bookmarks.filter((b) => !b.deletedAt);
    const byFolder: Record<string, T.Bookmark[]> = {};
    live.forEach((b) => { const k = b.folderId || ""; (byFolder[k] = byFolder[k] || []).push(b); });
    const fname: Record<string, string> = {};
    d.folders.forEach((f) => { fname[f.id] = f.name; });
    const escA = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    let out = "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n" +
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
      "<TITLE>Marcadores de TabmeCode</TITLE>\n<H1>Marcadores de TabmeCode</H1>\n<DL><p>\n";
    Object.keys(byFolder).forEach((fid) => {
      out += "<DT><H3>" + escA(fname[fid] || "Sin clasificar") + "</H3>\n<DL><p>\n";
      byFolder[fid].forEach((b) => { out += '<DT><A HREF="' + escA(b.url) + '">' + escA(b.title) + "</A>\n"; });
      out += "</DL><p>\n";
    });
    out += "</DL><p>\n";
    download("bookdpb-marcadores-" + stamp() + ".html", out, "text/html;charset=utf-8");
  }, [getDb]);
  const exportCSV = useCallback(() => {
    const d = getDb();
    const cell = (s: string) => /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    let out = "url,title\n";
    d.bookmarks.filter((b) => !b.deletedAt).forEach((b) => { out += cell(b.url) + "," + cell(b.title) + "\n"; });
    download("bookdpb-marcadores-" + stamp() + ".csv", out, "text/csv;charset=utf-8");
  }, [getDb]);
  const exportTXT = useCallback(() => {
    const d = getDb();
    const out = d.bookmarks.filter((b) => !b.deletedAt).map((b) => b.url).join("\n") + "\n";
    download("bookdpb-marcadores-" + stamp() + ".txt", out, "text/plain;charset=utf-8");
  }, [getDb]);

  /* ----- importar ----- */
  type ImportItem = { title: string; url: string; tags: string[]; note: string };
  const parseImportFile = async (file: File): Promise<{ fullBackup?: any; items: ImportItem[] }> => {
    const text = await file.text();
    const name = (file.name || "").toLowerCase();
    const norm = (list: any[]): ImportItem[] =>
      (list || []).filter((b) => b && b.url).map((b) => ({
        title: b.title || b.url, url: String(b.url).trim(),
        tags: Array.isArray(b.tags) ? b.tags : [], note: b.note || "",
      }));
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(text);
      if (parsed && parsed.app === "TabmeCode" && parsed.bookmarks) return { fullBackup: parsed, items: [] };
      const arr = Array.isArray(parsed) ? parsed : (parsed.bookmarks || parsed.items || []);
      return { items: norm(arr) };
    }
    if (name.endsWith(".html") || name.endsWith(".htm")) {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const items: ImportItem[] = [];
      doc.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (/^https?:/i.test(href)) items.push({ title: (a.textContent || "").trim() || href, url: href.trim(), tags: [], note: "" });
      });
      return { items };
    }
    if (name.endsWith(".csv")) {
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      const items: ImportItem[] = [];
      lines.forEach((line, idx) => {
        const cells: string[] = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (inQ) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
          else if (c === '"') inQ = true;
          else if (c === ",") { cells.push(cur); cur = ""; }
          else cur += c;
        }
        cells.push(cur);
        if (idx === 0 && /^url$/i.test(cells[0].trim())) return;
        const url = (cells[0] || "").trim();
        if (/^https?:/i.test(url)) items.push({ title: (cells[1] || "").trim() || url, url, tags: [], note: "" });
      });
      return { items };
    }
    const items: ImportItem[] = [];
    text.split(/\r?\n/).forEach((line) => {
      const url = line.trim();
      if (/^https?:/i.test(url)) items.push({ title: url, url, tags: [], note: "" });
    });
    return { items };
  };

  /* Ingiere items en una carpeta del space actual (como el original) */
  const ingestImportItems = useCallback(async (items: ImportItem[], spaceId: string, folderName: string) => {
    if (!items.length) { toast("No se encontraron marcadores"); return 0; }
    const d0 = getDb();
    const nm = folderName.trim() || "Importados";
    let f = d0.folders.find((x) => x.spaceId === spaceId && !x.deletedAt && x.name.toLowerCase() === nm.toLowerCase() && !x.parentId);
    if (!f) f = await createFolder(spaceId, null, nm, T.PALETTE[3], "", "emoji");
    const now = Date.now();
    const base = T.nextOrder(getDb().bookmarks.filter((b) => b.folderId === f!.id));
    const rows = items.map((it, i) => ({
      user_id: userId, url: it.url, title: it.title || it.url, description: it.note || null,
      icon: T.faviconFor(it.url), is_favorite: false, read_status: "read",
      is_deleted: false, order_num: base + i,
      created_at: new Date(now + i).toISOString(),
    }));
    const { data } = await supabase.from("bookmarks").insert(rows).select("id");
    const ids: string[] = ((data || []) as any[]).map((r) => r.id);
    if (f.id && ids.length) {
      await supabase.from("bookmark_collections").insert(ids.map((bid) => ({ bookmark_id: bid, collection_id: f!.id, user_id: userId })));
    }
    const bms: T.Bookmark[] = items.map((it, i) => ({
      id: ids[i] || T.uid("b"), folderId: f!.id, title: it.title || it.url, url: it.url,
      favicon: T.faviconFor(it.url), tags: it.tags || [], note: it.note || "",
      favorite: false, readLater: false, createdAt: now + i, lastOpened: null,
      order: base + i, favOrder: 0, deletedAt: null,
    }));
    setDb((d) => ({ ...d, bookmarks: [...d.bookmarks, ...bms] }));
    for (let i = 0; i < bms.length; i++) {
      if (bms[i].tags.length) await syncBookmarkTags(bms[i].id, bms[i].tags);
    }
    await logActivity("create", "Importaste marcadores", `«${f.name}» (${bms.length})`);
    toast(`Importados ${bms.length} marcador(es) a «${f.name}»`);
    return bms.length;
  }, [supabase, userId, getDb, setDb, createFolder, toast, logActivity]);

  /* ----- toggles ----- */
  const toggleFavorite = useCallback(async (id: string) => {
    const b = getDb().bookmarks.find((x) => x.id === id);
    if (!b) return;
    const v = !b.favorite;
    setDb((d) => ({ ...d, bookmarks: d.bookmarks.map((x) => (x.id === id ? { ...x, favorite: v } : x)) }));
    await supabase.from("bookmarks").update({ is_favorite: v }).eq("id", id);
    if (v) await logActivity("favorite", "Marcaste como favorito", b.title);
  }, [supabase, getDb, setDb, logActivity]);

  const toggleReadLater = useCallback(async (id: string) => {
    const b = getDb().bookmarks.find((x) => x.id === id);
    if (!b) return;
    const v = !b.readLater;
    setDb((d) => ({ ...d, bookmarks: d.bookmarks.map((x) => (x.id === id ? { ...x, readLater: v } : x)) }));
    await supabase.from("bookmarks").update({ read_status: v ? "pending" : "read" }).eq("id", id);
    toast(v ? "Añadido a leer después" : "Quitado de leer después");
  }, [supabase, getDb, setDb, toast]);

  const toggleNotePin = useCallback(async (id: string) => {
    const n = getDb().notes.find((x) => x.id === id);
    if (!n) return;
    const v = !n.pinned;
    setDb((d) => ({ ...d, notes: d.notes.map((x) => (x.id === id ? { ...x, pinned: v } : x)) }));
    await supabase.from("notes").update({ pinned: v }).eq("id", id);
  }, [supabase, getDb, setDb]);

  const toggleNoteReadLater = useCallback(async (id: string) => {
    const n = getDb().notes.find((x) => x.id === id);
    if (!n) return;
    const v = !n.readLater;
    setDb((d) => ({ ...d, notes: d.notes.map((x) => (x.id === id ? { ...x, readLater: v } : x)) }));
    await supabase.from("notes").update({ read_later: v }).eq("id", id);
  }, [supabase, getDb, setDb]);

  const toggleAccountFavorite = useCallback(async (id: string) => {
    const a = getDb().accounts.find((x) => x.id === id);
    if (!a) return;
    const v = !a.favorite;
    setDb((d) => ({ ...d, accounts: d.accounts.map((x) => (x.id === id ? { ...x, favorite: v } : x)) }));
    await supabase.from("accounts").update({ is_favorite: v }).eq("id", id);
  }, [supabase, getDb, setDb]);

  const toggleAssistantFavorite = useCallback(async (id: string) => {
    const a = getDb().assistants.find((x) => x.id === id);
    if (!a) return;
    const v = !a.favorite;
    setDb((d) => ({ ...d, assistants: d.assistants.map((x) => (x.id === id ? { ...x, favorite: v } : x)) }));
    await supabase.from("assistants").update({ is_favorite: v }).eq("id", id);
  }, [supabase, getDb, setDb]);

  const toggleReminderDone = useCallback(async (id: string) => {
    const r = getDb().reminders.find((x) => x.id === id);
    if (!r) return;
    const v = !r.done;
    setDb((d) => ({ ...d, reminders: d.reminders.map((x) => (x.id === id ? { ...x, done: v } : x)) }));
    await supabase.from("reminders").update({ is_done: v }).eq("id", id);
  }, [supabase, getDb, setDb]);

  const value: Ctx = {
    userId, db, loading, refresh: load, toasts, toast, openUrl,
    saveSpace, createSpace, trashSpace, restoreSpace, purgeSpace, reorderSpaces,
    saveFolder, createFolder, trashFolder, restoreFolder, purgeFolder, reorderFolders,
    moveBookmarkTo,
    saveBookmark, createBookmark, trashBookmark, restoreBookmark, purgeBookmark, reorderBookmarks,
    reorderFavorites, trashBookmarks, moveBookmarks,
    toggleFavorite, toggleReadLater,
    markBookmarkOpened, moveNoteToEnd,
    removeDuplicateBookmarks, exportJSON, exportHTML, exportCSV, exportTXT, parseImportFile, ingestImportItems,
    createTag, renameTag, deleteTag, setTagColor,
    saveNote, createNote, trashNote, restoreNote, purgeNote, reorderNotes,
    toggleNotePin, toggleNoteReadLater,
    saveAccount, createAccount, trashAccount, restoreAccount, purgeAccount, reorderAccounts,
    toggleAccountFavorite,
    saveAssistant, createAssistant, trashAssistant, restoreAssistant, purgeAssistant, reorderAssistants,
    toggleAssistantFavorite,
    saveReminder, createReminder, trashReminder, restoreReminder, purgeReminder, reorderReminders,
    toggleReminderDone,
    logActivity, clearActivity, emptyTrash, updateSettings,
  };

  return <TCContext.Provider value={value}>{children}</TCContext.Provider>;
}
