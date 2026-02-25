import { execOrFail } from "./shell.ts";

export interface DispatchOpts {
  disc: "design" | "build" | "review" | "fix";
  issue?: string;
  pr?: string;
  chain?: boolean;
  model?: string;
  budget?: string;
}

/**
 * Dispatch a loop workflow run on GitHub Actions.
 * Returns the run ID of the triggered workflow.
 */
export async function dispatch(opts: DispatchOpts): Promise<string> {
  const { disc, issue, pr, chain, model, budget } = opts;

  // Validate required arguments per phase
  if ((disc === "design" || disc === "build") && !issue) {
    throw new Error(`"${disc}" phase requires an issue number\n  Try: loop ${disc} LOOP-1`);
  }
  if ((disc === "review" || disc === "fix") && !pr) {
    throw new Error(`"${disc}" phase requires a PR number\n  Try: loop ${disc} 17`);
  }

  // Build the workflow dispatch command
  const args = [
    "gh",
    "workflow",
    "run",
    "loop.yml",
    "-f",
    `disc=${disc}`,
  ];

  if (issue) {
    args.push("-f", `issue=${issue}`);
  }
  if (pr) {
    args.push("-f", `pr=${pr}`);
  }
  if (chain) {
    args.push("-f", "chain=true");
  }
  if (model) {
    args.push("-f", `model=${model}`);
  }
  if (budget) {
    args.push("-f", `budget=${budget}`);
  }

  await execOrFail(args);
  console.log(`Dispatched ${disc} workflow`);

  // Brief pause to let GitHub register the run
  await Bun.sleep(2000);

  // Fetch the most recent run ID for this workflow
  const raw = await execOrFail([
    "gh",
    "run",
    "list",
    "--workflow=loop.yml",
    "--limit=1",
    "--json",
    "databaseId",
  ]);
  const runs = JSON.parse(raw) as { databaseId: number }[];
  if (runs.length === 0) {
    throw new Error("Could not find the dispatched workflow run\n  Try: gh run list --workflow=loop.yml");
  }

  const runId = String(runs[0].databaseId);
  console.log(`Workflow run ID: ${runId}`);
  return runId;
}
