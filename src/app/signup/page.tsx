"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthShell, Eagle } from "@/components/shell";
import { Button, TextField } from "@/components/ui";

/**
 * One way in: everyone signs up as an individual.
 *
 * The three-way picker (Individual / Company / Join a company) is gone. A team
 * is now built by adding people from Profile → Connections, which connects them
 * instantly — no company to create and no invite code to pass around.
 *
 * `signUpCompany` and `signUpEmployee` still exist in the auth context and on
 * the backend, and the 4 users who already belong to a company keep their role
 * and their Team progress table. Nothing was migrated; this only closes the
 * door on NEW company sign-ups.
 */
export default function Signup() {
  const { signUpIndividual } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError("Fill in your name, email, and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await signUpIndividual(fullName, email, password);
    setBusy(false);
    if (err) setError(err);
    else router.replace("/home");
  };

  return (
    <AuthShell>
      <div className="flex flex-col items-center text-center mb-6">
        <Eagle size={72} />
        <h1 className="font-heading mt-3 text-[22px]">
          <span className="text-gold">ZAFFAR</span>
          <span className="text-heading">OLOGY</span>
        </h1>
        <p className="text-[12px] tracking-widest text-gold mt-2 font-semibold">GET STARTED</p>
        <h2 className="font-heading text-[28px] text-ink">Create account</h2>
        <p className="text-dim mt-1">Create your account to start building your 5 pillars.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="Your name" />
        <TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="you@company.com" />
        <TextField label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" />
        {error ? <p className="text-[13px] text-danger mb-3">{error}</p> : null}
        <Button type="submit" label="Create account" onClick={submit} loading={busy} />
      </form>

      <Link href="/login" className="mt-3 block text-center text-[14px] font-semibold text-heading">Already have an account? Log in</Link>
    </AuthShell>
  );
}
