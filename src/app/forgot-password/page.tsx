"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, apiErrorMessage } from "@/lib/api";
import { AuthShell, Eagle } from "@/components/shell";
import { Button, TextField } from "@/components/ui";

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (!email.trim()) return setError("Enter your email.");
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password/code", { email: email.trim().toLowerCase() });
      setStep(2);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not send a reset code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (code.trim().length < 4 || password.length < 6) return setError("Enter the code and a new password (6+ characters).");
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/reset-password/code", { email: email.trim().toLowerCase(), code: code.trim(), new_password: password });
      router.replace("/login");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not reset your password. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center mb-6">
        <Eagle size={72} />
        <h2 className="font-heading text-[28px] text-ink mt-3">Reset password</h2>
        <p className="text-dim mt-1">{step === 1 ? "We'll email you a reset code." : "Enter the code and your new password."}</p>
      </div>
      {step === 1 ? (
        <>
          <TextField label="Email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" error={error ?? undefined} />
          <Button label="Send reset code" onClick={sendCode} loading={busy} />
        </>
      ) : (
        <>
          <TextField label="Reset code" value={code} onChange={setCode} placeholder="6-digit code" />
          <TextField label="New password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" error={error ?? undefined} />
          <Button label="Reset password" onClick={reset} loading={busy} />
        </>
      )}
      <Link href="/login" className="mt-3 block text-center text-[14px] font-semibold text-heading">Back to log in</Link>
    </AuthShell>
  );
}
