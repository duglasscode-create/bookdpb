"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type TSpace = { id: string; name: string; icon: string; color: string; position: number };
export type TFolder = { id: string; name: string; icon: string; color: string; position: number; parentId: string };
export type TTag = { id: string; name: string; color: string };
export type TBookmark = {
  id: string; url: string; domain: string; title: string; description: string | null;
  icon: string | null; isFavorite: boolean; readLater: boolean; isDeleted: boolean;
  folderId: string | null; createdAt: string; tags: TTag[];
};
export type TNote = {
  id: string; title: string; content: string; color: string; pinned: boolean; updatedAt: string;
};

export const TABME_PALETTE = [
  "#2dd4bf", "#0ea5a5", "#38bdf8", "#818cf8", "#a78bfa",
  "#f472b6", "#fb7185", "#fbbf24", "#f97316", "#a3e635",
  "#34d399", "#94a3b8", "#64748b",
];

export function makeSlug(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sin-nombre";
  return `${base}-${Date.now().toString(36)}`;
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function useTabme(userId: string) {
  const supabase = createClient();
  const [spaces, setSpaces] = useState<TSpace[]>([]);
  const [folders, setFolders] = useState<TFolder[]>([]);
  const [bookmarks, setBookmarks] = useState<TBookmark[]>([]);
  const [trash, setTrash] = useState<TBookmark[]>([]);
  const [tags, setTags] = useState<TTag[]>([]);
  const [notes, setNotes] = useState<TNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cols }, { data: bms }, { data: rels }, { data: tgs }, { data: bt }, { data: nts }] = await Promise.all([
        supabase.from("collections").select("id, name, color, icon, position, parent_id").eq("user_id", userId).order("position", { ascending: true }),
        supabase.from("bookmarks").select("id, url, domain, title, description, icon, is_favorite, read_status, is_deleted, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5000),
        supabase.from("bookmark_collections").select("bookmark_id, collection_id").eq("user_id", userId),
        supabase.from("tags").select("id, name, color").eq("user_id", userId).order("name"),
        supabase.from("bookmark_tags").select("bookmark_id, tag_id").eq("user_id", userId),
        supabase.from("notes").select("id, title, content, color, pinned, updated_at").eq("user_id", userId).eq("deleted", false).order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(500),
      ]);

      const sp: TSpace[] = [];
      const fo: TFolder[] = [];
      (cols || []).forEach((c: any) => {
        const base = { id: c.id, name: c.name, icon: c.icon || "", color: c.color || "default", position: c.position ?? 0 };
        if (c.parent_id) fo.push({ ...base, parentId: c.parent_id });
        else sp.push(base);
      });

      const relMap = new Map<string, string>();
      (rels || []).forEach((r: any) => { if (!relMap.has(r.bookmark_id)) relMap.set(r.bookmark_id, r.collection_id); });
      const tagMap = new Map<string, TTag[]>();
      const tagById = new Map((tgs || []).map((t: any) => [t.id, { id: t.id, name: t.name, color: t.color }]));
      (bt || []).forEach((r: any) => {
        const t = tagById.get(r.tag_id);
        if (t) { const arr = tagMap.get(r.bookmark_id) || []; arr.push(t); tagMap.set(r.bookmark_id, arr); }
      });

      const live: TBookmark[] = [];
      const del: TBookmark[] = [];
      (bms || []).forEach((b: any) => {
        const bm: TBookmark = {
          id: b.id, url: b.url, domain: b.domain || domainOf(b.url), title: b.title || b.url,
          description: b.description, icon: b.icon, isFavorite: !!b.is_favorite,
          readLater: b.read_status === "pending", isDeleted: !!b.is_deleted,
          folderId: relMap.get(b.id) || null,
          createdAt: b.created_at, tags: tagMap.get(b.id) || [],
        };
        (bm.isDeleted ? del : live).push(bm);
      });

      // Orden de marcadores: más recientes primero
      live.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      setSpaces(sp);
      setFolders(fo);
      setBookmarks(live);
      setTrash(del);
      setTags((tgs || []).map((t: any) => ({ id: t.id, name: t.name, color: t.color })));
      setNotes((nts || []).map((n: any) => ({ id: n.id, title: n.title || "Sin título", content: n.content || "", color: n.color || "default", pinned: !!n.pinned, updatedAt: n.updated_at })));
    } catch (e) {
      console.error("Error cargando datos:", e);
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => { load(); }, [load]);

  // ===== Helpers =====
  const childrenOf = useCallback((parentId: string | null) => folders.filter((f) => f.parentId === parentId), [folders]);

  const descendantsOf = useCallback((id: string): string[] => {
    const out: string[] = [];
    const walk = (pid: string) => {
      folders.filter((f) => f.parentId === pid).forEach((f) => { out.push(f.id); walk(f.id); });
    };
    walk(id);
    return out;
  }, [folders]);

  const bookmarksIn = useCallback((folderId: string | null) => bookmarks.filter((b) => b.folderId === folderId), [bookmarks]);

  const countIn = useCallback((folderId: string): number => {
    const ids = new Set([folderId, ...descendantsOf(folderId)]);
    return bookmarks.filter((b) => b.folderId && ids.has(b.folderId)).length;
  }, [bookmarks, descendantsOf]);

  // ===== Spaces & Folders =====
  const createCollection = async (name: string, icon: string, color: string, parentId: string | null) => {
    const siblings = parentId ? folders.filter((f) => f.parentId === parentId) : spaces;
    const { data, error } = await supabase.from("collections").insert({
      user_id: userId, name: name.trim(), slug: makeSlug(name), color, icon,
      position: siblings.length, parent_id: parentId,
    }).select("id").single();
    if (error) throw error;
    await load();
    return data.id as string;
  };

  const updateCollection = async (id: string, patch: { name?: string; icon?: string; color?: string }) => {
    const { error } = await supabase.from("collections").update(patch).eq("id", id).eq("user_id", userId);
    if (error) throw error;
    await load();
  };

  const deleteCollection = async (id: string) => {
    const ids = [id, ...descendantsOf(id)];
    // Los marcadores de esas carpetas quedan sin carpeta
    const bmIds = bookmarks.filter((b) => b.folderId && ids.includes(b.folderId)).map((b) => b.id);
    if (bmIds.length) await supabase.from("bookmark_collections").delete().in("bookmark_id", bmIds).eq("user_id", userId);
    await supabase.from("collections").delete().in("id", ids).eq("user_id", userId);
    await load();
  };

  const reorderCollections = async (orderedIds: string[]) => {
    await Promise.all(orderedIds.map((id, i) => supabase.from("collections").update({ position: i }).eq("id", id).eq("user_id", userId)));
    await load();
  };

  // "Sin clasificar" dentro de un space (se crea solo si no existe), como Tabme
  const ensureUnclassified = async (spaceId: string): Promise<string> => {
    const existing = folders.find((f) => f.parentId === spaceId && f.name === "Sin clasificar");
    if (existing) return existing.id;
    return createCollection("Sin clasificar", "📥", "default", spaceId);
  };

  // ===== Bookmarks =====
  const setBookmarkFolder = async (bookmarkId: string, folderId: string | null) => {
    await supabase.from("bookmark_collections").delete().eq("bookmark_id", bookmarkId).eq("user_id", userId);
    if (folderId) await supabase.from("bookmark_collections").insert({ bookmark_id: bookmarkId, collection_id: folderId, user_id: userId });
    await load();
  };

  // Mueve un marcador a una carpeta (estilo Tabme: queda en una sola carpeta)
  const moveBookmark = async (bookmarkId: string, targetFolderId: string | null) => {
    // Resuelve destino estilo Tabme: soltar sobre un space -> primera subcarpeta o "Sin clasificar"
    let folderId = targetFolderId;
    if (folderId && spaces.some((s) => s.id === folderId)) {
      const kids = folders.filter((f) => f.parentId === folderId);
      folderId = kids.length ? kids[0].id : await ensureUnclassified(folderId);
    }
    await setBookmarkFolder(bookmarkId, folderId);
  };

  const createBookmark = async (input: { url: string; title: string; description?: string; icon?: string | null; spaceId?: string | null; folderId?: string | null; tagIds?: string[]; favorite?: boolean }) => {
    let finalUrl = input.url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
    let folderId = input.folderId || null;
    if (!folderId && input.spaceId) folderId = await ensureUnclassified(input.spaceId);
    const { data, error } = await supabase.from("bookmarks").insert({
      user_id: userId, url: finalUrl, domain: domainOf(finalUrl),
      title: input.title.trim() || finalUrl, description: input.description?.trim() || null,
      icon: input.icon || null, source: "manual", is_favorite: !!input.favorite,
    }).select("id").single();
    if (error) throw error;
    const bid = data.id as string;
    if (folderId) await supabase.from("bookmark_collections").insert({ bookmark_id: bid, collection_id: folderId, user_id: userId });
    if (input.tagIds?.length) await supabase.from("bookmark_tags").insert(input.tagIds.map((tagId) => ({ bookmark_id: bid, tag_id: tagId, user_id: userId })));
    await load();
    return bid;
  };

  const updateBookmark = async (id: string, patch: { title?: string; url?: string; description?: string | null; icon?: string | null }) => {
    const full: any = { ...patch };
    if (patch.url) { let u = patch.url.trim(); if (!/^https?:\/\//i.test(u)) u = "https://" + u; full.url = u; full.domain = domainOf(u); }
    const { error } = await supabase.from("bookmarks").update(full).eq("id", id).eq("user_id", userId);
    if (error) throw error;
    await load();
  };

  const setBookmarkTags = async (bookmarkId: string, tagIds: string[]) => {
    await supabase.from("bookmark_tags").delete().eq("bookmark_id", bookmarkId).eq("user_id", userId);
    if (tagIds.length) await supabase.from("bookmark_tags").insert(tagIds.map((tagId) => ({ bookmark_id: bookmarkId, tag_id: tagId, user_id: userId })));
    await load();
  };

  const toggleFavorite = async (id: string) => {
    const b = bookmarks.find((x) => x.id === id);
    await supabase.from("bookmarks").update({ is_favorite: !b?.isFavorite }).eq("id", id).eq("user_id", userId);
    await load();
  };

  const toggleReadLater = async (id: string) => {
    const b = bookmarks.find((x) => x.id === id);
    await supabase.from("bookmarks").update({ read_status: b?.readLater ? "read" : "pending" }).eq("id", id).eq("user_id", userId);
    await load();
  };

  const trashBookmark = async (id: string) => {
    await supabase.from("bookmarks").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
    await load();
  };

  const restoreBookmark = async (id: string) => {
    await supabase.from("bookmarks").update({ is_deleted: false, deleted_at: null }).eq("id", id).eq("user_id", userId);
    await load();
  };

  const deleteBookmarkForever = async (id: string) => {
    await supabase.from("bookmark_tags").delete().eq("bookmark_id", id).eq("user_id", userId);
    await supabase.from("bookmark_collections").delete().eq("bookmark_id", id).eq("user_id", userId);
    await supabase.from("bookmarks").delete().eq("id", id).eq("user_id", userId);
    await load();
  };

  const emptyTrash = async () => {
    for (const b of trash) await deleteBookmarkForever(b.id);
  };

  // ===== Tags =====
  const createTag = async (name: string, color: string) => {
    const { data, error } = await supabase.from("tags").insert({ user_id: userId, name: name.trim(), color }).select("id").single();
    if (error) throw error;
    await load();
    return data.id as string;
  };

  const deleteTag = async (id: string) => {
    await supabase.from("bookmark_tags").delete().eq("tag_id", id).eq("user_id", userId);
    await supabase.from("tags").delete().eq("id", id).eq("user_id", userId);
    await load();
  };

  // ===== Notes (básicas) =====
  const createNote = async (title: string) => {
    const { data, error } = await supabase.from("notes").insert({ user_id: userId, title: title.trim() || "Sin título", content: "", color: "default", position: notes.length }).select("id").single();
    if (error) throw error;
    await load();
    return data.id as string;
  };

  const updateNote = async (id: string, patch: { title?: string; content?: string; color?: string; pinned?: boolean }) => {
    const { error } = await supabase.from("notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
    if (error) throw error;
    await load();
  };

  const trashNote = async (id: string) => {
    await supabase.from("notes").update({ deleted: true }).eq("id", id).eq("user_id", userId);
    await load();
  };

  // ===== Import / Export (formato Tabme) =====
  const exportData = () => {
    const data = {
      app: "bookdpb", version: 1, exportedAt: new Date().toISOString(),
      spaces: spaces.map((s) => ({ id: s.id, name: s.name, icon: s.icon, color: s.color, position: s.position })),
      folders: folders.map((f) => ({ id: f.id, spaceId: (() => { let p: string | undefined = f.parentId; const seen = new Set<string>(); while (p && !spaces.some((s) => s.id === p) && !seen.has(p)) { seen.add(p); p = folders.find((x) => x.id === p)?.parentId; } return p || null; })(), parentId: f.parentId, name: f.name, icon: f.icon, color: f.color, position: f.position })),
      bookmarks: bookmarks.map((b) => ({ id: b.id, url: b.url, title: b.title, description: b.description, icon: b.icon, folderId: b.folderId, isFavorite: b.isFavorite, readLater: b.readLater, tags: b.tags.map((t) => t.name) })),
      tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bookdpb-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (json: any, targetSpaceId?: string | null) => {
    if (!json || !Array.isArray(json.bookmarks)) throw new Error("Archivo no válido");
    const idMap = new Map<string, string>();
    // Spaces y folders
    for (const s of json.spaces || []) {
      const nid = await createCollection(s.name || "Space", s.icon || "", s.color || "default", null);
      idMap.set(s.id, nid);
    }
    for (const f of json.folders || []) {
      const newParent = (f.parentId && idMap.get(f.parentId)) || (f.spaceId && idMap.get(f.spaceId)) || targetSpaceId || null;
      const nid = await createCollection(f.name || "Carpeta", f.icon || "", f.color || "default", newParent);
      idMap.set(f.id, nid);
    }
    // Tags
    const tagMap = new Map<string, string>();
    for (const t of json.tags || []) {
      const existing = tags.find((x) => x.name.toLowerCase() === String(t.name).toLowerCase());
      tagMap.set(t.id, existing ? existing.id : await createTag(t.name, t.color || "#2dd4bf"));
    }
    // Bookmarks
    for (const b of json.bookmarks) {
      if (!b.url) continue;
      const folderId = (b.folderId && idMap.get(b.folderId)) || targetSpaceId || null;
      const tagIds = (b.tags || []).map((tn: string) => tags.find((x) => x.name.toLowerCase() === String(tn).toLowerCase())?.id).filter(Boolean);
      await createBookmark({ url: b.url, title: b.title || b.url, description: b.description || "", icon: b.icon || null, folderId, tagIds, favorite: !!b.isFavorite });
      if (b.readLater) { const created = bookmarks.find((x) => x.url === b.url); if (created) await toggleReadLater(created.id); }
    }
    await load();
  };

  return {
    spaces, folders, bookmarks, trash, tags, notes, loading, load,
    childrenOf, descendantsOf, bookmarksIn, countIn,
    createCollection, updateCollection, deleteCollection, reorderCollections, ensureUnclassified,
    setBookmarkFolder, moveBookmark, createBookmark, updateBookmark, setBookmarkTags,
    toggleFavorite, toggleReadLater, trashBookmark, restoreBookmark, deleteBookmarkForever, emptyTrash,
    createTag, deleteTag,
    createNote, updateNote, trashNote,
    exportData, importData,
  };
}

export type TabmeStore = ReturnType<typeof useTabme>;
