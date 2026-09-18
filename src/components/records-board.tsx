"use client";

import { useState } from "react";

import { Accents } from "@/lib/pillars";
import { shortDate, newId } from "@/lib/dates";
import { SectionLabel, GrowField, cx } from "@/components/ui";
import { Close, Mail, Share, Trash } from "@/components/icons";
import { useDialog } from "@/components/dialog";
import { letterOf, type P7State, type Rec } from "@/pillars/schemas/records";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Only http(s) may reach an `href`.
 *
 * `link` is typed by the user and rendered as a link, so `javascript:` (or
 * `data:`) here would execute on click. The schema file carries the same
 * warning for the report renderer. Anything that is not http(s) yields '',
 * and the caller hides the action rather than linking to nothing.
 */
const safeUrl = (raw: string): string => {
  const s = raw.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
};

/** Field label, matching the phone's `FLabel`. */
function FLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 mt-2 font-heading text-[10px] tracking-wide text-muted">{children}</p>;
}

/**
 * The A-Z record index — the web port of the phone's `records-board.tsx`.
 *
 * Embedded in a Pillar 5 SYSTEM, so state and updater arrive as props and the
 * records live in the business-systems blob under `System.records`.
 *
 * Where the phone uses native `Linking`/`Share`, the web uses real anchors and
 * the clipboard: a `mailto:` and a `wa.me` link work in a browser, and Share
 * becomes "copy the link", which is what a share sheet would have done anyway.
 */
