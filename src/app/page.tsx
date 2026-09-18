"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";
import { Eagle } from "@/components/shell";
import { Loading } from "@/components/ui";

export default function Welcome() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [user, loading, router]);

  if (loading || user) return <Loading />;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <Eagle size={110} />
      <h1 className="font-heading mt-4 text-[34px] leading-none">
        <span className="text-gold">ZAFFAR</span>
        <span className="text-heading">OLOGY</span>
      </h1>
      <p className="font-heading mt-3 text-[22px] leading-tight">
        <span className="text-heading">TRANSFORMATION </span>
        <span className="text-gold">SYSTEM</span>
      </p>
      <p className="mt-3 text-[17px] text-dim">
        A practical business platform to help you build, grow and scale your
        business, bringing 40 years of business success into just 3 powerful years.
      </p>

      <div className="mt-10 w-full space-y-3">
        <Link href="/signup" className="block w-full rounded-xl bg-gold px-5 py-3.5 text-center font-semibold text-on-gold hover:bg-gold-hover">
          Create account
        </Link>
        <Link href="/login" className="block w-full rounded-xl border border-line px-5 py-3.5 text-center font-semibold text-heading hover:bg-line-soft">
          Log in
        </Link>
      </div>
      <p className="mt-6 text-[13px] text-muted">Version 2.0.0</p>
    </main>
  );
}
