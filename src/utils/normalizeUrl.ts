// Parámetros de tracking que debemos ignorar al comparar URLs
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "yclid",
  "igshid",
  "ref",
  "referrer",
  "source",
];

/**
 * Normaliza una URL para comparación.
 * - Convierte a minúsculas el hostname
 * - Quita www.
 * - Quita trailing slashes
 * - Quita parámetros de tracking
 * - Quita el fragmento (#)
 * - Normaliza http/https
 */
export function normalizeUrl(url: string): string {
  try {
    // Asegurar que tenga protocolo
    let urlString = url.trim();
    if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
      urlString = "https://" + urlString;
    }

    const urlObj = new URL(urlString);

    // Normalizar hostname (minúsculas, quitar www.)
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    // Normalizar pathname (quitar trailing slash)
    let pathname = urlObj.pathname;
    if (pathname.endsWith("/") && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    // Filtrar parámetros de query (quitar tracking params)
    const searchParams = new URLSearchParams();
    urlObj.searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!TRACKING_PARAMS.includes(lowerKey)) {
        searchParams.append(key, value);
      }
    });

    // Ordenar parámetros para consistencia
    searchParams.sort();

    const queryString = searchParams.toString();
    const query = queryString ? `?${queryString}` : "";

    // Construir URL normalizada (sin fragmento)
    return `${hostname}${pathname}${query}`;
  } catch {
    // Si no es una URL válida, devolver la original limpia
    return url.trim().toLowerCase();
  }
}

/**
 * Verifica si dos URLs son la misma después de normalizar
 */
export function isSameUrl(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Busca duplicados en una lista de URLs existentes
 */
export function findDuplicate(
  newUrl: string,
  existingUrls: { id: string; url: string; title: string | null }[]
): { id: string; url: string; title: string | null } | null {
  const normalizedNew = normalizeUrl(newUrl);

  for (const existing of existingUrls) {
    if (normalizeUrl(existing.url) === normalizedNew) {
      return existing;
    }
  }

  return null;
}