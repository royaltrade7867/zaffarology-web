/**
 * Where a swallowed error goes.
 *
 * The mobile app has the same entry point. There is no crash reporter wired up
 * on either yet, so this is deliberately a console log — the point is that
 * every `catch` names its area, so a silent failure is greppable rather than
 * invisible. Screens still surface their own user-facing message; this is the
 * developer-facing half.
 */
export function reportError(err: unknown, context: Record<string, unknown> = {}): void {
  if (typeof console === "undefined") return;
  // eslint-disable-next-line no-console
  console.error("[zaffarology]", context, err);
}
