// Tipos para los marcadores importados
export interface ImportedBookmark {
  title: string;
  url: string;
  folder: string | null;
  addDate?: string;
}

export interface ImportedFolder {
  name: string;
  parentFolder: string | null;
}

export interface ParseResult {
  bookmarks: ImportedBookmark[];
  folders: ImportedFolder[];
}

// Parser de archivo HTML de marcadores (formato Netscape)
export function parseBookmarksHTML(html: string): ParseResult {
  const bookmarks: ImportedBookmark[] = [];
  const folders: ImportedFolder[] = [];
  const folderStack: string[] = [];

  // Crear un parser DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Función recursiva para procesar nodos
  function processNode(node: Element, currentFolder: string | null) {
    const children = node.children;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      if (child.tagName === "DT") {
        // Buscar carpeta (H3)
        const h3 = child.querySelector(":scope > H3");
        if (h3) {
          const folderName = h3.textContent?.trim() || "";
          if (folderName) {
            folderStack.push(folderName);
            folders.push({
              name: folderName,
              parentFolder: currentFolder,
            });
          }
        }

        // Buscar marcador (A)
        const a = child.querySelector(":scope > A");
        if (a) {
          const url = a.getAttribute("HREF") || "";
          const title = a.textContent?.trim() || url;
          const addDate = a.getAttribute("ADD_DATE");

          if (url && !url.startsWith("place:") && !url.startsWith("javascript:")) {
            bookmarks.push({
              title,
              url,
              folder: folderStack.length > 0 ? folderStack[folderStack.length - 1] : null,
              addDate: addDate || undefined,
            });
          }
        }

        // Buscar sublista (DL)
        const dl = child.querySelector(":scope > DL");
        if (dl) {
          processNode(dl, folderStack.length > 0 ? folderStack[folderStack.length - 1] : null);
        }
      } else if (child.tagName === "DL") {
        processNode(child, currentFolder);
      }
    }

    // Pop folder al terminar de procesar hijos
    if (node.tagName === "DL" && folderStack.length > 0) {
      // Solo pop si este DL es hijo directo de un DT con H3
      const parent = node.parentElement;
      if (parent && parent.tagName === "DT") {
        const h3 = parent.querySelector(":scope > H3");
        if (h3) {
          folderStack.pop();
        }
      }
    }
  }

  // Comenzar desde el body
  const body = doc.body;
  if (body) {
    processNode(body, null);
  }

  return { bookmarks, folders };
}

// Convertir fecha de Unix timestamp a Date
export function parseAddDate(addDate?: string): Date | null {
  if (!addDate) return null;

  const timestamp = parseInt(addDate, 10);
  if (isNaN(timestamp)) return null;

  // Los timestamps de marcadores están en segundos
  return new Date(timestamp * 1000);
}

// Obtener dominio de una URL
export function getDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return null;
  }
}

// Generar slug desde nombre
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}