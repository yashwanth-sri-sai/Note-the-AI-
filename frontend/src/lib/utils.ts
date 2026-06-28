import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips HTML tags, decodes HTML entities, preserves block spaces,
 * and truncates the resulting plain text to create a clean note preview.
 */
export function getNotePreview(html: string | null | undefined, maxLength: number = 150): string {
  if (!html) return "";

  // 1. Replace line breaks and block element closing tags with spaces to prevent words from running together
  let text = html.replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/<\/(p|div|h[1-6]|li|pre|blockquote|tr)>/gi, " ");

  // 2. Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // 3. Convert common HTML entities
  const entityMap: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'",
    "&apos;": "'",
    "&ndash;": "-",
    "&mdash;": "-",
  };

  text = text.replace(/&[a-z0-9#]+;/gi, (entity) => {
    const lower = entity.toLowerCase();
    if (entityMap[lower]) {
      return entityMap[lower];
    }
    if (entity.startsWith("&#")) {
      const code = parseInt(entity.slice(2, -1), 10);
      if (!isNaN(code)) {
        return String.fromCharCode(code);
      }
    }
    return entity;
  });

  // 4. Collapse multiple consecutive whitespaces and trim
  text = text.replace(/\s+/g, " ").trim();

  // 5. Truncate cleanly
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trim() + "...";
}

