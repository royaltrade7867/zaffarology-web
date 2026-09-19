"use client";

import { cx } from "@/components/ui";
import { useTheme, type ThemeChoice } from "@/lib/theme";

/**
 * Light / Dark / System, the same three the phone offers.
 *
 * Lives on the Help page (Zaffar, 19 Sep: "Appearance should come under
 * help"); it used to sit on Profile.
 */
export function ThemePicker({ className }: { className?: string }) {
  const { choice, setChoice } = useTheme();
  return (
    <section className={cx("max-w-sm", className)}>
      <h2 className="font-heading text-[12px] uppercase tracking-wide text-muted">Appearance</h2>
      <div role="group" aria-label="Appearance" className="mt-2 flex gap-2">
        {(
          [
            { k: "light" as const, label: "Light" },
            { k: "dark" as const, label: "Dark" },
            { k: "system" as const, label: "System" },
          ]
        ).map(({ k, label }) => {
          const on = choice === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => setChoice(k as ThemeChoice)}
              className={cx(
                "flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors",
                on ? "border-gold text-gold" : "border-line text-muted hover:bg-line-soft",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
