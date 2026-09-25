"use client";

/**
 * Choosing a first password, from a workshop invite link.
 *
 * One step on purpose. A workshop attendee gets an email, taps the button,
 * picks a password, and is in. Setting it from a link sent to their own
 * address also proves the address, so there is no separate verification to
 * chase.
 *
 * This page cannot RESET a password. The backend refuses when the account
 * already has one, which is what stops an old invite in an inbox, or a
 * forwarded one, from being a way to take the account over. That refusal is
 * shown here as its own state, pointing at Forgot password.
 *
 * After success it does a FULL navigation rather than a client-side route
 * change, so the auth context re-bootstraps from the new token instead of
 * needing a private setter widened for this one page.
 */

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { AuthShell, Eagle } from "@/components/shell";
import { Button, Loading, TextField } from "@/components/ui";
import { apiErrorMessage, setToken } from "@/lib/api";
import {
  type InviteStatus,
  inviteStatus,
  setPasswordFromInvite,
} from "@/lib/checkin";

const MIN_LENGTH = 8;

export default function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inviteStatus(token)
      .then(setStatus)
      .catch(() => setStatus({ valid: false, reason: "invalid", name: "" }));
  }, [token]);

  const submit = async () => {
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await setPasswordFromInvite(token, password);
      setToken(data.access_token);
      // Full load, so the auth context picks up the new session from scratch.
      window.location.href = "/home";
    } catch (err) {
      setError(apiErrorMessage(err, "That did not work. Try again."));
      setBusy(false);
    }
  };

  if (!status) return <Loading label="Checking your invite" />;

  // --- already has a password ----------------------------------------------
  if (!status.valid && status.reason === "already_set") {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <Eagle size={72} />
          <h1 className="font-heading text-ink mt-4 text-[24px]">
            You already have a password
          </h1>
          <p className="text-dim mt-2 leading-relaxed">
            This invite was already used. Sign in with the password you chose,
            or reset it if you have forgotten it.
          </p>
          <Link
            href="/login"
            className="text-gold mt-5 font-semibold underline underline-offset-4"
          >
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  // --- expired or tampered --------------------------------------------------
  if (!status.valid) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <Eagle size={72} />
          <h1 className="font-heading text-ink mt-4 text-[24px]">
            This link has expired
          </h1>
          <p className="text-dim mt-2 leading-relaxed">
            Invite links last 14 days. Ask the Zaffarology team to send you a
            new one, and it will work straight away.
          </p>
          <Link
            href="/login"
            className="text-gold mt-5 font-semibold underline underline-offset-4"
          >
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-6 flex flex-col items-center text-center">
        <Eagle size={80} />
        <h1 className="font-heading mt-3 text-[22px]">
          <span className="text-gold">ZAFFAR</span>
          <span className="text-heading">OLOGY</span>
        </h1>
        <p className="text-gold mt-2 text-[12px] font-semibold tracking-widest">
          {status.name ? `WELCOME ${status.name.toUpperCase()}` : "WELCOME"}
        </p>
        <h2 className="font-heading text-ink text-[28px]">Choose a password</h2>
        <p className="text-dim mt-1 leading-relaxed">
          That is the only step. Your account is ready once you pick one.
        </p>
        {status.email ? (
          <p className="text-muted mt-2 text-[14px]">{status.email}</p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          label="New password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          type="password"
          autoComplete="new-password"
          autoFocus
          maxLength={128}
        />
        <TextField
          label="Type it again"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setError(null);
          }}
          type="password"
          autoComplete="new-password"
          maxLength={128}
        />

        <p className="text-muted mb-3 text-[13px]">
          At least {MIN_LENGTH} characters.
        </p>

        {error ? (
          <p role="alert" className="text-danger mb-3 text-[14px]">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          label="Set my password and continue"
          loading={busy}
          className="w-full"
        />
      </form>
    </AuthShell>
  );
}
