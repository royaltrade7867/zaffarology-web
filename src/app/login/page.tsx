"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthShell, Eagle } from "@/components/shell";
import { Button, TextField } from "@/components/ui";

/* `useSearchParams` opts the tree into client rendering, so the page needs a
   Suspense boundary or the static export fails at build time. */
export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell><div className="py-16" /></AuthShell>}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    /* Catch a malformed address here rather than sending it. The server can only
       answer "Invalid credentials", which tells the user their PASSWORD is wrong
       when the real problem is the email — and that message must stay vague, so
       it cannot be made specific server-side without leaking which accounts
       exist. Deliberately loose: `x@y` is valid, and real addresses are stranger
       than most patterns allow. */
    if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) {
      setError("That does not look like an email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
    else {
      /* Only ever an in-app PATH. Taking a full URL here would turn the login
         form into an open redirect — a phishing link could bounce a freshly
         authenticated user to another origin. */
      const raw = search.get("next") ?? "";
      const safe = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/home";
      router.replace(safe);
    }
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
        <TextField
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          // The longest address the RFC allows is 254 characters; a 573-char one
          // was being accepted and sent.
          maxLength={254}
          required
          autoFocus
          placeholder="you@company.com"
        />
        <TextField
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
          // Without this a password manager cannot reliably fill the field.
          autoComplete="current-password"
          maxLength={200}
          required
          placeholder="Your password"
          error={error ?? undefined}
        />
        <Button type="submit" label="Log in" onClick={submit} loading={busy} />
      </form>

      {/* A COLUMN, rather than trusting the links to be block-level.
          `.tap-row` sets `display: inline-flex` in globals.css, and a plain class
          selector beats Tailwind's `block` utility of the same specificity when
          it is defined later — so the two links stayed on one line and read as
          "Forgot password?New here? Create account". Stacking is the parent's
          job here; the children keep their own display. */}
      <div className="mt-3 flex flex-col items-center gap-2">
        <Link href="/forgot-password" className="tap-row text-center text-[14px] font-semibold text-heading">Forgot password?</Link>
        <Link href={`/signup${search.get("next") ? `?next=${encodeURIComponent(search.get("next")!)}` : ""}`} className="tap-row text-center text-[14px] font-semibold text-heading">New here? Create account</Link>
      </div>
    </AuthShell>
  );
}
