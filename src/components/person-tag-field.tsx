"use client";

/**
 * A name field that can also TAG a connection.
 *
 * Free-typed names keep working everywhere — tagging is additive and never
 * forced. Picking a suggestion assigns the task: it appears on that person's
 * board, and optionally emails them.
 *
 * Ported from `zaffarology-mobileapp/src/components/person-tag-field.tsx`,
 * including the confirm-before-send dialog that replaced the old 30s undo
 * window: catching a mis-tap at the point of decision is clearer than chasing
 * it afterwards. BOTH non-cancel answers assign — only the email differs — so
 * the wording has to say that, or "just tag" reads like it cancels.
 */
import { useMemo, useRef, useState } from "react";

import { Close } from "@/components/icons";
import { cx } from "@/components/ui";
import type { Partner } from "@/lib/use-connections";

const MAX_SUGGESTIONS = 5;

export function PersonTagField({
  label,
  value,
  onChangeText,
  partners,
  tagUserId,
  onTag,
  placeholder,
  accent,
  multi = false,
  maxLength = 2000,
  statusNote,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  partners: Partner[];
  /** Set when this field currently carries a tag (single mode). */
  tagUserId?: string;
  /** `null` untags. `notify` says whether to email as well as assign. */
  onTag: (p: Partner | null, notify?: boolean, untagUserId?: number) => void;
  placeholder?: string;
  accent?: string;
  /** Comma-separated list of names, with tagged ones shown as chips. */
  multi?: boolean;
  maxLength?: number;
  /** "Sent to X, waiting" / "X marked this done" — shown under the field. */
  statusNote?: string | null;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tint = accent ?? "var(--gold)";

  const tagged = partners.find((p) => String(p.userId) === tagUserId) ?? null;
  const hasTag = !!tagUserId;

  /** In multi mode the value is a list; everything before the last comma is
   *  committed, the tail is what the user is still typing. */
  const committed = multi ? value.split(",").slice(0, -1).map((n) => n.trim()).filter(Boolean) : [];
  const draft = multi ? value.split(",").pop() ?? "" : value;

  const setAll = (names: string[], tail: string) =>
    onChangeText([...names, tail].join(", ").replace(/,\s*$/, tail ? "" : ", "));

  /**
   * Matches the START of any word in the name (or the email), not any position
   * inside it: a bare `includes` made typing "H" match "Sarah" and "Ahmed" as
   * well as "Hammad". Nothing is suggested for an empty field — focus alone
   * should not pop a list open on a field the user has not typed in.
   */
  const suggestions = useMemo(() => {
    if (hasTag || !focused || !partners.length) return [];
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    const startsWord = (name: string) =>
      name
        .toLowerCase()
        .split(/[\s.'-]+/)
        .some((word) => word.startsWith(q));
    const pool = partners.filter(
      (p) => startsWord(p.name) || p.email.toLowerCase().startsWith(q),
    );
    // Once the name is fully typed there is nothing left to suggest.
    if (pool.length === 1 && pool[0].name.toLowerCase() === q) return [];
    // In a list, do not re-offer someone already in it.
    if (multi) {
      const have = new Set(committed.map((n) => n.toLowerCase()));
      return pool.filter((p) => !have.has(p.name.trim().toLowerCase())).slice(0, MAX_SUGGESTIONS);
    }
    return pool.slice(0, MAX_SUGGESTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners, draft, focused, hasTag, multi, value]);

  /** Ask before anything leaves, then tag. */
  const pick = (p: Partner) => {
    const notify = window.confirm(
      `Email ${p.name}?\n\n` +
        `${p.name} will be tagged on this either way — it appears on their board. ` +
        `OK also emails them about it; Cancel just tags them.`,
    );
    if (multi) {
      const already = committed.some((n) => n.toLowerCase() === p.name.trim().toLowerCase());
      setAll(already ? committed : [...committed, p.name], "");
    } else {
      onChangeText(p.name);
    }
    onTag(p, notify);
  };

  const untag = () => {
    const id = tagged?.userId;
    onTag(null, false, id);
    onChangeText("");
    inputRef.current?.focus();
  };

  /** Backspace at the start of an empty draft removes the last chip WHOLE,
   *  rather than nibbling its final character. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!multi || e.key !== "Backspace" || draft.length) return;
    if (!committed.length) return;
    e.preventDefault();
    setAll(committed.slice(0, -1), "");
  };

  return (
    <div className="mb-3">
      {label ? (
        <span className="mb-1 block text-[12px] font-semibold text-muted">{label}</span>
      ) : null}

      {hasTag && tagged ? (
        /* While tagged, the chip IS the field — overlaying it on a real input
           painted the green "write here" background behind the chip and read as
           an empty field to assistive tech. */
        <div
          className="flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: tint, backgroundColor: "#ffffff" }}
        >
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" style={{ color: tint }}>
            {tagged.name}
          </span>
          <button
            type="button"
            onClick={untag}
            aria-label={`Remove ${tagged.name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:text-danger"
          >
            <Close size={15} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div
            className={cx(
              "flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-line px-2.5 py-1.5 transition-colors focus-within:border-gold",
            )}
            style={{ backgroundColor: value.trim() ? "#ffffff" : "var(--field-empty)" }}
          >
            {/* Committed names render as chips inside the field. */}
            {multi
              ? committed.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[13px] font-semibold"
                    style={{ borderColor: tint, color: tint, backgroundColor: "#ffffff" }}
                  >
                    {n}
                    <button
                      type="button"
                      onClick={() => setAll(committed.filter((_, k) => k !== i), draft)}
                      aria-label={`Remove ${n}`}
                      className="text-muted transition-colors hover:text-danger"
                    >
                      <Close size={12} />
                    </button>
                  </span>
                ))
              : null}
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) =>
                multi ? setAll(committed, e.target.value) : onChangeText(e.target.value)
              }
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              // Delayed so a click on a suggestion lands before the list closes.
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder={multi && committed.length ? "" : placeholder}
              maxLength={maxLength}
              autoComplete="off"
              spellCheck={false}
              // The visible label is a <span>, not a <label for>, because the
              // field is a composite (chips + input). Name the input directly.
              aria-label={label ?? placeholder ?? "Name"}
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-autocomplete="list"
              className="min-w-[8ch] flex-1 bg-transparent px-1 py-1 text-[15px] text-ink outline-none"
            />
          </div>

          {suggestions.length ? (
            <ul
              role="listbox"
              aria-label="Matching connections"
              className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
            >
              {suggestions.map((p) => (
                <li key={p.userId}>
                  <button
                    type="button"
                    // mousedown, not click: blur would close the list first.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                    className="flex w-full items-baseline gap-2 px-3 py-2.5 text-left transition-colors hover:bg-line-soft"
                  >
                    <span className="text-[14.5px] font-semibold text-ink">{p.name}</span>
                    <span className="truncate text-[12px] text-muted">{p.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {statusNote ? (
        <p className="mt-1 text-[12px] text-muted" role="status">
          {statusNote}
        </p>
      ) : null}
    </div>
  );
}
