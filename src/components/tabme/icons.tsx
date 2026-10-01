import * as LucideIcons from "lucide-react";
import type { ReactNode } from "react";

// Convierte el valor guardado de icono en algo dibujable.
// Acepta: "lucide:FolderOpen" (datos viejos) o un emoji directo.
export function renderIcon(icon: string | null | undefined, size = 15, fallback = "📁"): ReactNode {
  const fb = <span className="shrink-0">{fallback}</span>;
  if (!icon) return fb;
  const m = /^lucide:([A-Za-z0-9]+)$/.exec(icon.trim());
  if (m) {
    const Cmp = (LucideIcons as unknown as Record<string, unknown>)[m[1]];
    if (typeof Cmp === "function") {
      const C = Cmp as React.ComponentType<{ size?: number; className?: string }>;
      return <C size={size} className="inline-block shrink-0" />;
    }
    return fb;
  }
  return <span className="shrink-0">{icon}</span>;
}

// Texto plano para <option> y otros sitios sin componentes.
export function iconText(icon: string | null | undefined, fallback: string): string {
  if (!icon) return fallback;
  if (/^lucide:/.test(icon.trim())) return fallback;
  return icon;
}
