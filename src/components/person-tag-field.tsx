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
import { useDialog } from "@/components/dialog";

const MAX_SUGGESTIONS = 5;

let listSeq = 0;

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
  const dialog = useDialog();
  const [focused, setFocused] = useState(false);
  /** Which suggestion the keyboard is on. -1 = none, so typing does not
   *  pre-select someone and turn a stray Enter into an assignment. */
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  // Stable per instance, so two fields on one page do not share option ids.
  const listId = useRef(`ptf-list-${++listSeq}`).current;
  const tint = accent ?? "var(--gold)";

  const tagged = partners.find((p) => String(p.userId) === tagUserId) ?? null;
  const hasTag = !!tagUserId;

  /** In multi mode the value is a list; everything before the last comma is
   *  committed, the tail is what the user is still typing. */
  const committed = multi ? value.split(",").slice(0, -1).map((n) => n.trim()).filter(Boolean) : [];
  const draft = multi ? value.split(",").pop() ?? "" : value;

  /**
   * The trailing separator after the last chip is ALWAYS kept: it is what marks
   * that name as committed. Trimming it (the first version did) merged the last
   * chip straight back into the draft on the next keystroke, so typing
   * "Ana, Bo" ended up as the single name "Ana Bo".
   */
  const setAll = (names: string[], tail: string) =>
    onChangeText((names.length ? names.join(", ") + ", " : "") + tail);

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
  const pick = async (p: Partner) => {
    const notify = await dialog.confirm(
      `Email ${p.name}?\n\n` +
        `${p.name} will be tagged on this either way, it appears on their board. ` +
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

  /** Typing a comma commits the name, the way Return would in a mail client.
   *  Without this the comma is eaten by `setAll`'s trailing-separator trim and
   *  "Ana, Bo" is stored as the single name "Ana Bo". */
  const onDraft = (t: string) => {
    setActive(-1);
    if (!multi) {
      onChangeText(t);
      return;
    }
    if (t.includes(",")) {
      const [done, ...rest] = t.split(",");
      const name = done.trim();
      setAll(name ? [...committed, name] : committed, rest.join(",").trim());
      return;
    }
    // A draft never starts with whitespace: the separator after a chip already
    // provides the gap, so a typed space would otherwise pile up in front.
    setAll(committed, committed.length ? t.replace(/^\s+/, "") : t);
  };

  /** Untag whoever that chip stood for. Removing the text alone leaves the id
   *  in `attendee_ids` with nothing on screen to show it — unremovable, since
   *  re-adding and re-removing repeats the same no-op. */
  const untagByName = (name: string) => {
    const p = partners.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (p) onTag(null, false, p.userId);
  };

  const removeAt = (i: number) => {
    const gone = committed[i];
    setAll(committed.filter((_, n) => n !== i), draft);
    untagByName(gone);
  };

  /**
   * Keyboard access to the suggestions, plus whole-chip backspace.
   *
   * The list has to be driven from the input rather than by tabbing into it:
   * blur closes the list, so focus could never land on an option. Arrow keys
   * move, Enter picks, Escape dismisses — the combobox pattern the ARIA roles
   * on this field promise.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        pick(suggestions[active]);
        setActive(-1);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setActive(-1);
        setFocused(false);
        return;
      }
    }
    if (!multi || e.key !== "Backspace" || draft.length) return;
    if (!committed.length) return;
    e.preventDefault();
    const gone = committed[committed.length - 1];
    setAll(committed.slice(0, -1), "");
    untagByName(gone);
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
          style={{ borderColor: tint, backgroundColor: "var(--field)" }}
        >
          <span className="min-w-0 flex-1 break-words text-[15px] font-semibold" style={{ color: tint }}>
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
            style={{ backgroundColor: value.trim() ? "var(--field)" : "var(--field-empty)" }}
          >
            {/* Committed names render as chips inside the field. */}
            {multi
              ? committed.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[13px] font-semibold"
                    style={{ borderColor: tint, color: tint, backgroundColor: "var(--field)" }}
                  >
                    {n}
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
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
              onChange={(e) => onDraft(e.target.value)}
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
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              className="min-w-[8ch] flex-1 bg-transparent px-1 py-1 text-[15px] text-on-card outline-none"
            />
          </div>

          {suggestions.length ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Matching connections"
              className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
            >
              {suggestions.map((p, i) => (
                <li
                  key={p.userId}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    // mousedown, not click: blur would close the list first.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cx(
                      "flex w-full items-baseline gap-2 px-3 py-2.5 text-left transition-colors",
                      i === active ? "bg-line-soft" : "hover:bg-line-soft",
                    )}
                  >
                    <span className="text-[14.5px] font-semibold text-ink">{p.name}</span>
                    <span className="min-w-0 break-all text-[12px] text-muted">{p.email}</span>
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
