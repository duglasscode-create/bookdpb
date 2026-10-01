"use client";
import { useState, useEffect, useRef } from "react";
import type { TabmeStore } from "@/lib/tabme-store";
import { Plus, Pin, Trash2, Search, ArrowLeft } from "lucide-react";

const NOTE_COLORS: Record<string, string> = {
  default: "var(--card)", yellow: "#fef3c7", green: "#d1fae5", blue: "#dbeafe", pink: "#fce7f3", purple: "#ede9fe",
};

export function NotesView({ store }: { store: TabmeStore }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("default");
  const timer = useRef<any>(null);

  const active = store.notes.find((n) => n.id === activeId) || null;
  const filtered = store.notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (active) { setTitle(active.title); setContent(active.content); setColor(active.color); }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = (patch: { title?: string; content?: string; color?: string }) => {
    if (!activeId) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => store.updateNote(activeId, patch), 600);
  };

  const newNote = async () => {
    const id = await store.createNote("Nueva nota");
    setActiveId(id);
  };

  const list = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input className="t-input" style={{ paddingLeft: 32, fontSize: 13 }} placeholder="Buscar notas..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="t-btn t-btn-primary" style={{ minHeight: 38, padding: "8px 10px" }} onClick={newNote} title="Nueva nota"><Plus size={16} /></button>
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3 pt-0">
        {filtered.map((n) => (
          <button key={n.id} onClick={() => setActiveId(n.id)}
            className="w-full rounded-xl border p-3 text-left transition"
            style={{
              background: NOTE_COLORS[n.color] || "var(--card)",
              borderColor: activeId === n.id ? "var(--accent)" : "var(--border)",
              color: n.color === "default" ? "var(--text)" : "#1c1e26",
            }}>
            <p className="truncate text-sm font-semibold">{n.pinned ? "📌 " : ""}{n.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs opacity-70">{n.content.slice(0, 120) || "Sin contenido"}</p>
          </button>
        ))}
        {filtered.length === 0 && <p className="py-8 text-center text-sm" style={{ color: "var(--muted)" }}>Sin notas.</p>}
      </div>
    </div>
  );

  const editor = active ? (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2">
        <button className="t-icon-btn lg:hidden" onClick={() => setActiveId(null)}><ArrowLeft size={17} /></button>
        <input className="t-input flex-1" style={{ fontSize: 16, fontWeight: 700 }} value={title}
          onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }); }} placeholder="Título" />
        <button className={`t-icon-btn ${active.pinned ? "on" : ""}`} title="Fijar" onClick={() => store.updateNote(active.id, { pinned: !active.pinned })}>
          <Pin size={16} />
        </button>
        <button className="t-icon-btn" title="Eliminar" onClick={() => { store.trashNote(active.id); setActiveId(null); }}>
          <Trash2 size={16} />
        </button>
      </div>
      <div className="mb-3 flex gap-1.5">
        {Object.entries(NOTE_COLORS).map(([k, v]) => (
          <button key={k} onClick={() => { setColor(k); scheduleSave({ color: k }); }}
            className="h-7 w-7 rounded-full border" style={{ background: v, borderColor: color === k ? "var(--accent)" : "var(--border)", borderWidth: color === k ? 2 : 1 }} />
        ))}
      </div>
      <textarea className="t-input flex-1 resize-none" style={{ lineHeight: 1.6 }} value={content}
        onChange={(e) => { setContent(e.target.value); scheduleSave({ content: e.target.value }); }} placeholder="Escribe tu nota..." />
      <p className="mt-2 text-right text-[11px]" style={{ color: "var(--muted)" }}>Autoguardado ✓</p>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <p className="mb-2 text-4xl">📝</p>
        <p className="font-semibold">Elige una nota</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>o crea una nueva con ＋</p>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold tracking-tight">📝 Notas</h2>
      <div className="t-card flex overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: 420 }}>
        <div className={`w-full lg:w-[320px] lg:shrink-0 lg:border-r ${activeId ? "hidden lg:block" : ""}`} style={{ borderColor: "var(--border)" }}>
          {list}
        </div>
        <div className={`flex-1 ${activeId ? "" : "hidden lg:block"}`}>
          {editor}
        </div>
      </div>
    </div>
  );
}
