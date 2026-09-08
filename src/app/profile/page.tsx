"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
import { Button } from "@/components/ui";

const ROLE_LABELS: Record<string, string> = {
  individual: "Individual",
  employee: "Employee",
  company_admin: "Company admin",
};

function ProfileInner() {
  const { user, company, signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!window.confirm("This permanently deletes your account and all your pillar data. This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteAccount();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-[12px] tracking-widest font-heading text-gold">PROFILE</p>
      <h1 className="font-heading text-[28px] text-ink">{user?.fullName}</h1>
      <p className="text-dim">{user?.email}</p>
      <p className="text-muted">
        {ROLE_LABELS[user?.role ?? ""] ?? ""}
        {user?.companyName ? ` · ${user.companyName}` : ""}
      </p>

      {company && user?.role === "company_admin" ? (
        <div className="mt-5 rounded-xl border-[1.5px] border-gold bg-surface p-4">
          <p className="text-[12px] tracking-widest font-heading text-gold">TEAM INVITE CODE</p>
          <p className="font-heading text-[24px] tracking-widest text-gold-text mt-1">{company.inviteCode}</p>
          <p className="text-muted text-[13px] mt-1">Share this code with your employees. They choose &ldquo;Join a company&rdquo; at sign-up.</p>
        </div>
      ) : null}

      <div className="mt-8 space-y-2 max-w-sm">
        <Button label="Log out" variant="ghost" onClick={async () => { await signOut(); router.replace("/"); }} />
        <Button label="Delete account" variant="danger" onClick={confirmDelete} loading={busy} />
      </div>
    </div>
  );
}

export default function Profile() {
  return (
    <AuthGuard>
      <ProfileInner />
    </AuthGuard>
  );
}
