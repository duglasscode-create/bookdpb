"use client";
import { useState, useEffect } from "react";
import { useTabme, type TBookmark } from "@/lib/tabme-store";
import type { Sel } from "./types";
import { Sidebar } from "./Sidebar";
import { MainView, type UIActions } from "./Views";
import { NotesView } from "./NotesView";
import {
  SaveBookmarkModal, EditBookmarkModal, CollectionModal,
  ConfirmModal, TagModal, SettingsModal,
} from "./Modals";
import { Menu, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type ModalState =
  | { kind: "saveBookmark"; preset?: { spaceId?: string; folderId?: string } }
  | { kind: "editBookmark"; bm: TBookmark }
  | { kind: "collection"; parentId: string | null; isSpace: boolean; editId?: string }
  | { kind: "confirm"; title: string; message: string; dangerLabel: string; onYes: () => void }
  | { kind: "tag" }
  | { kind: "settings" }
  | null;

function titleFor(sel: Sel): string {
  switch (sel.kind) {
    case "home": return "Inicio";
    case "favorites": return "Favoritos";
    case "readlater": return "Leer después";
    case "uncategorized": return "Sin carpeta";
    case "tags": return "Etiquetas";
    case "trash": return "Papelera";
    case "notes": return "Notas";
    case "search": return "Buscar";
    case "col": return "";
  }
}

export function TabmeApp({ userId }: { userId: string }) {
  const store = useTabme(userId);
  const router = useRouter();
  const [sel, setSel] = useState<Sel>({ kind: "home" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Expandir spaces por defecto al cargar
  useEffect(() => {
    if (store.spaces.length && expanded.size === 0) {
      setExpanded(new Set(store.spaces.map((s) => s.id)));
    }
  }, [store.spaces]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
  };

  const ui: UIActions = {
    select: (s) => setSel(s),
    newBookmark: (preset) => setModal({ kind: "saveBookmark", preset }),
    editBookmark: (bm) => setModal({ kind: "editBookmark", bm }),
    newCollection: (parentId, isSpace) => setModal({ kind: "collection", parentId, isSpace }),
    editCollection: (editId) => {
      const isSpace = store.spaces.some((s) => s.id === editId);
      setModal({ kind: "collection", parentId: null, isSpace, editId });
    },
    deleteCollection: (id, name) =>
      setModal({
        kind: "confirm",
        title: "Eliminar",
        message: `¿Eliminar "${name}" y sus subcarpetas? Los marcadores que contenía quedarán en "Sin carpeta". Esta acción no se puede deshacer.`,
        dangerLabel: "Eliminar",
        onYes: async () => {
          await store.deleteCollection(id);
          if (sel.kind === "col") setSel({ kind: "home" });
        },
      }),
    newTag: () => setModal({ kind: "tag" }),
    confirm: (title, message, dangerLabel, onYes) => setModal({ kind: "confirm", title, message, dangerLabel, onYes }),
  };

  const colTitle = sel.kind === "col"
    ? store.spaces.find((s) => s.id === sel.id)?.name || store.folders.find((f) => f.id === sel.id)?.name || ""
    : titleFor(sel);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar
        store={store} sel={sel} onSelect={setSel}
        expanded={expanded} onToggleExpand={toggleExpand}
        onNewSpace={() => ui.newCollection(null, true)}
        onNewBookmark={() => ui.newBookmark()}
        onOpenSettings={() => setModal({ kind: "settings" })}
        theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <button className="t-icon-btn md:hidden" onClick={() => setMobileOpen(true)} title="Menú"><Menu size={19} /></button>
          <h2 className="flex-1 truncate text-[15px] font-bold">{colTitle}</h2>
          <button className="t-icon-btn" onClick={logout} title="Cerrar sesión"><LogOut size={17} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {store.loading ? (
            <div className="flex h-64 items-center justify-center">
              <p style={{ color: "var(--muted)" }}>Cargando tus spaces...</p>
            </div>
          ) : sel.kind === "notes" ? (
            <NotesView store={store} />
          ) : (
            <MainView store={store} ui={ui} sel={sel} />
          )}
        </div>
      </main>

      {modal?.kind === "saveBookmark" && <SaveBookmarkModal store={store} preset={modal.preset} onClose={() => setModal(null)} />}
      {modal?.kind === "editBookmark" && <EditBookmarkModal store={store} bm={modal.bm} onClose={() => setModal(null)} />}
      {modal?.kind === "collection" && (
        <CollectionModal store={store} parentId={modal.parentId} isSpace={modal.isSpace} editId={modal.editId} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "confirm" && (
        <ConfirmModal title={modal.title} message={modal.message} dangerLabel={modal.dangerLabel} onYes={modal.onYes} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "tag" && <TagModal store={store} onClose={() => setModal(null)} />}
      {modal?.kind === "settings" && (
        <SettingsModal store={store} theme={theme} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
