/**
 * Connections and task assignment.
 *
 * Assigned tasks deliberately do NOT live in the pillar blobs. `/v3/pillars/{key}`
 * is an unversioned whole-blob replace and `usePillarState` lets an unsynced local
 * cache win, so a task written into someone else's blob could be silently deleted
 * by a routine offline edit on their phone. These endpoints are the only home for
 * them.
 *
 * Mirrors `zaffarology-mobileapp/src/lib/connections-api.ts` — same backend rows,
 * same account. Only the transport differs.
 */
import { api } from "@/lib/api";

export type ConnectionStatus = "pending" | "accepted" | "blocked";
export type ConnectionDirection = "incoming" | "outgoing";

export interface ApiConnection {
  id: number;
  /** null while an invite to an address with no account is still outstanding. */
  user_id: number | null;
  full_name: string | null;
  email: string;
  status: ConnectionStatus;
  direction: ConnectionDirection;
}

export interface ApiIncomingAssignment {
  id: number;
  title: string;
  due: string;
  status: "open" | "completed";
  from_user_id: number;
  from_name: string;
  created_at: string | null;
}

export interface ApiOutgoingAssignment {
  id: number;
  source_task_id: string;
  source_pillar_key: string;
  assignee_user_id: number;
  assignee_name: string;
  title: string;
  status: "open" | "completed";
  completed_at: string | null;
}

/** Everyone I'm connected to, plus invites in both directions. */
export async function loadConnections(): Promise<ApiConnection[]> {
  const data = await api.get<{ connections: ApiConnection[] }>("/connections");
  return data?.connections ?? [];
}

/**
 * Invite an address to connect.
 *
 * Always resolves with the same message whether or not the address has an
 * account — otherwise this would be a way to discover who is a Zaffarology user.
 * Callers must NOT try to infer the outcome from the reply, or vary what they
 * show based on it.
 */
export async function inviteConnection(email: string): Promise<string> {
  const data = await api.post<{ message: string }>("/connections/invite", { email });
  return data?.message ?? "";
}

export async function acceptConnection(id: number): Promise<void> {
  await api.post(`/connections/${id}/accept`);
}

/** Declines a pending invite, or disconnects an accepted one. */
export async function removeConnection(id: number): Promise<void> {
  await api.del(`/connections/${id}`);
}

export async function blockConnection(id: number): Promise<void> {
  await api.post(`/connections/${id}/block`);
}

/** Tasks assigned TO me — the read-only overlay on my own board. */
export async function loadIncomingAssignments(): Promise<ApiIncomingAssignment[]> {
  const data = await api.get<{ assignments: ApiIncomingAssignment[] }>(
    "/connections/assignments/to-me",
  );
  return data?.assignments ?? [];
}

/** Status of tasks I assigned, so my own item can show a badge. */
export async function loadOutgoingAssignments(
  pillarKey?: string,
): Promise<ApiOutgoingAssignment[]> {
  const q = pillarKey ? `?pillar_key=${encodeURIComponent(pillarKey)}` : "";
  const data = await api.get<{ assignments: ApiOutgoingAssignment[] }>(
    `/connections/assignments/by-me${q}`,
  );
  return data?.assignments ?? [];
}

export async function assignTask(input: {
  assigneeUserId: number;
  pillarKey: string;
  taskId: string;
  title: string;
  due?: string;
  /** Whether to email them. False still assigns — it just stays quiet. */
  notify?: boolean;
}): Promise<{ id: number }> {
  const data = await api.post<{ id: number; status: string }>("/connections/assignments", {
    assignee_user_id: input.assigneeUserId,
    source_pillar_key: input.pillarKey,
    source_task_id: input.taskId,
    title: input.title,
    due: input.due ?? "",
    notify: input.notify ?? true,
  });
  return { id: data.id };
}

/** Assignee only. */
export async function setAssignmentDone(id: number, done: boolean): Promise<void> {
  await api.post(`/connections/assignments/${id}/${done ? "complete" : "reopen"}`);
}

/** Assigner only — unassign. */
export async function unassignTask(id: number): Promise<void> {
  await api.del(`/connections/assignments/${id}`);
}
