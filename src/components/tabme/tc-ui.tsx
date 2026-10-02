/* BookDPB — tc-ui.tsx
   Estado de UI + helpers, portados literalmente de TabmeCode v1.6.3 (newtab.js).
   El store (tc-store) aporta los datos; aquí vive el `state` de navegación. */
"use client";
import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useTC } from "@/lib/tc-store";
import * as T from "@/lib/tc";

export type UiState = {
  view: string;
  spaceId: string | null;
  folderId: string | null;
  tag: string | null;
  notes: boolean;
  notesTab: "all" | "archived" | "trash";
  notesQuery: string;
  histFilter: string;
  remindersTab: string;
  trashTab: string;
};
export type ModalState = { kind: string; props?: any } | null;

type AppCtx = {
  ui: UiState;
  setUi: (patch: Partial<UiState>) => void;
  goHome: () => void;
  goSpace: (spaceId: string) => void;
  goFolder: (folderId: string) => void;
  goItem: (view: string) => void;
  goTag: (tag: string) => void;
  modal: ModalState;
  openModal: (kind: string, props?: any) => void;
  closeModal: () => void;
  openDd: string | null;
  setOpenDd: (id: string | null) => void;
  /* datos derivados (literales del original) */
  liveSpaces: () => T.Space[];
  liveFolders: () => T.Folder[];
  liveBookmarks: () => T.Bookmark[];
  liveNotes: () => T.NoteT[];
  liveAccounts: () => T.Account[];
  liveAssistants: () => T.Assistant[];
  liveReminders: () => T.Reminder[];
  spaceStats: (sp: T.Space) => { folders: T.Folder[]; bms: T.Bookmark[] };
  childFolders: (id: string) => T.Folder[];
  folderById: (id: string | null) => T.Folder | undefined;
  spaceById: (id: string | null) => T.Space | undefined;
  isCollapsed: (id: string) => boolean;
  toggleCollapse: (id: string) => void;
  isExpanded: (id: string) => boolean;
  toggleSpace: (id: string) => void;
  tagColorOf: (tag: string) => string;
  allTags: () => string[];
  getViewMode: (key: string) => string;
  setViewMode: (key: string, mode: string) => void;
  getZoom: () => number;
  setZoom: (delta: number) => void;
  countInTree: (folderId: string) => number;
  trashEntries: () => { kind: string; label: string; icon: string; id: string; name: string; deletedAt: number }[];
  visibleNotes: () => T.NoteT[];
  noteCounts: () => { all: number; archived: number; trash: number };
  itemCount: (key: string) => number;
  itemPreview: (key: string) => { name: string; sub: string }[];
};

const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fuera de AppCtx");
  return c;
};

