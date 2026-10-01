export type NotionColor =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red";

export const COLOR_OPTIONS: { value: NotionColor; label: string }[] = [
  { value: "default", label: "Predeterminado" },
  { value: "gray", label: "Gris" },
  { value: "brown", label: "Marrón" },
  { value: "orange", label: "Naranja" },
  { value: "yellow", label: "Amarillo" },
  { value: "green", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "purple", label: "Morado" },
  { value: "pink", label: "Rosa" },
  { value: "red", label: "Rojo" },
];

// Convierte colores antiguos (blue, amber, emerald...) a la nueva paleta Notion
const LEGACY_MAP: Record<string, NotionColor> = {
  default: "default",
  gray: "gray",
  slate: "gray",
  brown: "brown",
  orange: "orange",
  amber: "yellow",
  yellow: "yellow",
  emerald: "green",
  teal: "green",
  green: "green",
  cyan: "blue",
  blue: "blue",
  indigo: "blue",
  violet: "purple",
  purple: "purple",
  fuchsia: "pink",
  pink: "pink",
  red: "red",
};

export function normalizeColor(color: string | null | undefined): NotionColor {
  if (!color) return "default";
  return LEGACY_MAP[color] ?? "default";
}

// Estilos CSS para usar los colores de bloque según el tema activo
export const blockTextStyle = (color: string | null | undefined) => ({
  color: `var(--blk-${normalizeColor(color)}-text)`,
});

export const blockBgStyle = (color: string | null | undefined) => ({
  backgroundColor: `var(--blk-${normalizeColor(color)}-bg)`,
});

export const blockIconStyle = (color: string | null | undefined) => ({
  color: `var(--blk-${normalizeColor(color)}-icon)`,
});

export const blockBorderTopStyle = (color: string | null | undefined) => ({
  borderTopColor: `var(--blk-${normalizeColor(color)}-icon)`,
});