"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthShell, Eagle } from "@/components/shell";
import { Button, TextField } from "@/components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
    else router.replace("/home");
  };

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center mb-6">
        <Eagle size={80} />
        <h1 className="font-heading mt-3 text-[22px]">
          <span className="text-gold">ZAFFAR</span>
          <span className="text-heading">OLOGY</span>
        </h1>
        <p className="text-[12px] tracking-widest text-gold mt-2 font-semibold">WELCOME BACK</p>
        <h2 className="font-heading text-[28px] text-ink">Log in</h2>
        <p className="text-dim mt-1">Continue building your 5 pillars.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="you@company.com" />
        <TextField label="Password" value={password} onChange={setPassword} type="password" placeholder="Your password" error={error ?? undefined} />
        <Button type="submit" label="Log in" onClick={submit} loading={busy} />
      </form>

      <div className="mt-3 space-y-2">
        <Link href="/forgot-password" className="block text-center text-[14px] font-semibold text-heading">Forgot password?</Link>
        <Link href="/signup" className="block text-center text-[14px] font-semibold text-heading">New here? Create account</Link>
      </div>
    </AuthShell>
  );
}
