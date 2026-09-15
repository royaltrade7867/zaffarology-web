"use client";

import { useEffect, useState } from "react";

import { api, apiErrorMessage, type ApiTeamOut } from "@/lib/api";
import { PILLARS, backendPillarId } from "@/lib/pillars";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/shell";
import { ConnectionsPanel } from "@/components/connections-panel";
import { Loading, cx } from "@/components/ui";

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
      {/* Connections come first: they apply to every account, whereas the
          progress table below only exists for a company. */}
      <ConnectionsPanel />

      <hr className="my-8 border-line" />

      <p className="text-[12px] tracking-widest font-heading text-gold">YOUR TEAM</p>
      <h1 className="font-heading text-[28px] text-ink">Team progress</h1>
      <p className="text-dim">
        {/* The separator needs its own spaces: `{code} · text` renders the code
            hard against the dot when the value has no trailing space. */}
        Invite code: {company?.inviteCode ?? "N/A"}
        {" · "}
        Each member&apos;s pillar progress updates as they work.
      </p>

      {!loaded ? (
        <Loading full={false} />
      ) : error ? (
        <p className="text-danger mt-4">{error}</p>
      ) : !data || data.members.length <= 1 ? (
        <p className="text-muted mt-6">No team members yet. Share your invite code so they can join.</p>
      ) : (
        <div className="mt-5 rounded-xl border border-line">
          {/* On a phone the table scrolls INSIDE this box — the page itself
              never scrolls sideways. That is right, but nothing said so, and
              "Overall" (the number people actually want) sat up to 286px out of
              view at 320px. The hint appears only where the table cannot fit. */}
          <p className="border-b border-line px-3 py-1.5 text-[11px] text-muted sm:hidden">
            Scroll sideways to see every pillar and the overall score.
          </p>
          <div className="overflow-x-auto">
          {/* `min-w-[760px]` against a 734px container clipped the Overall column —
              the most important number on the page — at every desktop width,
              rendering it as "Overal". The pillar columns hold a single digit
              and a percentage, so the table fits well under 640px; the wrapper
              keeps its scroller for genuinely narrow phones. */}
          <table className="min-w-[560px] w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-line-soft">
              <tr>
                <th className="px-3 py-2 font-semibold text-heading">Member</th>
                {/* The header sits on `bg-line-soft`, a tint — which drops gold
                    to 4.41:1 in light while every other accent clears 4.5. The
                    deeper gold token fixes only that one, and is already the
                    same value in dark. */}
                {PILLARS.map((p) => (
                  <th
                    key={p.n}
                    /* Pillar 1's accent is gold, and on the LIGHT header fill
                       `--p1` (#8f6200) was 4.41:1 — just under AA. The fix was
                       `--gold-deep`, but that token is #8a5b13 in BOTH themes,
                       so on the DARK header it dropped to 2.13:1 while every
                       sibling lightened correctly. Deep gold in light only;
                       dark uses the accent like the other four. */
                    className="px-2 py-2 text-center font-semibold"
                    style={{ color: p.n === 1 ? "var(--gold-header)" : p.accent }}
                    title={p.name}
                  >
                    {p.n}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold text-heading">Overall</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  {/* The one cell holding words rather than digits, so it wraps:
                      `whitespace-nowrap` on the table kept long names and email
                      addresses on a single line, pushing them under the
                      horizontal scroller. */}
                  <td className="px-3 py-2 whitespace-normal">
                    <div className="font-semibold text-ink break-words">{m.full_name ?? m.email}</div>
                    <div className="text-muted text-[11px] break-all">{m.email}</div>
                  </td>
                  {PILLARS.map((p) => {
                    // Keyed by the BACKEND id, not the displayed number — Pillar 5
                    // is stored and reported as 8. Looking up `p.n` meant Pillar 5
                    // asked for "5", got nothing, and showed a grey 0% for every
                    // member no matter how much work they had actually done.
                    const pct = Math.round((m.per_pillar?.[backendPillarId(p)] ?? 0) * 100);
                    return (
                      <td key={p.n} className="px-2 py-2 text-center">
                        {/* A 0% chip is NOT a filled accent, so `on-accent` —
                            tuned for text ON a colour — landed at 1.63:1 on the
                            hairline. An unstarted pillar reads as muted text in
                            an outline instead. */}
                        <span
                          className={cx(
                            "inline-block min-w-[34px] rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                            pct ? "text-on-accent" : "border border-line text-muted",
                          )}
                          style={pct ? { backgroundColor: p.accent } : undefined}
                        >
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
