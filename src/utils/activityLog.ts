import { SupabaseClient } from "@supabase/supabase-js";

export type ActivityAction =
  | "bookmark_added"
  | "bookmark_edited"
  | "bookmark_deleted"
  | "bookmark_restored"
  | "bookmark_pinned"
  | "bookmark_unpinned"
  | "bookmark_favorited"
  | "bookmark_unfavorited"
  | "bookmark_moved"
  | "collection_created"
  | "collection_updated"
  | "collection_deleted"
  | "tag_created"
  | "tag_edited"
  | "tag_deleted";

/**
 * Registra una actividad en el historial.
 * No bloquea la acción principal si falla.
 */
export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  action: ActivityAction,
  entityType: string,
  entityId: string | null,
  entityName: string | null,
  details?: string
): Promise<void> {
  try {
    await supabase.from("activity_log").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      details: details || null,
    });
  } catch (error) {
    console.error("Error registrando actividad:", error);
  }
}

/**
 * Mapa de acciones a descripciones legibles.
 */
export const actionLabels: Record<ActivityAction, string> = {
  bookmark_added: "Agregaste un marcador",
  bookmark_edited: "Editaste un marcador",
  bookmark_deleted: "Enviaste un marcador a la papelera",
  bookmark_restored: "Restauraste un marcador",
  bookmark_pinned: "Fijaste un marcador",
  bookmark_unpinned: "Desfijaste un marcador",
  bookmark_favorited: "Marcaste como favorito",
  bookmark_unfavorited: "Quitaste de favoritos",
  bookmark_moved: "Moviste un marcador",
  collection_created: "Creaste una colección",
  collection_updated: "Editaste una colección",
  collection_deleted: "Eliminaste una colección",
  tag_created: "Creaste una etiqueta",
  tag_edited: "Editaste una etiqueta",
  tag_deleted: "Eliminaste una etiqueta",
};

/**
 * Mapa de acciones a íconos.
 */
export const actionIcons: Record<ActivityAction, string> = {
  bookmark_added: "➕",
  bookmark_edited: "✏️",
  bookmark_deleted: "🗑️",
  bookmark_restored: "↩️",
  bookmark_pinned: "📌",
  bookmark_unpinned: "📌",
  bookmark_favorited: "⭐",
  bookmark_unfavorited: "☆",
  bookmark_moved: "📁",
  collection_created: "📁",
  collection_updated: "✏️",
  collection_deleted: "🗑️",
  tag_created: "🏷️",
  tag_edited: "🏷️",
  tag_deleted: "🗑️",
};