export type Sel =
  | { kind: "home" }
  | { kind: "col"; id: string }
  | { kind: "allfolders" }
  | { kind: "favorites" }
  | { kind: "readlater" }
  | { kind: "uncategorized" }
  | { kind: "accounts" }
  | { kind: "assistants" }
  | { kind: "reminders" }
  | { kind: "history" }
  | { kind: "misitems" }
  | { kind: "tags"; tagId?: string }
  | { kind: "trash" }
  | { kind: "notes"; noteId?: string }
  | { kind: "search"; q: string }
  | { kind: "duplicates" };

export function selKey(s: Sel): string {
  switch (s.kind) {
    case "home": return "home";
    case "col": return `col:${s.id}`;
    case "allfolders": return "allfolders";
    case "favorites": return "favorites";
    case "readlater": return "readlater";
    case "uncategorized": return "uncategorized";
    case "accounts": return "accounts";
    case "assistants": return "assistants";
    case "reminders": return "reminders";
    case "history": return "history";
    case "misitems": return "misitems";
    case "tags": return s.tagId ? `tag:${s.tagId}` : "tags";
    case "trash": return "trash";
    case "notes": return "notes";
    case "search": return `search:${s.q}`;
    case "duplicates": return "duplicates";
  }
}
