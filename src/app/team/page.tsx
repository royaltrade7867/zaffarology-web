"use client";

import { useEffect, useState } from "react";

import { api, apiErrorMessage, type ApiTeamOut } from "@/lib/api";
import { PILLARS } from "@/lib/pillars";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
import { Loading } from "@/components/ui";

function TeamInner() {
  const { company } = useAuth();
  const [data, setData] = useState<ApiTeamOut | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ApiTeamOut>("/company/team")
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err, "Could not load your team.")))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div>
      <p className="text-[12px] tracking-widest font-heading text-gold">YOUR TEAM</p>
      <h1 className="font-heading text-[28px] text-ink">Team progress</h1>
      <p className="text-dim">
        Invite code: {company?.inviteCode ?? "N/A"} · Each member&apos;s pillar progress updates as they work.
      </p>

      {!loaded ? (
        <Loading full={false} />
      ) : error ? (
        <p className="text-danger mt-4">{error}</p>
      ) : !data || data.members.length <= 1 ? (
        <p className="text-muted mt-6">No team members yet. Share your invite code so they can join.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="min-w-[760px] w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-line-soft">
              <tr>
                <th className="px-3 py-2 font-semibold text-heading">Member</th>
                {PILLARS.map((p) => (
                  <th key={p.n} className="px-2 py-2 text-center font-semibold" style={{ color: p.accent }} title={p.name}>
                    {p.n}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold text-heading">Overall</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-ink">{m.full_name ?? m.email}</div>
                    <div className="text-muted text-[11px]">{m.email}</div>
                  </td>
                  {PILLARS.map((p) => {
                    const pct = Math.round((m.per_pillar?.[String(p.n)] ?? 0) * 100);
                    return (
                      <td key={p.n} className="px-2 py-2 text-center">
                        <span className="inline-block min-w-[34px] rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: pct ? p.accent : "var(--line)" }}>
                          {pct}%
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-semibold text-heading">{Math.round((m.overall ?? 0) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Team() {
  return (
    <AuthGuard>
      <TeamInner />
    </AuthGuard>
  );
}
