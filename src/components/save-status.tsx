"use client";

import type { SaveStatus } from "@/lib/use-pillar-state";

/**
 * Tells the user when a save has NOT landed.
 *
 * The app has no save button, so silence has always meant "saved". When a write
 * failed it also meant "saved" — the screen kept showing text the server never
 * received, and the next reload replaced it with the older server copy. This is
 * the missing half of that contract.
 *
 * Deliberately silent while idle: a permanent "Saved" badge trains people to
 * ignore the spot where the real warning appears. Only "saving" (after a beat)
 * and "error" say anything.
 */
export function SaveStatusBar({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  if (status !== "error") return null;
  return (
    <div
      role="alert"
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-danger bg-surface px-3.5 py-2.5"
    >
      <span className="text-[13.5px] font-semibold text-heading">
        Not saved yet. We&rsquo;ll keep trying.
      </span>
      <span className="text-[13px] text-muted">
        Your changes are safe on this device, even if you reload.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="ml-auto min-h-[32px] rounded-lg border border-line px-3 text-[13px] font-semibold text-heading transition-colors hover:bg-line-soft"
      >
        Try now
      </button>
    </div>
  );
}
