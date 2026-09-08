"use client";

/**
 * Light / Dark / System, the same three choices the phone offers in Profile.
 *
 * The choice is written to `data-theme` on <html>, which globals.css reads.
 * "System" removes the attribute and lets `prefers-color-scheme` decide, so a
 * user who never picks a side follows their machine.
 *
 * The stored value is read in a blocking inline script before first paint (see
 * `ThemeScript`), because applying it in an effect means one frame of the wrong
 * theme on every load — a white flash on a dark page.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "zaff:theme";

/** Runs before the first paint. Kept tiny and dependency-free on purpose: it is
 *  inlined into the document head as a string. */
const SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

export function ThemeScript() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

interface ThemeValue {
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
  /** What is actually showing right now, after resolving "system". */
  resolved: "light" | "dark";
}

const Ctx = createContext<ThemeValue | null>(null);

const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Read the stored choice once mounted. The inline script has already applied
  // it to the document; this only syncs React's copy.
  useEffect(() => {
    let stored: ThemeChoice = "system";
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {
      // Private window, or storage disabled. System is a fine answer.
    }
    setChoiceState(stored);
  }, []);

  // Apply the choice, and track what it resolves to.
  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);

    const update = () =>
      setResolved(choice === "system" ? (systemPrefersDark() ? "dark" : "light") : choice);
    update();

    if (choice !== "system") return undefined;
    // Only "system" needs to follow the machine changing under it.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [choice]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      if (c === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, c);
    } catch {
      // The choice still applies for this session.
    }
  }, []);

  return <Ctx.Provider value={{ choice, setChoice, resolved }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(Ctx);
  // A component outside the provider should not crash the page over a theme.
  return ctx ?? { choice: "system", setChoice: () => {}, resolved: "light" };
}
