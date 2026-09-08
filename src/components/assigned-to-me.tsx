"use client";

/**
 * Tasks other people assigned to you, rendered ABOVE your own board.
 *
 * These are never merged into the pillar blob. Keeping them out is what makes
 * "you can't edit the assigner's wording" structural rather than a UI rule: the
 * title lives on a server row this user cannot write, so no client can change
 * it. It also means a whole-blob overwrite — the normal risk with an unsynced
 * offline edit — cannot delete a task someone assigned you.
 *
 * So this renders read-only text with ONE control: done / not done.
 */
import { useState } from "react";

import { Inbox } from "@/components/icons";
import { cx } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import { friendlyISO } from "@/lib/dates";
import type { ApiIncomingAssignment } from "@/lib/connections-api";

export function AssignedToMe({
  rows,
  onToggle,
  accent,
}: {
  rows: ApiIncomingAssignment[];
  onToggle: (id: number, done: boolean) => Promise<void>;
  accent: string;
}) {
  const [busy, setBusy] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!rows.length) return null;

  const toggle = async (row: ApiIncomingAssignment) => {
    if (busy.includes(row.id)) return;
    const done = row.status !== "completed";
    setBusy((b) => [...b, row.id]);
    setError(null);
    try {
      await onToggle(row.id, done);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update that task. Check your connection."));
    } finally {
      setBusy((b) => b.filter((x) => x !== row.id));
    }
  };

  const open = rows.filter((r) => r.status !== "completed").length;

  return (
    <section
      className="mb-6 rounded-2xl border bg-surface p-4"
      style={{ borderColor: accent }}
      aria-label="Tasks assigned to you"
    >
      <div className="mb-3 flex items-center gap-2">
        <Inbox size={16} style={{ color: accent }} />
        <h2 className="font-heading text-[13px] uppercase tracking-wide" style={{ color: accent }}>
          Assigned to you
        </h2>
        <span className="ml-auto text-[12px] tabular-nums text-muted">
          {open} of {rows.length} to do
        </span>
      </div>

      <ul className="space-y-1.5">
        {rows.map((r) => {
          const done = r.status === "completed";
          const when = friendlyISO(r.due) ?? r.due;
          return (
            <li key={r.id} className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5">
              <input
                type="checkbox"
                checked={done}
                disabled={busy.includes(r.id)}
                onChange={() => toggle(r)}
                aria-label={`Mark "${r.title}" ${done ? "not done" : "done"}`}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[color:var(--gold)]"
              />
              <span className="min-w-0 flex-1">
                {/* Read-only on purpose: the assigner owns the wording. */}
                <span
                  className={cx(
                    "block text-[14.5px] leading-snug",
                    done ? "text-muted line-through" : "text-ink",
                  )}
                >
                  {r.title}
                </span>
                <span className="mt-0.5 block text-[12px] text-muted">
                  From {r.from_name}
                  {when ? ` · due ${when}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="mt-2 text-[13px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
