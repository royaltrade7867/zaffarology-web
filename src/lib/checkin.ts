/**
 * The workshop check-in portal client.
 *
 * Three of these calls carry a signed token in the path and NO bearer token:
 * they are opened straight from a reminder email, by someone who may never
 * have signed in. `api.get` sends the Authorization header when one happens to
 * be stored, which is harmless here because the backend ignores it on these
 * routes and trusts only the signature in the URL.
 */

import { api } from "./api";

/** One day's entry. `editable` closes at the end of that Brisbane day. */
export interface CheckinEntry {
  date: string;
  slot: string;
  plan: string;
  achievement: string;
  editable: boolean;
  submitted_at: string | null;
  updated_at: string | null;
}

export interface CheckinForm extends CheckinEntry {
  /** First name, for the greeting. Empty when we do not have one. */
  name: string;
  /** False for someone imported who has not set a password yet. */
  can_sign_in: boolean;
}

export interface CheckinHistory {
  in_cohort: boolean;
  opted_out: boolean;
  entries: CheckinEntry[];
}

/** What the invite link says about itself before a password is typed. */
export interface InviteStatus {
  valid: boolean;
  /** "invalid" for a bad or expired link, "already_set" when a password exists. */
  reason: string;
  name: string;
  email?: string;
}

export const openCheckin = (token: string) =>
  api.get<CheckinForm>(`/checkin/token/${encodeURIComponent(token)}`);

export const saveCheckin = (token: string, plan: string, achievement: string) =>
  api.put<CheckinEntry>(`/checkin/token/${encodeURIComponent(token)}`, {
    plan,
    achievement,
  });

export const unsubscribeReminders = (token: string) =>
  api.get<{ message: string }>(`/checkin/unsubscribe/${encodeURIComponent(token)}`);

export const myCheckinHistory = () => api.get<CheckinHistory>("/checkin/history");

export const inviteStatus = (token: string) =>
  api.get<InviteStatus>(`/auth/set-password/${encodeURIComponent(token)}`);

/** Sets a first password, verifies the address, and returns a session. */
export const setPasswordFromInvite = (token: string, newPassword: string) =>
  api.post<{ access_token: string; user: unknown }>(
    `/auth/set-password/${encodeURIComponent(token)}`,
    { new_password: newPassword },
  );

/**
 * "Monday 29 September" in Australian form, from a plain ISO date.
 *
 * Built with an explicit midnight so the string is parsed as LOCAL time. A
 * bare "2026-09-28" is parsed as UTC, which in Brisbane renders the day before.
 */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
