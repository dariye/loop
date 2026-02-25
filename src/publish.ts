import { execOrFail } from "./shell.ts";
import { show, label } from "./beads.ts";

/**
 * Extract the GitHub issue number from a `gh:N` label.
 * Returns undefined if no such label exists.
 */
export function findGhLabel(labels: string[]): number | undefined {
  for (const l of labels) {
    const match = l.match(/^gh:(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * Extract the epic ID from an `epic:X` label.
 */
export function findEpicLabel(labels: string[]): string | undefined {
  for (const l of labels) {
    const match = l.match(/^epic:(.+)$/);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Publish a beads issue to GitHub Issues.
 * Creates a new GitHub issue or updates an existing one.
 * Returns the GitHub issue number.
 */
export async function publish(issueId: string): Promise<number> {
  const issue = await show(issueId);

  // Build the issue body, optionally including epic context
  let body = issue.body;
  const epicId = findEpicLabel(issue.labels);
  if (epicId) {
    try {
      const epic = await show(epicId);
      body = `## Epic: ${epic.title}\n\n${epic.body}\n\n---\n\n${body}`;
    } catch {
      // Epic not found — proceed without it
    }
  }

  const existingNumber = findGhLabel(issue.labels);

  if (existingNumber) {
    // Update existing GitHub issue
    await execOrFail([
      "gh",
      "issue",
      "edit",
      String(existingNumber),
      "--title",
      issue.title,
      "--body",
      body,
    ]);
    console.log(`Updated GitHub issue #${existingNumber}`);
    return existingNumber;
  }

  // Create new GitHub issue
  const result = await execOrFail([
    "gh",
    "issue",
    "create",
    "--title",
    issue.title,
    "--body",
    body,
    "--json",
    "number",
  ]);
  const { number: ghNumber } = JSON.parse(result) as { number: number };

  // Tag the beads issue with the GitHub number
  await label(issueId, [`gh:${ghNumber}`]);
  console.log(`Created GitHub issue #${ghNumber}`);
  return ghNumber;
}

/**
 * Sync GitHub issue state back into the beads issue.
 * Pulls labels from the GitHub issue and applies them to beads.
 */
export async function syncBack(
  issueId: string,
  ghIssueNumber: number
): Promise<void> {
  const raw = await execOrFail([
    "gh",
    "issue",
    "view",
    String(ghIssueNumber),
    "--json",
    "labels",
  ]);
  const { labels: ghLabels } = JSON.parse(raw) as {
    labels: { name: string }[];
  };

  const labelNames = ghLabels.map((l) => l.name);
  if (labelNames.length > 0) {
    await label(issueId, labelNames);
  }
  console.log(
    `Synced ${labelNames.length} label(s) from GitHub #${ghIssueNumber} to ${issueId}`
  );
}
