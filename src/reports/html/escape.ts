/**
 * The single escaping primitive for report HTML.
 *
 * Every pillar field is free text the user typed, and Pillar 8 stores a
 * user-supplied URL that would otherwise land in an `href`. Interpolating any of
 * it raw produces broken output at best. The rule: no user value reaches the
 * template without passing through `esc`.
 */

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape, then honour the hard line breaks the app allows (max 5 per field). */
export function escMultiline(v: unknown): string {
  return esc(v).replace(/\r?\n/g, '<br>');
}

/**
 * Only http(s) URLs may become links. A `javascript:` or `data:` value typed into
 * the records pillar must render as inert text, never as a clickable href.
 */
export function safeUrl(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  return /^https?:\/\//i.test(withScheme) ? withScheme : null;
}

/** A link when the URL is safe, escaped plain text when it is not. */
export function linkOrText(raw: unknown): string {
  const url = safeUrl(raw);
  const label = esc(raw);
  return url ? `<a href="${esc(url)}">${label}</a>` : label;
}
