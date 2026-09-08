/**
 * Zaffarology backend client (same backend the mobile app uses).
 * JWT is kept in localStorage and sent as `Authorization: Bearer`.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "zaff_token";

let cachedToken: string | null = null;

export function setToken(token: string | null): void {
  cachedToken = token;
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function loadToken(): string | null {
  if (cachedToken) return cachedToken;
  if (typeof window !== "undefined") cachedToken = window.localStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = loadToken();
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = (data && data.detail) || res.statusText || "Request failed";
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Request failed");
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  /** Partial update. The notes/meetings endpoints treat an absent field as
   *  untouched, so only what actually changed is sent. */
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.detail) return err.detail;
  return fallback;
}

// ---------- backend response shapes ----------
export interface ApiCompany {
  id: number;
  name: string;
  invite_code: string;
}
export interface ApiUser {
  id: number;
  email: string;
  full_name: string | null;
  role: "individual" | "employee" | "company_admin";
  is_verified?: boolean;
  company: ApiCompany | null;
}
export interface ApiAuthOut {
  access_token: string;
  token_type: string;
  user: ApiUser;
}
export interface ApiTeamMember {
  id: number;
  full_name: string | null;
  email: string;
  role: string;
  per_pillar: Record<string, number>;
  overall: number;
}
export interface ApiTeamOut {
  company: ApiCompany;
  members: ApiTeamMember[];
}