export function RecordsBoard({
  state,
  update,
  accent,
}: {
  state: P7State;
  update: (mut: (s: P7State) => void) => void;
  accent: string;
}) {
  const dialog = useDialog();
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState("");
  const [name, setName] = useState("");
  const [where, setWhere] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const records = state.records;
  const term = search.trim().toLowerCase();
  const counts: Record<string, number> = {};
  records.forEach((r) => { counts[r.letter] = (counts[r.letter] || 0) + 1; });

  const filtered = records
    .filter((r) => {
      if (term) return [r.name, r.where, r.link].some((v) => v.toLowerCase().includes(term));
      if (activeLetter) return r.letter === activeLetter;
      return true;
    })
    .sort((a, b) => a.letter.localeCompare(b.letter) || a.name.localeCompare(b.name));

  const listHeader = term
    ? `Search: "${search.trim()}" (${filtered.length} found)`
    : activeLetter
      ? `Under ${activeLetter} (${filtered.length})`
      : `All Files (${records.length})`;
  const emptyText = term
    ? "No file found with that name or place."
    : activeLetter
      ? `Nothing filed under ${activeLetter} yet.`
      : "No files recorded yet, add your first one above.";

  const save = async () => {
    if (!name.trim()) {
      await dialog.alert("Write the file name first.");
      return;
    }
    // A bare "drive.google.com/…" is what people paste; assume https so it
    // becomes a usable link rather than being silently dropped as unsafe.
    let url = link.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    const letter = letterOf(name);
    update((s) => {
      s.records = [
        ...s.records,
        { id: newId(), letter, name: name.trim(), where: where.trim(), link: url, date: shortDate() },
      ];
    });
    setActiveLetter(letter);
    setSearch("");
    setName("");
    setWhere("");
    setLink("");
  };

  const del = async (r: Rec) => {
    if (await dialog.confirm(`Delete "${r.name}" from the records?`, { confirmLabel: "Delete", danger: true })) {
      update((s) => { s.records = s.records.filter((x) => x.id !== r.id); });
    }
  };

  const copy = async (r: Rec) => {
    try {
      await navigator.clipboard.writeText(r.link);
      setCopied(r.id);
      window.setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 1800);
    } catch {
      await dialog.alert("Could not copy the link. Select it and copy by hand.");
    }
  };

  const fieldStyle = (v: string) => ({
    backgroundColor: v.trim() ? "var(--field)" : "var(--field-empty)",
    borderColor: v.trim() ? "var(--line)" : "var(--field-empty-border)",
  });

  return (
    <>
      {/* Search */}
      <section className="mb-8">
        <SectionLabel text="Search a File" small="by name, place, or link" color={accent} />
        <div className="relative">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value.trim()) setActiveLetter(""); }}
            placeholder="Type to find a file…"
            maxLength={80}
            aria-label="Search records"
            autoCorrect="off"
            spellCheck={false}
            /* A writing surface, so `--field` and `--on-card` — NOT the page's
               `--ink`, which is cream in the dark theme and lands at ~1.2:1 on
               white paper. The phone paints this one on a CARD instead, where
               themed ink is right; on web every input is a field, and the
               theme fixture enforces it. */
            style={{ backgroundColor: "var(--field)", color: "var(--on-card)" }}
            className="w-full min-h-[48px] rounded-xl border-[1.5px] border-line px-3.5 pr-10 text-[15px] outline-none transition-colors focus:border-line-focus"
          />
          {search.trim() ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:text-heading"
            >
              <Close size={16} />
            </button>
          ) : null}
        </div>
      </section>

      {/* A-Z index */}
      <section className="mb-8">
        <SectionLabel text="A-Z Index" small="pick a letter to see its files" color={accent} />
        <div className="flex flex-wrap gap-1.5">
          {LETTERS.map((L) => {
            const has = !!counts[L];
            const active = activeLetter === L;
            return (
              <button
                key={L}
                type="button"
                aria-pressed={active}
                aria-label={`${L}${has ? `, ${counts[L]} file${counts[L] === 1 ? "" : "s"}` : ", empty"}`}
                onClick={() => { setActiveLetter((cur) => (cur === L ? "" : L)); setSearch(""); }}
                style={{
                  borderColor: has ? accent : "var(--line)",
                  backgroundColor: active ? accent : "transparent",
                  // `--on-accent` inverts with the theme; plain white is 2.0:1
                  // on the brown accent once it lightens in dark mode.
                  color: active ? "var(--on-accent)" : has ? accent : "var(--muted)",
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] font-heading text-[15px] transition-colors"
              >
                {L}
                {has && !active ? (
                  <span
                    style={{ backgroundColor: accent, color: "var(--on-accent)" }}
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                  >
                    {counts[L]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* Add a record */}
      <div className="mb-8 rounded-2xl border border-line bg-surface p-4">
        <SectionLabel text="Add a File Record" color={accent} />
        <FLabel>File Name</FLabel>
        <GrowField
          value={name}
          onChange={setName}
          placeholder="e.g. Bank statements 2026"
          maxLength={200}
          style={fieldStyle(name)}
        />
        <FLabel>Where Have You Put It?</FLabel>
        <GrowField
          value={where}
          onChange={setWhere}
          placeholder="e.g. Office cabinet 2, top drawer / Google Drive folder…"
          maxLength={300}
          style={fieldStyle(where)}
        />
        <FLabel>Link - Dropbox / Google Drive (optional)</FLabel>
        <GrowField
          value={link}
          onChange={setLink}
          placeholder="Paste the Dropbox or Drive share link here…"
          maxLength={500}
          style={fieldStyle(link)}
        />
        <button
          type="button"
          onClick={() => void save()}
          style={{ backgroundColor: accent, color: "var(--on-accent)" }}
          className="mt-3 min-h-12 w-full rounded-xl font-heading text-[12px] tracking-widest transition-opacity hover:opacity-90"
        >
          SAVE UNDER ITS LETTER
        </button>
      </div>

      {/* The list */}
      <section className="mb-8">
        <h3 className="mb-3 font-heading text-[13px] tracking-widest" style={{ color: accent }}>
          {listHeader.toUpperCase()}
        </h3>
        {filtered.length === 0 ? (
          <p className="text-[13px] text-muted">{emptyText}</p>
        ) : (
          filtered.map((r) => {
            const href = safeUrl(r.link);
            return (
              <div key={r.id} className="border-b border-line py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{ backgroundColor: accent, color: "var(--on-accent)" }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-heading text-[13px]"
                  >
                    {r.letter}
                  </span>
                  <p className="min-w-0 flex-1 break-words text-[14px] font-bold leading-snug text-ink">{r.name}</p>
                  {/* Delete sits with the record it destroys, away from the
                      share actions — beside "Share" it reads as another way
                      to send. */}
                  <button
                    type="button"
                    onClick={() => void del(r)}
                    aria-label={`Delete ${r.name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/8"
                  >
                    <Trash size={17} />
                  </button>
                </div>

                {r.where ? (
                  <p className="mt-1.5 text-[12.5px] text-muted">
                    Kept at: <span className="font-bold text-ink">{r.where}</span>
                  </p>
                ) : null}

                {href ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <ActLink href={href} label="Open" external>
                      <Share size={17} />
                    </ActLink>
                    <ActLink
                      href={`https://wa.me/?text=${encodeURIComponent(`Document: ${r.name}\n${href}`)}`}
                      label="Send on WhatsApp"
                      external
                    >
                      <WhatsAppGlyph />
                    </ActLink>
                    <ActLink
                      href={`mailto:?subject=${encodeURIComponent(`Document link: ${r.name}`)}&body=${encodeURIComponent(`Here is the document link:\n\n${r.name}\n${href}`)}`}
                      label="Send by email"
                    >
                      <Mail size={17} />
                    </ActLink>
                    <button
                      type="button"
                      onClick={() => void copy(r)}
                      aria-label={`Copy the link to ${r.name}`}
                      className={cx(
                        "flex h-11 items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-gold px-3 text-[12.5px] font-semibold text-gold-text transition-colors hover:bg-gold/8",
                      )}
                    >
                      {copied === r.id ? "Copied" : "Copy link"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </>
  );
}

/** An icon action. 44px square, so it clears the touch-target minimum with no
 *  label to widen it. */
function ActLink({
  href,
  label,
  external,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="flex h-11 w-11 items-center justify-center rounded-lg border-[1.5px] border-gold text-gold-text transition-colors hover:bg-gold/8"
    >
      {children}
    </a>
  );
}

/** WhatsApp mark, drawn locally — the CSP blocks remote images. */
function WhatsAppGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.21-8.24 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.05-.31-.02-.43-.06-.13-.55-1.35-.76-1.84-.2-.48-.4-.42-.55-.43h-.48c-.16 0-.43.06-.65.31-.22.24-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.73 2.65 4.2 3.71.59.26 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}
