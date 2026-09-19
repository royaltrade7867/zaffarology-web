"use client";

import { useEffect, useState } from "react";

/**
 * `?next=` for the sign-up flow: a QR code at a workshop opens
 * `/signup?next=/pricing?plan=annual`, and the person should end on pricing
 * after creating the account and confirming the email, not on Home.
 *
 * Only an in-app path is accepted ("/…" but not "//…"), exactly as login has
 * always done, so the parameter cannot send anyone to another site.
 */
export const safeNext = (raw: string | null | undefined): string | null =>
  raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;

/** Read `?next=` in the browser, after mount (no Suspense boundary needed).
 *  `undefined` until it has been read, then the path or `null`, so a redirect
 *  can wait for it instead of firing to Home a moment too early. */
export function useNextParam(): string | null | undefined {
  const [next, setNext] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);
  return next;
}

/** `"?next=…"` to append to a link or redirect, or `""` when there is none. */
export const nextQuery = (next: string | null | undefined): string => (next ? `?next=${encodeURIComponent(next)}` : "");
