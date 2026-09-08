"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthShell, Eagle } from "@/components/shell";
import { Button, TextField, cx } from "@/components/ui";

type Path = "individual" | "company" | "employee";
const PATHS: { key: Path; label: string; hint: string }[] = [
  { key: "individual", label: "Individual", hint: "Work through the 5 pillars on your own" },
  { key: "company", label: "Company", hint: "Create your company and invite your team" },
  { key: "employee", label: "Join a company", hint: "Enter the invite code from your admin" },
];

export default function Signup() {
  const { signUpIndividual, signUpCompany, signUpEmployee } = useAuth();
  const router = useRouter();
  const [path, setPath] = useState<Path>("individual");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError("Fill in your name, email, and a password of at least 6 characters.");
      return;
    }
    if (path === "company" && !companyName.trim()) return setError("Enter your company name.");
    if (path === "employee" && !inviteCode.trim()) return setError("Enter your company invite code.");
    setBusy(true);
    setError(null);
    const err =
      path === "individual"
        ? await signUpIndividual(fullName, email, password)
        : path === "company"
          ? await signUpCompany(fullName, email, password, companyName)
          : await signUpEmployee(fullName, email, password, inviteCode);
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

      <div className="space-y-2 mb-4">
        {PATHS.map((p) => {
          const selected = path === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPath(p.key)}
              className={cx("w-full rounded-xl border-[1.5px] p-3.5 text-left transition-colors", selected ? "border-gold bg-surface" : "border-line bg-surface")}
            >
              <span className="block font-heading text-[15px]" style={{ color: selected ? "var(--gold)" : "var(--ink)" }}>{p.label}</span>
              <span className="block text-[13px] text-muted">{p.hint}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="Your name" />
        <TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="you@company.com" />
        <TextField label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" />
        {path === "company" ? <TextField label="Company name" value={companyName} onChange={setCompanyName} placeholder="Your company" /> : null}
        {path === "employee" ? <TextField label="Invite code" value={inviteCode} onChange={setInviteCode} placeholder="e.g. ACME-X1Y2" /> : null}
        {error ? <p className="text-[13px] text-danger mb-3">{error}</p> : null}
        <Button type="submit" label="Create account" onClick={submit} loading={busy} />
      </form>

      <Link href="/login" className="mt-3 block text-center text-[14px] font-semibold text-heading">Already have an account? Log in</Link>
    </AuthShell>
  );
}
