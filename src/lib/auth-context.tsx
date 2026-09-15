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
  signIn: (email: string, password: string) => Promise<string | null>;
  signUpIndividual: (fullName: string, email: string, password: string) => Promise<string | null>;
  signUpCompany: (fullName: string, email: string, password: string, companyName: string) => Promise<string | null>;
  signUpEmployee: (fullName: string, email: string, password: string, inviteCode: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  verifyEmail: (code: string) => Promise<string | null>;
  resendVerification: () => Promise<void>;
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

  const applyAuth = useCallback((data: ApiAuthOut) => {
    setToken(data.access_token);
    setUser(toUser(data.user));
    setCompany(toCompany(data.user));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const data = await api.post<{ access_token?: string }>("/auth/login", {
        username_or_email_or_phone: email.trim().toLowerCase(),
        password,
      });
      if (!data.access_token) return "Could not log in. Please try again.";
      setToken(data.access_token);
      const session = await api.get<ApiUser>("/auth/session");
      setUser(toUser(session));
      setCompany(toCompany(session));
      return null;
    } catch (err) {
      return apiErrorMessage(err, "Could not log in. Please try again.");
    }
  }, []);

  const signUpIndividual = useCallback(
    async (fullName: string, email: string, password: string) => {
      try {
        const data = await api.post<ApiAuthOut>("/auth/register/individual", {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
        applyAuth(data);
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
        applyAuth(data);
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
        applyAuth(data);
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

  const verifyEmail = useCallback(
    async (code: string) => {
      if (!user) return "Please sign in again.";
      try {
        await api.post("/auth/verify-email", { email: user.email, code: code.trim() });
        const session = await api.get<ApiUser>("/auth/session");
        setUser(toUser(session));
        setCompany(toCompany(session));
        return null;
      } catch (err) {
        return apiErrorMessage(err, "Invalid or expired code. Please try again.");
      }
    },
    [user],
  );

  const resendVerification = useCallback(async () => {
    if (!user) return;
    try {
      await api.post("/auth/verify-email/resend", { email: user.email });
    } catch {
      /* silent */
    }
  }, [user]);

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
      signIn,
      signUpIndividual,
      signUpCompany,
      signUpEmployee,
      signOut,
      deleteAccount,
      verifyEmail,
      resendVerification,
    }),
    [user, company, loading, billing, billingLoading, refreshBilling, signIn, signUpIndividual, signUpCompany, signUpEmployee, signOut, deleteAccount, verifyEmail, resendVerification],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
