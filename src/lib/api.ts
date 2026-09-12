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

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  /** Let the request outlive the page. A normal `fetch` started from a
   *  `beforeunload`/`pagehide` handler is CANCELLED when the document is torn
   *  down, so a save flushed as the tab closes never reaches the server.
   *  `keepalive` is the only thing that survives it. Capped at 64KB by the
   *  spec, which is why it is opt-in rather than the default. */
  keepalive = false,
): Promise<T> {
  const token = loadToken();
  let res: Response;
  try {
    // FormData must go up as-is: JSON.stringify would turn it into
    // "[object Object]", and setting Content-Type by hand would omit the
    // multipart boundary the browser generates. Let fetch do both.
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    res = await fetch(BASE_URL + path, {
      method,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      keepalive,
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

/** Fetch a binary response (audio, a download) rather than JSON. Separate from
 *  `request` because that one always parses the body as JSON. */
export async function requestBlob(path: string): Promise<Blob> {
  const token = loadToken();
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText || "Request failed");
  }
  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  /** Partial update. The notes/meetings endpoints treat an absent field as
   *  untouched, so only what actually changed is sent. */
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  /** Multipart upload — pass a FormData body. */
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
  /** PATCH that survives the page being torn down. Only for a save flushed
   *  from an unload handler — see `keepalive` above. */
  patchBeacon: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body, true),
  /** PUT that survives the page being torn down — the pillar blob flushed on
   *  unmount. Same rules as `patchBeacon`. */
  putBeacon: <T>(path: string, body?: unknown) => request<T>("PUT", path, body, true),
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
