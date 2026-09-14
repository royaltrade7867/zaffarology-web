"use client";

import { useEffect, useRef } from "react";

import { FIELD_EMPTY, FIELD_RED, FIELD_RED_BORDER } from "@/lib/pillars";
import type { ReactNode, TextareaHTMLAttributes, InputHTMLAttributes } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Capitalise the first letter (used for small labels/hints). */
export function capFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* ---------------- Buttons ---------------- */
export function Button({
  label,
  onClick,
  variant = "primary",
  disabled,
  loading,
  type = "button",
  className,
}: {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const off = disabled || loading;
  const base =
    "w-full min-h-[48px] rounded-xl px-5 font-semibold text-[15px] transition-colors flex items-center justify-center gap-2 disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-gold text-on-gold hover:bg-gold-hover"
      : variant === "danger"
        ? "border border-danger text-danger hover:bg-danger/5"
        : "border border-line text-heading hover:bg-line-soft";
  return (
    <button type={type} onClick={onClick} disabled={off} className={cx(base, styles, className)}>
      {loading ? "…" : label}
    </button>
  );
}

/* ---------------- Text inputs (empty → light green) ---------------- */
type FieldProps = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;

/**
 * A text field.
 *
 * `emptyTint` opts into the green "still to fill" wash. It is OFF by default
 * because this component is shared with login, signup and forgot-password, and
 * a green sign-in form reads as an error state on the first screen anyone sees.
 * The workbook pages opt in; auth does not.
 *
 * The ink is `on-card`, never `ink`: a field is white paper in BOTH themes, so
 * cream text on it is 1.2:1 and invisible. See DESIGN.md.
 */
export function TextField({
  label,
  value,
  onChange,
  error,
  className,
  emptyTint = false,
  ...rest
}: FieldProps & { emptyTint?: boolean }) {
  const tinted = emptyTint && !error && !value.trim();
  return (
    <label className="block mb-3">
      {label ? <span className="block text-[13px] text-muted mb-1">{label}</span> : null}
      <input
        {...rest}
        // Same fallback as TextArea: a placeholder-only field would otherwise
        // announce its own value, or nothing.
        aria-label={rest["aria-label"] ?? (label ? undefined : rest.placeholder)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCorrect="off"
        spellCheck={false}
        /* An empty box is green-FILLED and green-EDGED. The wash says "still
           yours to fill" while a neutral grey hairline said the opposite, so
           an unfilled field carried two conflicting signals.
           `--field-empty-border` was defined in all three theme blocks for
           exactly this and applied nowhere. Only where the field opted into
           the tint, so the auth screens stay neutral — a green sign-in form
           reads as an error state. */
        style={{
          backgroundColor: tinted ? FIELD_EMPTY : "var(--field)",
          color: "var(--on-card)",
          ...(tinted ? { borderColor: "var(--field-empty-border)" } : {}),
        }}
        className={cx(
          "w-full min-h-[40px] rounded-xl border px-3 py-2 text-[14.5px] outline-none transition-colors",
          "focus:border-gold",
          error ? "border-danger" : tinted ? "" : "border-line",
          className,
        )}
      />
      {error ? <span className="block text-[12px] text-danger mt-1">{error}</span> : null}
    </label>
  );
}

/** Most hard line breaks (Enter) allowed in one field, so a user can't push the
 *  box down the page with empty lines. Matches the mobile app. */
export const MAX_INPUT_BREAKS = 5;

type AreaProps = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  /** most hard line breaks (Enter) allowed; wrapping is never restricted */
  maxBreaks?: number;
  /**
   * The empty-state wash. Defaults to green, which is what Notes, meetings and
   * the auth screens use. `"red"` is the PILLAR workbook rule — red while
   * empty, green once written in — and is opted into per callsite rather than
   * switched on here, because a red sign-in form reads as an error state.
   */
  tone?: "green" | "red";
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">;

export function TextArea({ label, value, onChange, className, maxBreaks = MAX_INPUT_BREAKS, tone = "green", ...rest }: AreaProps) {
  const countBreaks = (t: string) => (t.match(/\n/g) ?? []).length;
  const empty = !value.trim();
  const red = tone === "red";
  const grow = useAutoGrow(value);
  return (
    <label className="block mb-3">
      {label ? <span className="block text-[13px] text-muted mb-1">{label}</span> : null}
      {/* With no `label`, this wrapper contains no text — so the accessible name
          fell back to the field's OWN VALUE, and to nothing at all when empty.
          The placeholder is the next best description, and unlike the visible
          placeholder it does not vanish the moment the user types. */}
      <textarea
        {...rest}
        ref={grow}
        aria-label={rest["aria-label"] ?? (label ? undefined : rest.placeholder)}
        value={value}
        onChange={(e) => {
          const t = e.target.value;
          // Reject an edit that adds a break beyond the cap (paste included), but
          // never block deleting or an edit that keeps the count where it is.
          if (countBreaks(t) > maxBreaks && countBreaks(t) > countBreaks(value)) return;
          onChange(t);
        }}
        autoCorrect="off"
        spellCheck={false}
        // Border pairs with the wash — see TextField above.
        /* Filled is GREEN on a red-tone field, not white: the pillar rule is
           red while it still wants filling, green once it has been. */
        style={{
          backgroundColor: empty ? (red ? FIELD_RED : FIELD_EMPTY) : red ? FIELD_EMPTY : "var(--field)",
          borderColor: empty
            ? red
              ? FIELD_RED_BORDER
              : "var(--field-empty-border)"
            : red
              ? "var(--field-empty-border)"
              : "var(--line)",
        }}
        className={cx(
          "w-full min-h-[96px] rounded-xl border px-3.5 py-3 text-[15px] text-on-card outline-none focus:border-gold",
          className,
        )}
      />
    </label>
  );
}

/**
 * Grow a textarea to fit its text, up to a ceiling, then scroll.
 *
 * The phone app's boxes grow as you type; the web ones were a fixed height with
 * a drag handle, so a long answer hid behind a scrollbar in a box the size of
 * three lines. The cap stops one very long entry pushing the rest of the page
 * off screen — past it the box scrolls as before.
 *
 * Runs on every render, not just on input: the value also changes when a pillar
 * loads from the server, and a box that only grew on keystroke opened collapsed
 * over text that was already there.
 */
export function useAutoGrow(value: string, maxPx = 320) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reset first, or the box can only ever get taller: scrollHeight includes
    // the height we set last time.
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  }, [value, maxPx]);
  return ref;
}