export function AppProvider({ ui, setUi, modal, openModal, closeModal, openDd, setOpenDd, children }:
  {
    ui: UiState; setUi: (p: Partial<UiState>) => void;
    modal: ModalState; openModal: (k: string, pr?: any) => void; closeModal: () => void;
    openDd: string | null; setOpenDd: (id: string | null) => void;
    children: React.ReactNode;
  }) {
  const tc = useTC();
  const { db } = tc;

  const liveSpaces = useCallback(() => db.spaces.filter((s) => !s.deletedAt), [db]);
  const liveFolders = useCallback(() => db.folders.filter((f) => !f.deletedAt), [db]);
  const liveBookmarks = useCallback(() => db.bookmarks.filter((b) => !b.deletedAt), [db]);
  const liveNotes = useCallback(() => db.notes.filter((n) => !n.deletedAt), [db]);
  const liveAccounts = useCallback(() => db.accounts.filter((a) => !a.deletedAt), [db]);
  const liveAssistants = useCallback(() => db.assistants.filter((a) => !a.deletedAt), [db]);
  const liveReminders = useCallback(() => db.reminders.filter((r) => !r.deletedAt), [db]);

  const folderById = useCallback((id: string | null) =>
    db.folders.find((f) => f.id === id), [db]);
  const spaceById = useCallback((id: string | null) =>
    db.spaces.find((s) => s.id === id), [db]);

  const spaceStats = useCallback((sp: T.Space) => {
    const folders = liveFolders().filter((f) => f.spaceId === sp.id);
    const fids = new Set(folders.map((f) => f.id));
    const bms = liveBookmarks().filter((b) => b.folderId && fids.has(b.folderId));
    return { folders, bms };
  }, [db, liveFolders, liveBookmarks]);

  const childFolders = useCallback((id: string) =>
    liveFolders().filter((f) => f.parentId === id).sort(T.byOrder), [db, liveFolders]);

  const isCollapsed = useCallback((id: string) => {
    const cf = db.settings.collapsedFolders || {};
    if (cf[id] !== undefined) return !!cf[id];
    return !!db.settings.collapseFolders;
  }, [db]);

  const toggleCollapse = useCallback((id: string) => {
    const cf = { ...(db.settings.collapsedFolders || {}) };
    cf[id] = !isCollapsed(id);
    tc.updateSettings({ collapsedFolders: cf });
  }, [db, isCollapsed, tc]);

  const isExpanded = useCallback((id: string) => {
    const ex = db.settings.expandedSpaces || {};
    if (ex[id] !== undefined) return !!ex[id];
    return true;
  }, [db]);

  const toggleSpace = useCallback((id: string) => {
    const ex = { ...(db.settings.expandedSpaces || {}) };
    ex[id] = !isExpanded(id);
    tc.updateSettings({ expandedSpaces: ex });
  }, [db, isExpanded, tc]);

  const tagColorOf = useCallback((tag: string) =>
    (db.settings.tagColors && db.settings.tagColors[tag]) || T.hashColor(tag), [db]);

  const allTags = useCallback(() => {
    const set = new Set<string>();
    liveBookmarks().forEach((b) => (b.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [db, liveBookmarks]);

  const getViewMode = useCallback((key: string) => {
    const modes = (db.settings && db.settings.viewModes) || {};
    return modes[key] || "grid";
  }, [db]);
  const setViewMode = useCallback((key: string, mode: string) => {
    tc.updateSettings({ viewModes: { ...(db.settings.viewModes || {}), [key]: mode } });
  }, [db, tc]);
  const getZoom = useCallback(() => {
    const z = parseFloat(String(db.settings && (db.settings as any).cardZoom));
    return (z >= 0.8 && z <= 1.4) ? z : 1;
  }, [db]);
  const setZoom = useCallback((delta: number) => {
    let z = Math.round((getZoom() + delta) * 10) / 10;
    z = Math.min(1.4, Math.max(0.8, z));
    tc.updateSettings({ cardZoom: z } as Partial<T.Settings>);
  }, [getZoom, tc]);

  const countInTree = useCallback((folderId: string) =>
    T.countInTree(liveBookmarks(), liveFolders(), folderId), [db, liveBookmarks, liveFolders]);

  const persistSelection = useCallback((patch: Partial<UiState>) => {
    tc.updateSettings({
      activeSpaceId: patch.spaceId !== undefined ? patch.spaceId : ui.spaceId,
      activeFolderId: patch.folderId !== undefined ? patch.folderId : ui.folderId,
    });
  }, [tc, ui]);

  const goHome = useCallback(() => {
    const p = { view: "home", folderId: null, tag: null, notes: false } as Partial<UiState>;
    persistSelection(p); setUi(p);
  }, [persistSelection, setUi]);
  const goSpace = useCallback((spaceId: string) => {
    const p = { spaceId, folderId: null, view: "all", tag: null, notes: false } as Partial<UiState>;
    persistSelection(p); setUi(p);
  }, [persistSelection, setUi]);
  const goFolder = useCallback((folderId: string) => {
    const f = folderById(folderId);
    const p = { folderId, spaceId: f ? f.spaceId : ui.spaceId, view: "folder", tag: null, notes: false } as Partial<UiState>;
    persistSelection(p); setUi(p);
  }, [persistSelection, setUi, folderById, ui]);
  const goItem = useCallback((view: string) => {
    setUi({ view, notes: false, tag: null, folderId: null } as Partial<UiState>);
    const main = document.getElementById("main"); if (main) main.scrollTop = 0;
  }, [setUi]);
  const goTag = useCallback((tag: string) => {
    setUi({ view: "tag", tag, notes: false, folderId: null } as Partial<UiState>);
  }, [setUi]);

  const trashEntries = useCallback(() => {
    const out: { kind: string; label: string; icon: string; id: string; name: string; deletedAt: number }[] = [];
    const push = (kind: string, label: string, icon: string, arr: { id: string; deletedAt: number | null; name?: string; title?: string }[], nameFn: (x: any) => string) =>
      arr.forEach((x) => { if (x.deletedAt) out.push({ kind, label, icon, id: x.id, name: nameFn(x), deletedAt: x.deletedAt }); });
    push("spaces", "Space", "📁", db.spaces, (x) => x.name);
    push("folders", "Carpeta", "📂", db.folders, (x) => x.name);
    push("bookmarks", "Marcador", "🔖", db.bookmarks, (x) => x.title);
    push("notes", "Nota", "📝", db.notes, (x) => x.title);
    push("accounts", "Cuenta", "🔑", db.accounts, (x) => x.name);
    push("assistants", "Asistente IA", "🤖", db.assistants, (x) => x.name);
    push("reminders", "Recordatorio", "⏰", db.reminders, (x) => x.title);
    return out.sort((a, b) => b.deletedAt - a.deletedAt);
  }, [db]);

  const visibleNotes = useCallback(() => {
    const q = ui.notesQuery.trim().toLowerCase();
    let list = db.notes.filter((n) => {
      if (ui.notesTab === "trash") return !!n.deletedAt;
      if (n.deletedAt) return false;
      if (ui.notesTab === "archived") return !!n.archived;
      return !n.archived;
    });
    if (q) {
      list = list.filter((n) =>
        (n.title + " " + T.stripTags(n.html) + " " + (n.attachments || []).map((a) => a.name).join(" "))
          .toLowerCase().includes(q));
    }
    return list.slice().sort((a, b) =>
      ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || T.byOrder(a, b) || (b.updatedAt - a.updatedAt));
  }, [db, ui]);

  const noteCounts = useCallback(() => ({
    all: liveNotes().filter((n) => !n.archived).length,
    archived: liveNotes().filter((n) => n.archived).length,
    trash: db.notes.filter((n) => n.deletedAt).length,
  }), [db, liveNotes]);

  const itemCount = useCallback((key: string) => {
    if (key === "accounts") return liveAccounts().length;
    if (key === "assistants") return liveAssistants().length;
    if (key === "reminders") return liveReminders().filter((r) => !r.done).length;
    if (key === "favorites") return liveBookmarks().filter((b) => b.favorite).length;
    if (key === "history") return db.activity.length;
    if (key === "trash") return trashEntries().length;
    if (key === "readlater")
      return liveBookmarks().filter((b) => b.readLater).length + liveNotes().filter((n) => n.readLater).length;
    return 0;
  }, [db, liveAccounts, liveAssistants, liveReminders, liveBookmarks, liveNotes, trashEntries]);

  const itemPreview = useCallback((key: string): { name: string; sub: string }[] => {
    if (key === "accounts") return liveAccounts().slice().sort(T.byOrder).slice(0, 5)
      .map((a) => ({ name: a.name, sub: T.domainOf(a.url || "") }));
    if (key === "assistants") return liveAssistants().slice().sort(T.byOrder).slice(0, 5)
      .map((a) => ({ name: a.name, sub: T.domainOf(a.url || "") }));
    if (key === "reminders") return liveReminders().filter((r) => !r.done).slice().sort((a, b) => a.when - b.when).slice(0, 5)
      .map((r) => ({ name: r.title, sub: T.fmtDateTime(r.when) }));
    if (key === "favorites") return liveBookmarks().filter((b) => b.favorite).slice().sort(T.byOrder).slice(0, 5)
      .map((b) => ({ name: b.title, sub: T.domainOf(b.url) }));
    if (key === "history") return db.activity.slice(0, 5)
      .map((a) => ({ name: a.text, sub: a.detail }));
    if (key === "readlater") {
      const bms = liveBookmarks().filter((b) => b.readLater).slice().sort(T.byOrder).slice(0, 5)
        .map((b) => ({ name: b.title, sub: T.domainOf(b.url) }));
      const nts = liveNotes().filter((n) => n.readLater).slice(0, 5)
        .map((n) => ({ name: n.title, sub: "Nota" }));
      return [...bms, ...nts].slice(0, 5);
    }
    if (key === "trash") return trashEntries().slice(0, 5)
      .map((t) => ({ name: t.name || "(sin nombre)", sub: t.label }));
    return [];
  }, [db, liveAccounts, liveAssistants, liveReminders, liveBookmarks, liveNotes, trashEntries]);

  const value: AppCtx = {
    ui, setUi, goHome, goSpace, goFolder, goItem, goTag,
    modal, openModal, closeModal, openDd, setOpenDd,
    liveSpaces, liveFolders, liveBookmarks, liveNotes, liveAccounts, liveAssistants, liveReminders,
    spaceStats, childFolders, folderById, spaceById,
    isCollapsed, toggleCollapse, isExpanded, toggleSpace,
    tagColorOf, allTags, getViewMode, setViewMode, getZoom, setZoom,
    countInTree, trashEntries, visibleNotes, noteCounts, itemCount, itemPreview,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDnD() {
  const clearDropMarks = useCallback((root?: HTMLElement | null) => {
    (root || document).querySelectorAll(".drop-before, .drop-after, .drop-target").forEach((el) => {
      el.classList.remove("drop-before"); el.classList.remove("drop-after"); el.classList.remove("drop-target");
    });
  }, []);
  return useMemo(() => ({ clearDropMarks }), [clearDropMarks]);
}
