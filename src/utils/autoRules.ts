import { SupabaseClient } from "@supabase/supabase-js";

export type AutoRule = {
  id: string;
  name: string;
  match_type: "domain" | "keyword";
  match_value: string;
  collection_id: string | null;
  is_active: boolean;
};

/**
 * Aplica las reglas de auto-categorización a un marcador.
 * Retorna el collection_id asignado o null si no hay coincidencia.
 */
export async function applyAutoRules(
  supabase: SupabaseClient,
  userId: string,
  bookmarkId: string,
  domain: string | null,
  url: string
): Promise<string | null> {
  try {
    // Buscar reglas activas del usuario
    const { data: rules } = await supabase
      .from("auto_rules")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!rules || rules.length === 0) return null;

    // Buscar la primera regla que coincida
    for (const rule of rules) {
      let matches = false;

      if (rule.match_type === "domain") {
        // Coincidencia por dominio exacto o subdominio
        const ruleDomain = rule.match_value.toLowerCase().trim();
        const bookmarkDomain = domain?.toLowerCase() || "";

        matches =
          bookmarkDomain === ruleDomain ||
          bookmarkDomain.endsWith("." + ruleDomain);
      } else if (rule.match_type === "keyword") {
        // Coincidencia por palabra clave en la URL
        const keyword = rule.match_value.toLowerCase().trim();
        matches = url.toLowerCase().includes(keyword);
      }

      if (matches && rule.collection_id) {
        // Verificar que el marcador no esté ya en esa colección
        const { data: existing } = await supabase
          .from("bookmark_collections")
          .select("id")
          .eq("bookmark_id", bookmarkId)
          .eq("collection_id", rule.collection_id)
          .limit(1);

        if (!existing || existing.length === 0) {
          // Asignar a la colección
          await supabase.from("bookmark_collections").insert({
            bookmark_id: bookmarkId,
            collection_id: rule.collection_id,
            user_id: userId,
          });
        }

        return rule.collection_id;
      }
    }

    return null;
  } catch (error) {
    console.error("Error aplicando reglas automáticas:", error);
    return null;
  }
}

/**
 * Aplica las reglas a todos los marcadores existentes.
 * Retorna el número de marcadores asignados.
 */
export async function applyAutoRulesToAll(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  try {
    // Buscar reglas activas
    const { data: rules } = await supabase
      .from("auto_rules")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!rules || rules.length === 0) return 0;

    // Buscar todos los marcadores activos
    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select("id, url, domain")
      .eq("user_id", userId)
      .eq("is_deleted", false);

    if (!bookmarks || bookmarks.length === 0) return 0;

    let assignedCount = 0;

    for (const bookmark of bookmarks) {
      const collectionId = await applyAutoRules(
        supabase,
        userId,
        bookmark.id,
        bookmark.domain,
        bookmark.url
      );

      if (collectionId) {
        assignedCount++;
      }
    }

    return assignedCount;
  } catch (error) {
    console.error("Error aplicando reglas a todos:", error);
    return 0;
  }
}