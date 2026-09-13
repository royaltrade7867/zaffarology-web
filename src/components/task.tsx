"use client";

import { useState, type ReactNode } from "react";
import { Check, Close } from "@/components/icons";
import { Accents, FIELD_EMPTY, HEADING } from "@/lib/pillars";
import { friendlyISO } from "@/lib/dates";
import { cx } from "@/components/ui";
import { useDialog } from "@/components/dialog";

/* ---------------- Checkbox (gold ring, navy fill when checked) ---------------- */
export function Checkbox({
  checked,
  onToggle,
  disabled,
  size = 22,
  label,
}: {
  checked: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  size?: number;
  /** What this tick is for. Without it a screen reader announces only "pressed". */
  label?: string;
}) {
  /* The RING stays `size` (22px by default, the workbook's proportion), but the
     button itself is padded out to the WCAG 2.2 minimum of 24px. Growing the
     circle instead would change the design; growing the hit area does not. */
  const pad = Math.max(0, (24 - size) / 2);
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onToggle(!checked)}
      style={{ padding: pad, opacity: disabled ? 0.4 : 1 }}
      className="shrink-0 flex items-center justify-center bg-transparent"
    >
      <span
        aria-hidden
        style={{ width: size, height: size, backgroundColor: checked ? HEADING : "transparent", borderColor: Accents.gold }}
        className="rounded-full border-2 flex items-center justify-center"
      >
        {checked ? <Check size={13} className="text-on-accent" /> : null}
      </span>
    </button>
  );
}

export interface TaskAction {
  label: string;
  kind: "delete" | "file";
  onClick: () => void;
}

