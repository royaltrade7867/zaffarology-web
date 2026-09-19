"use client";

/**
 * The app's own alert / confirm / prompt.
 *
 * The browser's native ones are unstyleable: they ignore the theme entirely,
 * dock to the top of the window rather than the middle, and print the origin
 * ("localhost:3000 says"), which reads like a security warning on a destructive
 * action. They also block the whole tab, so nothing behind them can update.
 *
 * These return a Promise, so a call site changes from
 *     if (!window.confirm("…")) return;
 * to
 *     if (!(await confirm("…"))) return;
 * rather than being restructured around a callback.
 *
 * Deliberately modal: every use here is a decision the user must answer before
 * anything else happens — deleting something, or naming a recording. The craft
 * floor's "no modal for a task that needs neither interruption nor protected
 * focus" is about interrupting *work*, not about confirmations.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cx } from "@/components/ui";

type Kind = "alert" | "confirm" | "prompt";

interface Request {
  kind: Kind;
  title: string;
  /** Optional second line — the consequence, when it is not obvious. */
  body?: string;
  /** Label for the affirmative button. */
  confirmLabel?: string;
  /** Label for the other button, when "Cancel" would not say what it does. */
  cancelLabel?: string;
  /** Draws the affirmative button as destructive. */
  danger?: boolean;
  /** `prompt` only. */
  defaultValue?: string;
  placeholder?: string;
  resolve: (v: string | boolean | null) => void;
}

interface DialogApi {
  alert: (title: string, body?: string) => Promise<void>;
  confirm: (
    title: string,
    opts?: { body?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean },
  ) => Promise<boolean>;
  prompt: (
    title: string,
    opts?: { defaultValue?: string; placeholder?: string; confirmLabel?: string },
  ) => Promise<string | null>;
}

const Ctx = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  /** What had focus before the dialog opened, so it can be given back. */
  const returnTo = useRef<HTMLElement | null>(null);

  const open = useCallback((r: Omit<Request, "resolve">) => {
    return new Promise<string | boolean | null>((resolve) => {
      returnTo.current = document.activeElement as HTMLElement | null;
      setValue(r.defaultValue ?? "");
      setReq({ ...r, resolve });
    });
  }, []);

  const close = useCallback(
    (result: string | boolean | null) => {
      req?.resolve(result);
      setReq(null);
      setValue("");
      /* Put focus back where it was, or the page loses its place entirely.
         Deferred to the next frame: a scrim dismiss fires on MOUSEDOWN, and the
         browser then moves focus itself as the click completes — restoring
         synchronously meant focus landed on the trigger and was immediately
         taken back to BODY, so only Escape appeared to work. */
      const back = returnTo.current;
      requestAnimationFrame(() => back?.focus?.());
    },
    [req],
  );

  /* Focus the SAFE control on open.
   *
   * A prompt focuses its input. A DESTRUCTIVE confirm focuses Cancel, not the
   * destructive button: pressing Enter or Space is the reflex the moment a
   * dialog appears, and on "Delete your account?" that reflex was irreversible
   * — it destroyed the account and every pillar with no typed confirmation.
   * Anything non-destructive still focuses the affirmative button, which is
   * where the user wants to be. */
  useEffect(() => {
    if (!req) return;
    const t = setTimeout(() => {
      if (req.kind === "prompt") inputRef.current?.select();
      else if (req.danger) cancelRef.current?.focus();
      else confirmRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [req]);

  // Escape cancels; Tab is trapped inside the panel so focus cannot wander
  // behind the scrim to controls the user cannot see.
  useEffect(() => {
    if (!req) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(req.kind === "prompt" ? null : false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, input, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [req, close]);

  const api: DialogApi = {
    alert: (title, body) => open({ kind: "alert", title, body }).then(() => undefined),
    confirm: (title, opts) =>
      open({ kind: "confirm", title, ...opts }).then((v) => v === true),
    prompt: (title, opts) =>
      open({ kind: "prompt", title, ...opts }).then((v) => (typeof v === "string" ? v : null)),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {req ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* The scrim carries its own handler. It used to rely on the wrapper
              seeing `e.target === e.currentTarget`, but the scrim is painted
              ON TOP of the wrapper and so was always the target itself — the
              condition never held and clicking outside did nothing. A click
              inside the panel cannot reach this element at all, so the dialog
              still does not dismiss from its own content. */}
          <div
            className="absolute inset-0 bg-[rgba(4,16,31,0.55)]"
            aria-hidden
            onMouseDown={() => close(req.kind === "prompt" ? null : false)}
          />
          <div
            ref={panelRef}
            role={req.kind === "alert" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="zaff-dialog-title"
            className="zaff-reveal relative w-full max-w-[380px] rounded-2xl border border-line bg-surface p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]"
          >
            <h2
              id="zaff-dialog-title"
              className="font-heading text-[16px] leading-snug text-heading"
            >
              {req.title}
            </h2>
            {req.body ? (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{req.body}</p>
            ) : null}

            {req.kind === "prompt" ? (
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") close(value);
                }}
                placeholder={req.placeholder}
                maxLength={200}
                // A field is white paper in both themes, so its ink is on-card.
                style={{ backgroundColor: value.trim() ? "var(--field)" : "var(--field-empty)" }}
                className="mt-3 w-full min-h-[44px] rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-on-card outline-none transition-colors focus:border-line-focus"
              />
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              {req.kind !== "alert" ? (
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => close(req.kind === "prompt" ? null : false)}
                  className="min-h-[40px] rounded-xl border border-line px-4 text-[13.5px] font-semibold text-muted transition-colors hover:bg-line-soft"
                >
                  {req.cancelLabel ?? "Cancel"}
                </button>
              ) : null}
              <button
                ref={confirmRef}
                type="button"
                onClick={() => close(req.kind === "prompt" ? value : true)}
                className={cx(
                  "min-h-[40px] rounded-xl px-4 text-[13.5px] font-semibold transition-colors",
                  req.danger
                    ? "bg-danger text-on-danger hover:opacity-90"
                    : "bg-gold text-on-gold hover:bg-gold-hover",
                )}
              >
                {req.confirmLabel ?? (req.kind === "alert" ? "OK" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

/**
 * The app's dialogs. Falls back to the native ones when used outside the
 * provider, so a component can never lose the ability to ask.
 */
export function useDialog(): DialogApi {
  const ctx = useContext(Ctx);
  return (
    ctx ?? {
      alert: async (t, b) => void window.alert(b ? `${t}\n\n${b}` : t),
      confirm: async (t, o) => window.confirm(o?.body ? `${t}\n\n${o.body}` : t),
      prompt: async (t, o) => window.prompt(t, o?.defaultValue ?? ""),
    }
  );
}
