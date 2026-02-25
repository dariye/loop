import { execOrFail } from "./shell.ts";

export interface Issue {
  id: string;
  title: string;
  body: string;
  status: string;
  labels: string[];
  parent?: string;
}

export interface Comment {
  id: string;
  body: string;
  author: string;
  created: string;
}

/** Fetch a single issue by ID. */
export async function show(id: string): Promise<Issue> {
  const raw = await execOrFail(["bd", "show", id, "--json"]);
  return JSON.parse(raw) as Issue;
}

/** Fetch comments for an issue. */
export async function comments(id: string): Promise<Comment[]> {
  const raw = await execOrFail(["bd", "comments", id, "--json"]);
  return JSON.parse(raw) as Comment[];
}

/** List issues, optionally filtering by parent or status. */
export async function list(opts?: {
  parent?: string;
  status?: string;
}): Promise<Issue[]> {
  const args = ["bd", "list", "--json"];
  if (opts?.parent) {
    args.push("--parent", opts.parent);
  }
  if (opts?.status) {
    args.push("--status", opts.status);
  }
  const raw = await execOrFail(args);
  return JSON.parse(raw) as Issue[];
}

/** Add labels to an issue. */
export async function label(id: string, labels: string[]): Promise<void> {
  await execOrFail(["bd", "label", id, ...labels]);
}

/** Update arbitrary fields on an issue. */
export async function update(
  id: string,
  fields: Record<string, string>
): Promise<void> {
  const args = ["bd", "update", id];
  for (const [key, value] of Object.entries(fields)) {
    args.push(`--${key}`, value);
  }
  await execOrFail(args);
}