/* ---------------- Section label + hint ---------------- */
export function SectionLabel({ text, small, color }: { text: string; small?: string; color?: string }) {
  return (
    <div className="mb-2">
      <h3 className="font-heading text-[15px] leading-tight" style={{ color: color ?? "var(--heading)" }}>
        {text.toUpperCase()}
      </h3>
      {small ? <p className="text-[12px] text-muted mt-0.5">{capFirst(small)}</p> : null}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-muted">{typeof children === "string" ? capFirst(children) : children}</p>;
}

/* ---------------- Card + accent box ---------------- */
export function MiwBox({ accent, children, filled }: { accent: string; children: ReactNode; filled?: boolean }) {
  /* `filled` turns the border green: the workbook's Work of the Day is red
     while it still wants writing and green once it has been written. Left
     undefined the box keeps its fixed accent, which is what every other
     caller wants. */
  const border = filled === undefined ? accent : filled ? "var(--p3)" : "var(--field-red-border)";
  return (
    <div className="rounded-xl border-2 bg-surface p-3.5 shadow-sm transition-colors" style={{ borderColor: border }}>
      {children}
    </div>
  );
}

export function AddButton({ label, accent, onClick, disabled, dimmed }: { label: string; accent: string; onClick: () => void; disabled?: boolean; /** Greys the button out but keeps it clickable, so `onClick` can explain why it isn't available yet. */ dimmed?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={dimmed || undefined}
      className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-4 py-3 text-[13.5px] font-semibold transition-colors disabled:opacity-45${dimmed ? " opacity-50" : ""}`}
      style={{ borderColor: accent, color: accent, backgroundColor: `${accent}10` }}
    >
      <span className="text-lg leading-none">+</span>
      {label.replace(/^\+\s*/, "")}
    </button>
  );
}

/* ---------------- Loading ---------------- */
/**
 * Spinning circle, centred, while data is on its way.
 *
 * `full` centres it in the VIEWPORT rather than in whatever box encloses it:
 * `min-h-[60vh]` centred the spinner inside the content column, which sits below
 * the nav and the pillar chips, so it settled well above the middle of a tall
 * window and off-centre from the page.
 *
 * `.spinner` is defined in globals.css rather than using `animate-spin`, because
 * the global reduced-motion block pins `animation-iteration-count: 1` on every
 * element — which made this stop after a single turn and sit there as a plain
 * static ring, i.e. no loading indicator at all for anyone with that setting.
 */
export function Loading({ full = true, label = "Loading" }: { full?: boolean; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cx(
        "flex items-center justify-center",
        // Minus the top nav, so "centre" means the centre of what you can see.
        full ? "min-h-[calc(100vh-7rem)]" : "py-12",
      )}
    >
      <div className="spinner h-10 w-10 rounded-full border-[3px] border-line border-t-gold" />
    </div>
  );
}

/**
 * "142 left" — shown only once a field is nearly full.
 *
 * Long fields were capped by `maxLength` alone, which truncates in silence:
 * typing 650 characters into a 600-character goal kept 600 and dropped 50 with
 * no counter, no colour change and nothing said. A permanent counter on every
 * field would be noise, so this stays invisible until the last ~15% and turns
 * danger-coloured at the limit. Modelled on Pillar 4's sentence hint, which is
 * the one piece of inline validation feedback the app already had.
 */
export function CharsLeft({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  if (left > Math.max(20, Math.round(max * 0.15))) return null;
  return (
    <span
      className={cx("block text-[11.5px] mt-1", left <= 0 ? "text-danger" : "text-muted")}
      // Announced politely so a screen-reader user hears it before running out,
      // rather than being interrupted on every keystroke.
      role="status"
      aria-live="polite"
    >
      {left > 0 ? `${left} character${left === 1 ? "" : "s"} left` : "Limit reached, no more will be saved"}
    </span>
  );
}
