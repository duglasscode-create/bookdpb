// ============================================
// GENERADOR DE CAPTURAS DE PANTALLA
// ============================================
// Usamos WordPress mShots, un servicio GRATUITO que genera
// capturas reales de sitios web sin necesidad de API key.
// Es el mismo servicio que usa WordPress para sus previews.

/**
 * Genera la URL de captura de pantalla para un sitio web
 */
export function getScreenshotUrl(
  url: string,
  width: number = 1200,
  height: number = 800
): string {
  // mShots requiere que la URL esté codificada
  const encodedUrl = encodeURIComponent(url);
  return `https://s.wordpress.com/mshots/v1/${encodedUrl}?w=${width}&h=${height}`;
}

/**
 * Genera una URL de captura más pequeña (para mejor rendimiento)
 */
export function getSmallScreenshotUrl(url: string): string {
  return getScreenshotUrl(url, 600, 400);
}