/* ---------------- Task row ---------------- */
export function TaskRow({
  accent,
  symbol,
  value,
  done,
  onChange,
  onToggle,
  placeholder = "Type here…",
  locked,
  actions,
  onDelete,
  noBorder,
  showWho,
  who,
  onChangeWho,
  noStrike,
}: {
  accent: string;
  symbol: ReactNode;
  value: string;
  done: boolean;
  onChange: (v: string) => void;
  onToggle: (v: boolean) => void;
  placeholder?: string;
  locked?: boolean;
  actions?: TaskAction[];
  onDelete?: () => void;
  noBorder?: boolean;
  showWho?: boolean;
  who?: string;
  onChangeWho?: (v: string) => void;
  noStrike?: boolean;
}) {
  const dialog = useDialog();
  const filled = value.trim().length > 0;
  const struck = done && filled && !noStrike;
  return (
    <div className={cx("flex items-center gap-2.5 py-2", !noBorder && "border-b border-line")}>
      <span className="font-heading text-[15px] w-5 text-center shrink-0" style={{ color: accent }}>
        {symbol}
      </span>
      {/* a done task can always be un-checked; empty ones just can't be checked */}
      <Checkbox
        checked={done}
        onToggle={onToggle}
        disabled={!filled && !done}
        // The task's own words, so a screen reader says WHICH task is ticked
        // rather than just "pressed". `symbol` is the row marker (1..5, ✦).
        label={filled ? `Mark done: ${value.trim()}` : `Mark done: ${placeholder ?? symbol}`}
      />
      <div className="flex-1 min-w-0 rounded-lg px-2" style={{ backgroundColor: filled ? "transparent" : FIELD_EMPTY }}>
        <input
          value={value}
          // A long value is clipped mid-character with no ellipsis, so hovering
          // is the only way to read the rest without clicking in.
          title={value.trim() || undefined}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            // clearing a checked task un-checks it (else it's stuck + inflates the counter)
            if (!v.trim() && done) onToggle(false);
          }}
          placeholder={placeholder}
          disabled={locked}
          autoCorrect="off"
          spellCheck={false}
          onClick={() => locked && void dialog.alert("Fill the previous field first.")}
          className={cx(
            "w-full bg-transparent py-2 text-[15px] outline-none placeholder:text-placeholder",
            done && filled ? "text-muted" : "text-ink",
          )}
          style={struck ? { textDecoration: "line-through", textDecorationColor: accent } : undefined}
        />
      </div>
      {showWho ? (
        <input
          value={who ?? ""}
          onChange={(e) => onChangeWho?.(e.target.value)}
          placeholder="To whom?"
          autoCorrect="off"
          spellCheck={false}
          style={{ color: accent, borderColor: accent, backgroundColor: (who ?? "").trim() ? "transparent" : FIELD_EMPTY }}
          className="w-24 shrink-0 border-b bg-transparent py-1 text-[13px] outline-none placeholder:text-placeholder"
        />
      ) : null}
      {done && actions ? (
        <div className="flex gap-1.5 shrink-0">
          {actions.map((a) => (
            /* 24px tall, the WCAG 2.2 minimum. These were 21x13 — about a
               quarter of the required area, on a destructive control. */
            <button
              key={a.label}
              onClick={a.onClick}
              className="flex min-h-[24px] items-center rounded border-[1.5px] px-2 text-[11px] font-semibold"
              style={{ borderColor: a.kind === "delete" ? Accents.red : "var(--ink)", color: a.kind === "delete" ? Accents.red : "var(--ink)" }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : onDelete ? (
        <button
          onClick={onDelete}
          className="flex min-h-[24px] min-w-[24px] shrink-0 items-center justify-center text-muted"
          aria-label="Remove"
        >
          <Close size={13} />
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- Footer (progress + new-day reset) ---------------- */
export function Footer({ progress, resetLabel, onReset }: { progress: string; resetLabel: string; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between mt-3">
      <span className="text-[13px] text-muted">{progress}</span>
      {/* A 24px-tall target (WCAG 2.2) for an action that clears the day. */}
      <button
        onClick={onReset}
        className="flex min-h-[24px] items-center rounded px-1 text-[13.5px] font-semibold text-heading underline"
      >
        {resetLabel}
      </button>
    </div>
  );
}

/* ---------------- Date field ---------------- */
export function DateField({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label?: string }) {
  return (
    <label className="block mb-1.5">
      {label ? <span className="block text-[13px] text-muted mb-1">{label}</span> : null}
      {/* `min-w-0`: a date input carries a UA intrinsic width that `w-full`
          does not override, so inside a flex row it refused to shrink and
          pushed its picker icon past the card edge on a phone. */}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        /* A native date input accepts years up to 275760, so a couple of extra
           keystrokes in the year segment silently produce nonsense — a deadline
           was stored as 62028-06-01 with nothing flagging it. */
        min="1900-01-01"
        max="2100-12-31"
        style={{ backgroundColor: value ? "var(--field)" : FIELD_EMPTY }}
        className="w-full min-w-0 min-h-[48px] rounded-xl border border-line px-3.5 text-[15px] text-on-card outline-none focus:border-gold"
      />
    </label>
  );
}

export function PersonField({ label, value, placeholder, onChange, accent }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void; accent?: string }) {
  return (
    <label className="block mb-1.5">
      <span className="block text-[13px] text-muted mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCorrect="off"
        spellCheck={false}
        style={{ backgroundColor: value.trim() ? "var(--field)" : FIELD_EMPTY, borderColor: accent ?? "var(--line)" }}
        className="w-full min-h-[48px] rounded-xl border px-3.5 py-3 text-[15px] text-on-card outline-none focus:border-gold placeholder:text-placeholder"
      />
    </label>
  );
}

/* ---------------- Yes / No ---------------- */
export function YesNoRow({ value, onChange, yesLabel = "Yes", noLabel = "No" }: { value: "" | "yes" | "no"; onChange: (v: "yes" | "no") => void; yesLabel?: string; noLabel?: string }) {
  const opt = (v: "yes" | "no", label: string, on: string) => (
    <button
      onClick={() => onChange(v)}
      className="flex-1 min-h-[44px] rounded-xl border-[1.5px] text-[13px] font-semibold"
      style={{ borderColor: value === v ? on : "var(--line)", color: value === v ? "var(--on-accent)" : "var(--muted)", backgroundColor: value === v ? on : "var(--surface)" }}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-2 my-2">
      {opt("yes", yesLabel, Accents.green)}
      {opt("no", noLabel, Accents.red)}
    </div>
  );
}

export function PassNote({ kind, children }: { kind: "pass" | "fail" | "gold"; children: ReactNode }) {
  const bg = kind === "pass" ? "rgba(31,107,74,0.1)" : kind === "fail" ? "rgba(200,16,46,0.1)" : "rgba(154,106,0,0.1)";
  const color = kind === "pass" ? Accents.green : kind === "fail" ? Accents.red : Accents.gold;
  return (
    <div className="rounded-lg px-3 py-2 my-2 text-[13px] font-medium" style={{ backgroundColor: bg, color }}>
      {children}
    </div>
  );
}

/* ---------------- Filed archive box ---------------- */
export function FiledBox({ title, empty, clearLabel, hasItems, onClear, children }: { title: string; empty: string; clearLabel: string; hasItems: boolean; onClear: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 mb-6">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 mb-2 text-muted">
        <span className="text-[16px]">{open ? "▾" : "▸"}</span>
        <span className="font-semibold text-[14px]">{title}</span>
      </button>
      {open ? (
        <div>
          {hasItems ? children : <p className="text-[13px] text-muted py-1.5">{empty}</p>}
          {hasItems ? (
            <button onClick={onClear} className="mt-3 text-[13px] font-semibold text-danger underline">
              {clearLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Previous-days reporting ---------------- */
export interface DaySnapshot {
  date: string;
}
export function DayReport<T extends DaySnapshot>({ history, renderDay, title = "Previous Days", empty = "No previous days yet. They show up here after a new day starts." }: { history: T[]; renderDay: (d: T) => ReactNode; title?: string; empty?: string }) {
  const [open, setOpen] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  return (
    <div className="mt-6 mb-6">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 mb-2.5 text-muted">
        <span className="text-[16px]">{open ? "▾" : "▸"}</span>
        <span className="font-semibold text-[14px]">{title}</span>
        {history.length ? <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-gold text-on-gold text-[10px] font-bold flex items-center justify-center px-1.5">{history.length}</span> : null}
      </button>
      {open ? (
        history.length === 0 ? (
          <p className="text-[13px] text-muted py-1.5 leading-tight">{empty}</p>
        ) : (
          history.map((entry, i) => {
            const id = `${entry.date}:${i}`;
            const dayOpen = openDay === id;
            return (
              <div key={id} className="border-t border-line py-1">
                <button onClick={() => setOpenDay(dayOpen ? null : id)} className="flex items-center gap-2 py-2 w-full text-left">
                  <span className="text-[14px]" style={{ color: Accents.gold }}>{dayOpen ? "▾" : "▸"}</span>
                  <span className="font-semibold text-[13.5px] text-heading">{friendlyISO(entry.date) ?? entry.date}</span>
                </button>
                {dayOpen ? <div className="pb-2.5 pl-0.5">{renderDay(entry)}</div> : null}
              </div>
            );
          })
        )
      ) : null}
    </div>
  );
}

export function DayGroup({ label, color, children }: { label: string; color?: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <p className="font-heading text-[9px] tracking-widest mb-1" style={{ color: color ?? "var(--muted)" }}>{label.toUpperCase()}</p>
      {children}
    </div>
  );
}
export function DayTask({ text, done, accent }: { text: string; done?: boolean; accent: string }) {
  if (!text.trim()) return null;
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="font-heading text-[13px] w-3.5" style={{ color: done ? Accents.green : accent }}>{done ? "✓" : "○"}</span>
      <span className={cx("flex-1 text-[13px] leading-snug", done ? "text-muted line-through" : "text-ink")}>{text}</span>
    </div>
  );
}
export function DayField({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <p className="text-[13px] leading-snug text-ink mb-0.5">
      <span className="text-muted">{label}: </span>
      {value}
    </p>
  );
}
