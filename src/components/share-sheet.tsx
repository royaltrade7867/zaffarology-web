"use client";

import { useEffect, useRef, useState } from "react";

import { Close, Mail } from "@/components/icons";
import { cx, GrowField } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import { usePartners } from "@/lib/use-connections";
import { MAX_SHARE_RECIPIENTS, shareByEmail, whatsAppLink } from "@/lib/notes-share-api";

/** WhatsApp mark, drawn locally — the CSP blocks remote images. */
function WhatsAppGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.21-8.24 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.05-.31-.02-.43-.06-.13-.55-1.35-.76-1.84-.2-.48-.4-.42-.55-.43h-.48c-.16 0-.43.06-.65.31-.22.24-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.73 2.65 4.2 3.71.59.26 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/**
 * Share a note or meeting: by email, or by handing the text to WhatsApp.
 *
 * WhatsApp is a LINK, not an API call — `wa.me` opens the contact picker and
 * nothing leaves until the user presses send there. Email goes through our own
 * backend, so it needs addresses and actually sends on submit. The two are
 * deliberately not styled as equals: email is the form, WhatsApp is one button
 * beside it.
 *
 * Voice notes are never attached. The share endpoint carries text only.
 */
export function ShareSheet({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  const { partners } = usePartners();
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and focus starts inside — same contract as `dialog.tsx`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector("textarea")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = emails
    .split(/[,\n;]/)
    .map((e) => e.trim())
    .filter(Boolean);

  const send = async () => {
    if (!list.length) return setError("Add at least one email address.");
    const bad = list.find((e) => !validEmail(e));
    if (bad) return setError(`${bad} is not a valid email address.`);
    if (list.length > MAX_SHARE_RECIPIENTS) {
      return setError(`You can send to at most ${MAX_SHARE_RECIPIENTS} people at once.`);
    }
    setBusy(true);
    setError(null);
    try {
      await shareByEmail({ title, body, message, emails: list });
      setSent(true);
      // Left open for a moment so the confirmation is actually seen.
      window.setTimeout(onClose, 1400);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not send that. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[rgba(4,16,31,0.55)]" aria-hidden onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        className="zaff-reveal relative w-full max-w-[460px] rounded-t-2xl border border-line bg-surface p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2.5">
          <p className="min-w-0 truncate font-heading text-[15px] text-heading">
            Share {title.trim() || "this"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-heading"
          >
            <Close size={16} />
          </button>
        </div>

        {sent ? (
          <p className="py-6 text-center text-[14px] font-semibold text-heading" role="status">
            Sent.
          </p>
        ) : (
          <>
            {/* WhatsApp first: it is one tap and needs nothing typed. */}
            <a
              href={whatsAppLink(title, body)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => window.setTimeout(onClose, 300)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-line text-[14px] font-semibold text-heading transition-colors hover:bg-line-soft"
            >
              <WhatsAppGlyph />
              Send on WhatsApp
            </a>

            <div className="my-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] uppercase tracking-wide text-muted">or email it</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-muted">
                To {list.length ? `(${list.length})` : ""}
              </span>
              <GrowField
                value={emails}
                onChange={setEmails}
                placeholder="their@email.com, someone@else.com"
                maxLength={800}
                style={{ backgroundColor: emails.trim() ? "var(--field)" : "var(--field-empty)" }}
                className="w-full min-h-[44px] rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-on-card outline-none transition-colors focus:border-line-focus"
              />
            </label>

            {/* Connections as one-tap chips. They are a convenience only — a
                recipient does not have to be one. */}
            {partners.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {partners.slice(0, 8).map((p) => {
                  const already = list.includes(p.email);
                  return (
                    <button
                      key={p.userId}
                      type="button"
                      disabled={already}
                      onClick={() => setEmails((v) => (v.trim() ? `${v.replace(/[,\s]+$/, "")}, ${p.email}` : p.email))}
                      className={cx(
                        "tap-row rounded-full border px-2.5 text-[12px] font-semibold transition-colors",
                        already
                          ? "cursor-not-allowed border-line text-muted"
                          : "border-line text-heading hover:bg-line-soft",
                      )}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] font-semibold text-muted">
                A line to go with it (optional)
              </span>
              <GrowField
                value={message}
                onChange={setMessage}
                placeholder="e.g. notes from this morning"
                maxLength={500}
                style={{ backgroundColor: message.trim() ? "var(--field)" : "var(--field-empty)" }}
                className="w-full min-h-[44px] rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-on-card outline-none transition-colors focus:border-line-focus"
              />
            </label>

            {error ? (
              <p className="mt-2 text-[13px] font-semibold text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold text-[15px] font-semibold text-on-gold transition-colors hover:bg-gold-hover disabled:opacity-60"
            >
              <Mail size={16} />
              {busy ? "Sending…" : "Send email"}
            </button>

            <p className="mt-2 text-center text-[11.5px] text-muted">
              Voice recordings are not included.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
