/**
 * Share a note or meeting — by email through the backend, or by handing the
 * text to WhatsApp.
 *
 * Recipients do NOT have to be connections: sharing is sending a copy, not
 * granting access to anything, so any email address can receive one.
 *
 * Voice notes are never included. A recording is a file in the database, and
 * the share endpoint sends text only — so a shared meeting carries what was
 * written, never what was said.
 */
import { api } from "@/lib/api";
import type { ApiMeeting } from "@/lib/notes-api";

/** Matches `MAX_RECIPIENTS` on the server. */
export const MAX_SHARE_RECIPIENTS = 10;

export async function shareByEmail(input: {
  title: string;
  body: string;
  message?: string;
  emails: string[];
}): Promise<void> {
  await api.post("/notes/share", {
    title: input.title,
    body: input.body,
    message: input.message ?? "",
    emails: input.emails,
  });
}

/**
 * A meeting as plain text. Byte-identical in shape to the phone's
 * `meetingAsText`, so the same meeting shared from either app reads the same.
 *
 * Empty sections are dropped rather than printed as blank headings.
 */
export function meetingAsText(m: ApiMeeting): string {
  const L: string[] = [];
  const when = [m.date, m.time].filter(Boolean).join(" at ");
  if (when) L.push(`When: ${when}`);
  if (m.place.trim()) L.push(`Where: ${m.place}`);
  if (m.attendees.trim()) L.push(`Who: ${m.attendees}`);
  if (m.agenda.trim()) L.push("", "AGENDA", m.agenda);
  if (m.notes.trim()) L.push("", "NOTES", m.notes);
  if (m.decisions.trim()) L.push("", "DECISIONS", m.decisions);
  if (m.next_steps.trim()) L.push("", "NEXT STEPS", m.next_steps);
  return L.join("\n");
}

/**
 * A WhatsApp link carrying the text.
 *
 * `wa.me` with no number opens the contact picker, which is what "share" means
 * here — the user chooses who, in WhatsApp, rather than typing a phone number
 * into this app. Nothing is sent until they press send there.
 */
export function whatsAppLink(title: string, body: string): string {
  const text = title.trim() ? `*${title.trim()}*\n\n${body}` : body;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
