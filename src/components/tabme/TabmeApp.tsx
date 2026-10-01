"use client";
import { useState, useEffect } from "react";
import { useTabme, type TBookmark } from "@/lib/tabme-store";
import type { Sel } from "./types";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { MainView, type UIActions } from "./Views";
import { NotesView } from "./NotesView";
import {
  SaveBookmarkModal, EditBookmarkModal, CollectionModal,
  ConfirmModal, TagModal, SettingsModal,
  AccountModal, AccountDetailModal, AssistantModal, ReminderModal,
  NewItemModal, HelpModal,
} from "./Modals";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type ModalState =
  | { kind: "saveBookmark"; preset?: { spaceId?: string; folderId?: string } }
  | { kind: "editBookmark"; bm: TBookmark }
  | { kind: "collection"; parentId: string | null; isSpace: boolean; editId?: string }
  | { kind: "confirm"; title: string; message: string; dangerLabel: string; onYes: () => void }
  | { kind: "tag" }
  | { kind: "settings" }
  | { kind: "account"; editId?: string }
  | { kind: "accountDetail"; accountId: string }
  | { kind: "assistant"; editId?: string }
  | { kind: "reminder"; editId?: string }
  | { kind: "newItem" }
  | { kind: "help" }
  | null;

export function TabmeApp({ userId }: { userId: string }) {
  const store = useTabme(userId);
  const router = useRouter();
  const [sel, setSel] = useState<Sel>({ kind: "home" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
    newAccount: () => setModal({ kind: "account" }),
    editAccount: (editId) => setModal({ kind: "account", editId }),
    viewAccount: (accountId) => setModal({ kind: "accountDetail", accountId }),
    newAssistant: () => setModal({ kind: "assistant" }),
    editAssistant: (editId) => setModal({ kind: "assistant", editId }),
    newReminder: () => setModal({ kind: "reminder" }),
    editReminder: (editId) => setModal({ kind: "reminder", editId }),
    confirm: (title, message, dangerLabel, onYes) => setModal({ kind: "confirm", title, message, dangerLabel, onYes }),
  };

  const newFolderHere = () => {
    if (sel.kind === "col") {
      const isSpace = store.spaces.some((s) => s.id === sel.id);
      ui.newCollection(sel.id, !isSpace ? false : false);
    } else {
      ui.newCollection(store.spaces[0]?.id || null, false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar
        store={store}
        onSelect={setSel}
        onBackup={() => store.exportData()}
        onDuplicates={() => setSel({ kind: "duplicates" })}
        onNewFolder={newFolderHere}
        onNewBookmark={() => ui.newBookmark()}
        onNewNote={async () => { const id = await store.createNote("Nueva nota"); setSel({ kind: "notes" }); }}
        onOpenSettings={() => setModal({ kind: "settings" })}
        onLogout={logout}
        onHelp={() => setModal({ kind: "help" })}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        onMenu={() => setMobileOpen(true)}
      />

      <div className="app-body">
        <Sidebar
          store={store}
          userId={userId}
          sel={sel}
          onSelect={setSel}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onNewSpace={() => ui.newCollection(null, true)}
          onEditCollection={ui.editCollection}
          onDeleteCollection={ui.deleteCollection}
          onNewSub={(parentId) => ui.newCollection(parentId, false)}
          onNewItem={() => setModal({ kind: "newItem" })}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main className="main">
          {store.loading ? (
            <div className="empty"><span className="big">⏳</span>Cargando tus spaces...</div>
          ) : sel.kind === "notes" ? (
            <NotesView store={store} />
          ) : (
            <MainView store={store} ui={ui} sel={sel} />
          )}
        </main>
      </div>

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
        <SettingsModal store={store} theme={theme} onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "account" && <AccountModal store={store} editId={modal.editId} onClose={() => setModal(null)} />}
      {modal?.kind === "accountDetail" && (
        <AccountDetailModal store={store} accountId={modal.accountId} onClose={() => setModal(null)} onEdit={() => setModal({ kind: "account", editId: modal.accountId })} />
      )}
      {modal?.kind === "assistant" && <AssistantModal store={store} editId={modal.editId} onClose={() => setModal(null)} />}
      {modal?.kind === "reminder" && <ReminderModal store={store} editId={modal.editId} onClose={() => setModal(null)} />}
      {modal?.kind === "newItem" && (
        <NewItemModal
          onClose={() => setModal(null)}
          onPick={(k) => setModal(k === "account" ? { kind: "account" } : k === "assistant" ? { kind: "assistant" } : { kind: "reminder" })}
        />
      )}
      {modal?.kind === "help" && <HelpModal onClose={() => setModal(null)} />}
    </div>
  );
}
