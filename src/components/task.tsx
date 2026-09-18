"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Close } from "@/components/icons";
import { Accents, FIELD_EMPTY, FIELD_RED, FIELD_RED_BORDER, HEADING } from "@/lib/pillars";
import { friendlyISO, shortDate } from "@/lib/dates";
import { cx, GrowField } from "@/components/ui";
import { useDialog } from "@/components/dialog";

/** WCAG 2.2 target size, in px. Matches `.tap-target` / `.tap-row` in
 *  globals.css — two pixels over the 24px floor, so a later padding or
 *  line-height change cannot silently drop a control back under it. */
export const MIN_TAP = 26;

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
     button itself is padded out to the WCAG 2.2 minimum. Growing the
     circle instead would change the design; growing the hit area does not. */
  const pad = Math.max(0, (MIN_TAP - size) / 2);
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
  slot,
  below,
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
  /** A FIXED slot (work of the day, do-or-die n): deleting clears its text
   *  rather than removing the row, and the confirm says so. */
  slot?: boolean;
  /** Rendered under the row, lined up with the text — e.g. a deadline. */
  below?: ReactNode;
}) {
  const dialog = useDialog();
  const filled = value.trim().length > 0;
  const struck = done && filled && !noStrike;

  /* Zaffar: "anything we delete, it must give us a second chance". Asked HERE,
     in the one shared row, so no pillar can wire a delete that skips it. A row
     with nothing written in it loses nothing, so it goes without asking. */
  const confirmThen = async (run: () => void) => {
    if (!filled && !(who ?? "").trim()) return run();
    const quoted = value.trim().length > 60 ? `${value.trim().slice(0, 60)}…` : value.trim();
    const ok = await dialog.confirm(slot ? "Clear this task?" : "Delete this task?", {
      body: `"${quoted}" ${slot ? "will be cleared, the slot stays." : "will be removed."}`,
      confirmLabel: slot ? "Clear" : "Delete",
      danger: true,
    });
    if (ok) run();
  };

  return (
    <div className={cx("py-2", !noBorder && "border-b border-line")}>
    {/* Wraps so that on a phone "To whom?" can drop under the task (see below)
        instead of squeezing a long delegation into a narrow column. */}
    <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5">
      <span className="font-heading text-[15px] w-5 text-center shrink-0 pt-2" style={{ color: accent }}>
        {symbol}
      </span>
      {/* a done task can always be un-checked; empty ones just can't be checked */}
      <span className="shrink-0 pt-1.5">
        <Checkbox
          checked={done}
          onToggle={onToggle}
          disabled={!filled && !done}
          // The task's own words, so a screen reader says WHICH task is ticked
          // rather than just "pressed". `symbol` is the row marker (1..5, ✦).
          label={filled ? `Mark done: ${value.trim()}` : `Mark done: ${placeholder ?? symbol}`}
        />
      </span>
      {/* The pillar rule: red while it still wants writing, green once written
          in. Green rather than transparent when filled — a transparent fill
          paints `--on-card` ink on the navy card at 1.30:1. */}
      <div className="flex-1 min-w-0 rounded-lg px-2" style={{ backgroundColor: filled ? FIELD_EMPTY : FIELD_RED }}>
        {/* One line that grows: a long task WRAPS instead of being clipped
            mid-word behind the box edge. */}
        <GrowField
          value={value}
          aria-label={placeholder}
          onChange={(v) => {
            onChange(v);
            // clearing a checked task un-checks it (else it's stuck + inflates the counter)
            if (!v.trim() && done) onToggle(false);
          }}
          placeholder={placeholder}
          disabled={locked}
          autoCorrect="off"
          spellCheck={false}
          onClick={() => locked && void dialog.alert("Fill the previous field first.")}
          /* `--on-card`, NEVER `--ink` or `--muted`. This row's background is a
             writing surface — red while empty, green once filled — and it stays
             that way in BOTH themes, so the theme's ink tokens are wrong on it:
             cream `--ink` measured 1.14:1 on the green fill and `--muted`
             1.59:1, i.e. invisible in dark mode. A done task dims by OPACITY
             instead, which keeps the same ink and the same contrast. */
          className={cx(
            "w-full bg-transparent py-2 text-[15px] text-on-card outline-none placeholder:text-placeholder",
            done && filled ? "opacity-75" : "",
          )}
          style={struck ? { textDecoration: "line-through", textDecorationColor: accent } : undefined}
        />
      </div>
      {showWho ? (
        <GrowField
          value={who ?? ""}
          onChange={(v) => onChangeWho?.(v)}
          placeholder="To whom?"
          aria-label="To whom?"
          autoCorrect="off"
          spellCheck={false}
          /* Same rule as every other writing surface: the ink is `--on-card`, not
             the accent. The dark-theme accents are lightened for the navy page and
             sit at 1.6-2.2:1 on the empty green wash — Pillar 1's delegation rows
             pass BLUE here, which was 1.65:1 and unreadable while empty. */
          style={{ borderColor: accent, backgroundColor: (who ?? "").trim() ? FIELD_EMPTY : FIELD_RED }}
          /* Phone: its own line under the task, lined up with the text. From
             `sm` up: beside the task, as before. */
          className="order-last ml-[66px] basis-[calc(100%-66px)] border-b px-1 py-1 text-[13px] text-on-card outline-none placeholder:text-placeholder sm:order-none sm:ml-0 sm:mt-1 sm:basis-28 sm:shrink-0"
        />
      ) : null}
      {done && actions ? (
        <div className="flex gap-1.5 shrink-0 pt-1">
          {actions.map((a) => (
            /* `tap-row` carries the WCAG 2.2 minimum. These were 21x13 — about a
               quarter of the required area, on a destructive control. */
            <button
              key={a.label}
              onClick={a.kind === "delete" ? () => void confirmThen(a.onClick) : a.onClick}
              className="tap-row rounded border-[1.5px] px-2 text-[11px] font-semibold"
              style={{ borderColor: a.kind === "delete" ? Accents.red : "var(--ink)", color: a.kind === "delete" ? Accents.red : "var(--ink)" }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : onDelete ? (
        <button
          onClick={() => void confirmThen(onDelete)}
          className="shrink-0 tap-target text-muted mt-1"
          aria-label="Remove"
        >
          <Close size={13} />
        </button>
      ) : null}
    </div>
    {below ? <div className="mt-1.5 pl-[66px]">{below}</div> : null}
    </div>
  );
}

/* ---------------- Footer (progress + new-day reset) ---------------- */
export function Footer({ progress, resetLabel, onReset }: { progress: string; resetLabel: string; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between mt-3">
      <span className="text-[13px] text-muted">{progress}</span>
      {/* A real target (`tap-row`) for an action that clears the day. */}
      <button
        onClick={onReset}
        className="tap-row rounded px-1 text-[13.5px] font-semibold text-heading underline"
      >
        {resetLabel}
      </button>
    </div>
  );
}

/* ---------------- Date field ---------------- */

/** The lower and upper bounds a typed date is held to, as ISO. */
const DATE_MIN = "1900-01-01";
const DATE_MAX = "2100-12-31";

/** ISO `YYYY-MM-DD` -> "5 Aug 2026". Byte-identical to the phone app's
 *  `displayDate`, so the same deadline reads the same on both. */
export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!y || !mo || !d) return iso;
  // Local, never `new Date(iso)` — that parses as UTC midnight and shifts a day back.
  return shortDate(new Date(y, mo - 1, d));
}

/* There is no `displayToIso` any more. A typed field needed one — it had to turn
   "5 Aug 2026" back into ISO and reject "31 Feb" — but the wheel can only ever
   produce a real date: the year column is built from MIN_YEAR..MAX_YEAR, and the
   day column is rebuilt from `daysIn` whenever the month or year changes. The
   bounds are enforced by what the wheel OFFERS rather than by parsing. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MIN_YEAR = Number(DATE_MIN.slice(0, 4));
const MAX_YEAR = Number(DATE_MAX.slice(0, 4));

/** Days in a month, so 31 cannot be spun onto February. */
const daysIn = (y: number, mo: number): number => new Date(y, mo, 0).getDate();

/**
 * One spin column. Scrolls, and each option is a real <button>, so the wheel is
 * reachable by keyboard and readable by a screen reader — a scroll-snap list of
 * <div>s would be neither.
 */
function Wheel({
  label, options, value, onPick,
}: {
  label: string;
  options: { v: number; text: string }[];
  value: number;
  onPick: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Bring the selected row into view when the sheet opens, so the wheel starts
  // on the current date rather than at the top of a 200-year list.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-on="1"]')?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        className="h-[168px] overflow-y-auto rounded-xl border border-line bg-surface py-1"
      >
        {options.map((o) => {
          const on = o.v === value;
          return (
            <button
              key={o.v}
              type="button"
              role="option"
              aria-selected={on}
              data-on={on ? "1" : undefined}
              onClick={() => onPick(o.v)}
              className="block w-full px-2 py-1.5 text-center text-[14px] transition-colors"
              style={{
                backgroundColor: on ? "var(--selected)" : "transparent",
                color: on ? "var(--on-selected)" : "var(--ink)",
                fontWeight: on ? 700 : 400,
              }}
            >
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Tap to open, spin day / month / year, Done.
 *
 * The same gesture as the phone, which uses a scroll-wheel (`display="spinner"`)
 * picker rather than a calendar grid. Two things it is deliberately NOT:
 *
 *  - `type="date"`, which opens the browser's calendar popup and renders in the
 *    browser's locale, so it read `08/05/2026` beside the app's own "Aug 5, 2026".
 *  - a typed text box, which is what this was for one afternoon: it stored fine
 *    but made the user compose a date character by character.
 *
 * The STORED value is still ISO `YYYY-MM-DD` — it is shared with the phone app
 * through the pillar blob, so the stored shape must never change, only the way
 * it is picked and shown.
 */
export function DateField({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  // An empty field opens on today, which is the date people most often want.
  const start = parsed
    ? { y: Number(parsed[1]), mo: Number(parsed[2]), d: Number(parsed[3]) }
    : { y: today.getFullYear(), mo: today.getMonth() + 1, d: today.getDate() };
  const [draft, setDraft] = useState(start);

  const openSheet = () => { setDraft(start); setOpen(true); };
  const confirm = () => {
    const { y, mo } = draft;
    // Clamp rather than reject: spinning to 31 then to February should give the
    // 28th, not silently keep a day that does not exist in that month.
    const d = Math.min(draft.d, daysIn(y, mo));
    onChange(`${y}-${`${mo}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`);
    setOpen(false);
  };

  const dayCount = daysIn(draft.y, draft.mo);
  const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

  return (
    <div className="mb-1.5">
      {label ? <span className="mb-1 block text-[13px] text-muted">{label}</span> : null}
      {/* `min-w-0` so it can shrink inside a flex row instead of pushing past
          the card edge on a phone. */}
      <button
        type="button"
        onClick={openSheet}
        aria-label={`${label ?? "Date"}: ${value ? isoToDisplay(value) : "no date chosen"}`}
        aria-haspopup="dialog"
        style={{
          backgroundColor: value ? FIELD_EMPTY : FIELD_RED,
          borderColor: value ? "var(--field-empty-border)" : FIELD_RED_BORDER,
        }}
        className="min-h-[40px] w-full min-w-0 rounded-xl border px-3 text-left text-[14.5px] text-on-card outline-none focus:border-line-focus"
      >
        {/* NOT `text-muted`: that is the PAGE's token, and this label sits on a
            FIELD. In dark mode `--muted` is #9db2cc, which lands at 1.44:1 on
            the red empty wash — the "Choose a date" text was invisible.

            The button already carries `text-on-card`, the sanctioned colour for
            text on a field. Dimming it to 70% keeps it reading as unfilled while
            measuring 5.21:1 on the worst surface (dark red wash) and 6.38:1 on
            white — where `--placeholder` would be the natural choice, it is
            banned outside a real `::placeholder` because that spelling has
            shipped as a bug twice. */}
        {value ? isoToDisplay(value) : <span className="opacity-70">Choose a date</span>}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          {/* Same scrim contract as `dialog.tsx`: it carries its own handler,
              because it is painted on top of the wrapper and would otherwise
              always be the event target itself. */}
          <div
            className="absolute inset-0 bg-[rgba(4,16,31,0.55)]"
            aria-hidden
            onMouseDown={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label ?? "Choose a date"}
            className="zaff-reveal relative w-full max-w-[420px] rounded-t-2xl border border-line bg-surface p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
              <button type="button" onClick={() => setOpen(false)} className="tap-row rounded px-1 text-[13.5px] text-muted">
                Cancel
              </button>
              <p className="font-heading text-[14px] text-heading">{label ?? "Select date"}</p>
              <button type="button" onClick={confirm} className="tap-row rounded px-1 font-heading text-[13.5px] text-gold">
                Done
              </button>
            </div>

            <div className="flex gap-2">
              <Wheel
                label="Day"
                value={Math.min(draft.d, dayCount)}
                options={Array.from({ length: dayCount }, (_, i) => ({ v: i + 1, text: String(i + 1) }))}
                onPick={(d) => setDraft((p) => ({ ...p, d }))}
              />
              <Wheel
                label="Month"
                value={draft.mo}
                options={MONTHS.map((m, i) => ({ v: i + 1, text: m }))}
                onPick={(mo) => setDraft((p) => ({ ...p, mo }))}
              />
              <Wheel
                label="Year"
                value={draft.y}
                options={years.map((y) => ({ v: y, text: String(y) }))}
                onPick={(y) => setDraft((p) => ({ ...p, y }))}
              />
            </div>

            <p className="mt-3 text-center text-[13px] text-muted">
              {isoToDisplay(
                `${draft.y}-${`${draft.mo}`.padStart(2, "0")}-${`${Math.min(draft.d, dayCount)}`.padStart(2, "0")}`,
              )}
            </p>

            {value ? (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="tap-row mt-2 w-full rounded text-center text-[12.5px] font-semibold text-muted transition-colors hover:text-danger"
              >
                Clear this date
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
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
        style={{
          backgroundColor: value.trim() ? FIELD_EMPTY : FIELD_RED,
          borderColor: accent ?? (value.trim() ? "var(--field-empty-border)" : FIELD_RED_BORDER),
        }}
        className="w-full min-h-[40px] rounded-xl border px-3 py-2 text-[14.5px] text-on-card outline-none focus:border-line-focus placeholder:text-placeholder"
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
