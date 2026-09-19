"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { useNextParam } from "@/lib/next-path";
import { AuthShell, Eagle } from "@/components/shell";
import { Button, TextField, Loading } from "@/components/ui";

export default function VerifyEmail() {
  const { user, loading, verifyEmail, resendVerification, signOut } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  /** Where a sign-up was heading (a QR code's pricing link), else Home. */
  const next = useNextParam();

  useEffect(() => {
    if (loading || next === undefined) return;
    if (!user) router.replace("/login");
    else if (user.isVerified) router.replace(next ?? "/home");
  }, [user, loading, router, next]);

  if (loading || !user) return <Loading />;

  const submit = async () => {
    if (code.trim().length < 4) return setError("Enter the code from your email.");
    setBusy(true);
    setError(null);
    const err = await verifyEmail(code);
    setBusy(false);
    if (err) setError(err);
    else router.replace(next ?? "/home");
  };

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center mb-6">
        <Eagle size={72} />
        <h2 className="font-heading text-[28px] text-ink mt-3">Verify your email</h2>
        <p className="text-dim mt-1">We sent a code to {user.email}. Enter it below.</p>
      </div>
      <TextField label="Verification code" value={code} onChange={setCode} placeholder="6-digit code" error={error ?? undefined} />
      <Button label="Verify" onClick={submit} loading={busy} />
      <Button
        label={sent ? "Code sent" : "Resend code"}
        variant="ghost"
        className="mt-2"
        onClick={async () => {
          await resendVerification();
          setSent(true);
        }}
      />
      <button onClick={() => { signOut(); router.replace("/login"); }} className="mt-4 block w-full text-center text-[14px] font-semibold text-muted">
        Use a different account
      </button>
    </AuthShell>
  );
}
