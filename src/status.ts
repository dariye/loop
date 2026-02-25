import { exec } from "./shell.ts";

// ANSI color helpers
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

interface Run {
  databaseId: number;
  displayTitle: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
}

interface GhIssue {
  number: number;
  title: string;
  labels: { name: string }[];
}

interface GhPR {
  number: number;
  title: string;
  state: string;
  headRefName: string;
}

async function ghExec(args: string[]): Promise<string> {
  const result = await exec(["gh", ...args]);
  if (result.exitCode !== 0) {
    return "[]"; // Return empty array on failure so status degrades gracefully
  }
  return result.stdout;
}

export function formatStatus(status: string, conclusion: string | null): string {
  if (status === "completed") {
    if (conclusion === "success")
      return `${c.green}pass${c.reset}`;
    if (conclusion === "failure")
      return `${c.red}fail${c.reset}`;
    return `${c.yellow}${conclusion ?? "unknown"}${c.reset}`;
  }
  if (status === "in_progress")
    return `${c.cyan}running${c.reset}`;
  if (status === "queued")
    return `${c.dim}queued${c.reset}`;
  return `${c.dim}${status}${c.reset}`;
}

export function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Print a terminal status report of recent loop activity.
 */
export async function status(): Promise<void> {
  // Fetch all data concurrently
  const [runsRaw, issuesDesignedRaw, issuesBuiltRaw, prsRaw] =
    await Promise.all([
      ghExec([
        "run",
        "list",
        "--workflow=loop.yml",
        "--limit=5",
        "--json",
        "status,conclusion,displayTitle,databaseId,createdAt",
      ]),
      ghExec([
        "issue",
        "list",
        "--label",
        "loop:designed",
        "--json",
        "number,title,labels",
      ]),
      ghExec([
        "issue",
        "list",
        "--label",
        "loop:built",
        "--json",
        "number,title,labels",
      ]),
      ghExec([
        "pr",
        "list",
        "--head",
        "loop/",
        "--json",
        "number,title,state,headRefName",
      ]),
    ]);

  const runs = JSON.parse(runsRaw) as Run[];
  const issuesDesigned = JSON.parse(issuesDesignedRaw) as GhIssue[];
  const issuesBuilt = JSON.parse(issuesBuiltRaw) as GhIssue[];
  const prs = JSON.parse(prsRaw) as GhPR[];

  // --- Workflow Runs ---
  console.log(`${c.bold}${c.white}Workflow Runs${c.reset}`);
  if (runs.length === 0) {
    console.log(`  ${c.dim}No recent runs${c.reset}`);
  } else {
    for (const run of runs) {
      const st = formatStatus(run.status, run.conclusion);
      const age = formatAge(run.createdAt);
      console.log(
        `  ${st}  ${c.bold}#${run.databaseId}${c.reset}  ${run.displayTitle}  ${c.dim}${age}${c.reset}`
      );
    }
  }
  console.log();

  // --- Issues ---
  const allIssues = [...issuesDesigned, ...issuesBuilt];
  // Deduplicate by number
  const seen = new Set<number>();
  const issues = allIssues.filter((i) => {
    if (seen.has(i.number)) return false;
    seen.add(i.number);
    return true;
  });

  console.log(`${c.bold}${c.white}Loop Issues${c.reset}`);
  if (issues.length === 0) {
    console.log(`  ${c.dim}No tagged issues${c.reset}`);
  } else {
    for (const issue of issues) {
      const tags = issue.labels
        .filter((l) => l.name.startsWith("loop:"))
        .map((l) => `${c.magenta}${l.name}${c.reset}`)
        .join(" ");
      console.log(
        `  ${c.cyan}#${issue.number}${c.reset}  ${issue.title}  ${tags}`
      );
    }
  }
  console.log();

  // --- Pull Requests ---
  console.log(`${c.bold}${c.white}Loop PRs${c.reset}`);
  if (prs.length === 0) {
    console.log(`  ${c.dim}No open loop PRs${c.reset}`);
  } else {
    for (const pr of prs) {
      const branch = `${c.dim}${pr.headRefName}${c.reset}`;
      console.log(
        `  ${c.green}#${pr.number}${c.reset}  ${pr.title}  ${branch}`
      );
    }
  }
}
