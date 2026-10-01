export type Sel =
  | { kind: "home" }
  | { kind: "col"; id: string }
  | { kind: "favorites" }
  | { kind: "readlater" }
  | { kind: "uncategorized" }
  | { kind: "tags"; tagId?: string }
  | { kind: "trash" }
  | { kind: "notes"; noteId?: string }
  | { kind: "search"; q: string };

export function selKey(s: Sel): string {
  switch (s.kind) {
    case "home": return "home";
    case "col": return `col:${s.id}`;
    case "favorites": return "favorites";
    case "readlater": return "readlater";
    case "uncategorized": return "uncategorized";
    case "tags": return s.tagId ? `tag:${s.tagId}` : "tags";
    case "trash": return "trash";
    case "notes": return "notes";
    case "search": return `search:${s.q}`;
  }
}
