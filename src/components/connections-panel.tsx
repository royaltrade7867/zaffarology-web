"use client";

/**
 * Connections: add someone by email, disconnect.
 *
 * Mirrors `zaffarology-mobileapp/src/components/connections-panel.tsx`.
 *
 * There is no accept step. Adding a registered person connects you both
 * immediately; an address with no account yet stays in "Invites sent" and
 * connects the moment they register. So the only pending rows a user can ever
 * see are their own outgoing invites to people who have not signed up.
 *
 * `/connections/invite` still answers byte-identically for every outcome, and
 * this UI still shows one message regardless — but note the reply is no longer
 * the only signal: an accepted row appears straight away, which does reveal
 * that the address has an account. That trade was made deliberately.
 */
import { useCallback, useEffect, useState } from "react";

import { Close, Mail, People, Plus } from "@/components/icons";
import { cx } from "@/components/ui";
import { apiErrorMessage } from "@/lib/api";
import { reportError } from "@/lib/error-reporting";
import { useDialog } from "@/components/dialog";
import {
  inviteConnection,
  loadConnections,
  removeConnection,
  type ApiConnection,
} from "@/lib/connections-api";

const nameOf = (r: ApiConnection) => r.full_name?.trim() || r.email;

/** First letter of the display name, for the row marker. */
const initial = (r: ApiConnection) => nameOf(r).charAt(0).toUpperCase() || "?";

export function ConnectionsPanel({ refreshKey }: { refreshKey?: number }) {
  const dialog = useDialog();
  const [rows, setRows] = useState<ApiConnection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  // Ids currently mid-request, so a row can't be double-clicked into two calls.
  const [busy, setBusy] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    try {
      setRows(await loadConnections());
      setError(null);
    } catch (err) {
      setError("Could not load your connections.");
      reportError(err, { area: "connections-load" });
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // An invite may have been accepted on another device, and there is no push
  // channel to tell us.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setSending(true);
    setSent(null);
    try {
      await inviteConnection(value);
      // The server answers the same way whether or not that address has an
      // account, so this message must not claim to know either.
      setSent(`If ${value} can be invited, we've sent them an invite.`);
      setEmail("");
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not send that invite. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const withBusy = async (id: number, fn: () => Promise<void>, failMsg: string) => {
    if (busy.includes(id)) return;
    setBusy((b) => [...b, id]);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, failMsg));
    } finally {
      setBusy((b) => b.filter((x) => x !== id));
    }
  };

  const disconnect = async (r: ApiConnection) => {
    if (
      !await dialog.confirm(
        `Disconnect from ${nameOf(r)}? You'll no longer be able to tag each other on tasks.`,
      )
    )
      return;
    withBusy(r.id, () => removeConnection(r.id), "Could not disconnect.");
  };

  const cancelInvite = async (r: ApiConnection) => {
    if (!await dialog.confirm(`Withdraw the invite to ${r.email}?`, { confirmLabel: "Withdraw", danger: true })) return;
    withBusy(r.id, () => removeConnection(r.id), "Could not withdraw that invite.");
  };

  // No `incoming` list: nothing arrives needing approval any more. The only
  // pending rows are outgoing invites to addresses with no account yet.
  const outgoing = rows.filter((r) => r.status === "pending" && r.direction === "outgoing");
  const accepted = rows.filter((r) => r.status === "accepted");

  return (
    <section>
      <h2 className="font-heading text-[20px] leading-tight text-heading">CONNECTIONS</h2>
      <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
        Connect with the people you work with, then tag them on a task to put it
        on their board too.
      </p>

      {/* Invite */}
      <form onSubmit={invite} className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="invite-email">
          Email address to invite
        </label>
        <div className="relative min-w-[240px] flex-1">
          <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            maxLength={254}
            style={{ backgroundColor: email.trim() ? "var(--field)" : "var(--field-empty)" }}
            className="w-full min-h-[44px] rounded-xl border border-line pl-9 pr-3.5 py-2.5 text-[15px] text-on-card outline-none transition-colors focus:border-gold"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className={cx(
            "flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-colors",
            sending || !email.trim()
              ? "cursor-not-allowed border border-line text-muted"
              : "bg-gold text-on-gold hover:bg-gold-hover",
          )}
        >
          <Plus size={17} />
          {sending ? "Sending…" : "Invite"}
        </button>
      </form>

      {sent ? (
        <p className="mt-2 text-[13px] text-muted" role="status">
          {sent}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[13px] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {/* Connected */}
      {accepted.length ? (
        <Group title="Connected">
          {accepted.map((r) => (
            <Row key={r.id} r={r} sub={r.email}>
              <IconButton
                label={`Disconnect from ${nameOf(r)}`}
                onClick={() => disconnect(r)}
                disabled={busy.includes(r.id)}
              >
                <Close size={17} />
              </IconButton>
            </Row>
          ))}
        </Group>
      ) : null}

      {/* Sent, still waiting — only ever addresses with no account yet, since a
          registered person connects on the spot. They join automatically when
          they sign up with this address. */}
      {outgoing.length ? (
        <Group title="Invites sent">
          {outgoing.map((r) => (
            <Row key={r.id} r={r} sub="Invited — they'll join when they sign up">
              <IconButton
                label={`Withdraw invite to ${r.email}`}
                onClick={() => cancelInvite(r)}
                disabled={busy.includes(r.id)}
              >
                <Close size={17} />
              </IconButton>
            </Row>
          ))}
        </Group>
      ) : null}

      {loaded && !error && !rows.length ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <People size={26} className="mx-auto text-muted" />
          <p className="mt-2 font-heading text-[16px] text-heading">No connections yet</p>
          <p className="mx-auto mt-1 max-w-[44ch] text-[13.5px] leading-relaxed text-muted">
            Add someone by email above. You&rsquo;ll be connected straight away,
            and can tag each other on tasks and see them through.
          </p>
        </div>
      ) : null}
    </section>
  );
}

/* -------------------------------- pieces -------------------------------- */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 font-heading text-[12px] uppercase tracking-wide text-muted">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function Row({
  r,
  sub,
  children,
}: {
  r: ApiConnection;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-line-soft font-heading text-[14px] text-heading"
      >
        {initial(r)}
      </span>
      <span className="min-w-0 flex-1">
        {/* Names and email addresses show in full — a clipped address is
            unusable for telling two people apart. */}
        <span className="block break-words text-[14.5px] font-semibold text-ink">{nameOf(r)}</span>
        <span className="block break-words text-[12.5px] text-muted">{sub}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "accept";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
        disabled
          ? "cursor-not-allowed border-line text-muted"
          : tone === "accept"
            ? "border-[color:var(--gold)] text-gold hover:bg-gold/8"
            : "border-line text-muted hover:border-danger hover:text-danger",
      )}
    >
      {children}
    </button>
  );
}
