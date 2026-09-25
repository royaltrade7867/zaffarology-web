"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  api,
  apiErrorMessage,
  loadToken,
  setToken,
  type ApiAuthOut,
  type ApiBillingStatus,
  type ApiUser,
} from "@/lib/api";

export type Role = "individual" | "employee" | "company_admin";
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isVerified: boolean;
  companyId?: string;
  companyName?: string;
}
export interface Company {
  id: string;
  name: string;
  inviteCode: string;
}

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  loading: boolean;
  /**
   * Whether this user may use the app, and until when.
   *
   * `null` means "not known yet" — still loading, or the request failed. It is
   * deliberately NOT the same as "locked out": treating unknown as locked would
   * flash the paywall at a paying customer every time the network hiccuped.
   * `billingLoading` distinguishes the two.
   */
  billing: ApiBillingStatus | null;
  billingLoading: boolean;
  /** Re-read status — after paying, or when a 402 says it changed. */
  refreshBilling: () => Promise<void>;
  /**
   * Ask the backend to re-read RevenueCat NOW and return the fresh answer. For
   * the moment after a purchase, before RevenueCat's webhook has arrived.
   */
  syncBilling: () => Promise<ApiBillingStatus | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUpIndividual: (fullName: string, email: string, password: string) => Promise<string | null>;
  signUpCompany: (fullName: string, email: string, password: string, companyName: string) => Promise<string | null>;
  signUpEmployee: (fullName: string, email: string, password: string, inviteCode: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toUser = (u: ApiUser): User => ({
  id: String(u.id),
  email: u.email,
  fullName: u.full_name ?? "",
  role: u.role,
  isVerified: u.is_verified ?? true,
  companyId: u.company ? String(u.company.id) : undefined,
  companyName: u.company?.name,
});
const toCompany = (u: ApiUser): Company | null =>
  u.company ? { id: String(u.company.id), name: u.company.name, inviteCode: u.company.invite_code } : null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<ApiBillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);

  const syncBilling = useCallback(async () => {
    try {
      const fresh = await api.post<ApiBillingStatus>("/billing/refresh", {});
      setBilling(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const refreshBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      setBilling(await api.get<ApiBillingStatus>("/billing/status"));
    } catch {
      // Leave the last known answer in place. Wiping it on a failed request
      // would lock out a paying customer whose network blinked.
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = loadToken();
        // No token means signed out — `billingLoading` must still clear, or the
        // guard waits forever on a state that will never arrive.
        if (!token) {
          if (active) setBillingLoading(false);
          return;
        }
        const data = await api.get<ApiUser>("/auth/session");
        if (active) {
          setUser(toUser(data));
          setCompany(toCompany(data));
        }
        // Only after the session resolves: an unverified user has no
        // entitlement to read, and asking first would 403 for nothing.
        if (active && (data.is_verified ?? true)) await refreshBilling();
        else if (active) setBillingLoading(false);
      } catch {
        // offline or expired token — stay signed out
        if (active) setBillingLoading(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshBilling]);

  /**
   * Read billing for a user who just signed in, BEFORE they are published.
   *
   * Order matters: `AuthGuard` decides on `user` and `billing` together, so
   * setting the user first would render the app with no billing answer and then
   * bounce.
   *
   * This used to skip the read for an unverified account, because
   * `/billing/status` sat behind a verified-user check that would only 403.
   * Verification is gone and that check no longer rejects anyone, so skipping it
   * would now leave `billing` null for every account created before the change,
   * and a null billing answer reads as "not locked" — handing them the whole app
   * for free.
   */
  const loadBillingFor = useCallback(async () => {
    await refreshBilling();
  }, [refreshBilling]);

  const applyAuth = useCallback(
    async (data: ApiAuthOut) => {
      setToken(data.access_token);
      await loadBillingFor();
      setUser(toUser(data.user));
      setCompany(toCompany(data.user));
    },
    [loadBillingFor],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.post<{ access_token?: string }>("/auth/login", {
        username_or_email_or_phone: email.trim().toLowerCase(),
        password,
      });
      if (!data.access_token) return "Could not log in. Please try again.";
      setToken(data.access_token);
      const session = await api.get<ApiUser>("/auth/session");
      await loadBillingFor();
      setUser(toUser(session));
      setCompany(toCompany(session));
      return null;
    } catch (err) {
      return apiErrorMessage(err, "Could not log in. Please try again.");
    }
  }, [loadBillingFor]);

  const signUpIndividual = useCallback(
    async (fullName: string, email: string, password: string) => {
      try {
        const data = await api.post<ApiAuthOut>("/auth/register/individual", {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
        await applyAuth(data);
        return null;
      } catch (err) {
        return apiErrorMessage(err, "Could not create your account. Please try again.");
      }
    },
    [applyAuth],
  );

  const signUpCompany = useCallback(
    async (fullName: string, email: string, password: string, companyName: string) => {
      try {
        const data = await api.post<ApiAuthOut>("/auth/register/company", {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          company_name: companyName.trim(),
        });
        await applyAuth(data);
        return null;
      } catch (err) {
        return apiErrorMessage(err, "Could not create your company account. Please try again.");
      }
    },
    [applyAuth],
  );

  const signUpEmployee = useCallback(
    async (fullName: string, email: string, password: string, inviteCode: string) => {
      try {
        const data = await api.post<ApiAuthOut>("/auth/register/employee", {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          invite_code: inviteCode.trim(),
        });
        await applyAuth(data);
        return null;
      } catch (err) {
        return apiErrorMessage(err, "Could not join the company. Please try again.");
      }
    },
    [applyAuth],
  );

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    setCompany(null);
    // Clear the entitlement too, or the next person to sign in on this browser
    // inherits the last one's access for as long as it takes to re-read.
    setBilling(null);
    setBillingLoading(false);
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      await api.del("/auth/account");
    } finally {
      setToken(null);
      setUser(null);
      setCompany(null);
      setBilling(null);
      setBillingLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      company,
      loading,
      billing,
      billingLoading,
      refreshBilling,
      syncBilling,
      signIn,
      signUpIndividual,
      signUpCompany,
      signUpEmployee,
      signOut,
      deleteAccount,
    }),
    [user, company, loading, billing, billingLoading, refreshBilling, syncBilling, signIn, signUpIndividual, signUpCompany, signUpEmployee, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
