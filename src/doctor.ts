import {
  checkCommand,
  checkGhAuth,
  checkGitRepo,
  checkWorkflow,
  checkSecret,
  type CheckResult,
} from "./deps.ts";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function icon(status: CheckResult["status"]): string {
  switch (status) {
    case "pass":
      return `${GREEN}✓${RESET}`;
    case "fail":
      return `${RED}✗${RESET}`;
    case "warn":
      return `${YELLOW}⚠${RESET}`;
  }
}

function printResult(r: CheckResult): void {
  const name = r.name.padEnd(16);
  console.log(`  ${icon(r.status)} ${name}${r.message}`);
  if (r.fix && r.status !== "pass") {
    const prefix = r.fixAuto ? "fix" : "run";
    console.log(`${" ".repeat(21)}${DIM}→ ${prefix}: ${r.fix}${RESET}`);
  }
}

async function runFix(result: CheckResult): Promise<boolean> {
  if (!result.fix || !result.fixAuto) return false;

  const { exec } = await import("./shell.ts");
  const parts = result.fix.split(" ");
  const { exitCode } = await exec(parts);
  return exitCode === 0;
}

export async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. git
  const git = await checkCommand("git");
  results.push({
    name: "git",
    status: git.found ? "pass" : "fail",
    message: git.found ? (git.version ?? "installed") : "not found",
    fix: "https://git-scm.com/downloads",
    fixAuto: false,
    version: git.version,
  });

  // 2. git repo
  const repo = await checkGitRepo();
  results.push({
    name: "git repo",
    status: repo.inRepo ? "pass" : "fail",
    message: repo.inRepo ? (repo.root ?? "yes") : "not inside a git repository",
    fix: "git init",
    fixAuto: false,
  });

  // 3. gh
  const gh = await checkCommand("gh");
  results.push({
    name: "gh",
    status: gh.found ? "pass" : "fail",
    message: gh.found ? (gh.version ?? "installed") : "not found",
    fix: process.platform === "darwin" ? "brew install gh" : "https://cli.github.com",
    fixAuto: process.platform === "darwin",
    version: gh.version,
  });

  // 4. gh auth
  if (gh.found) {
    const auth = await checkGhAuth();
    results.push({
      name: "gh auth",
      status: auth.authenticated ? "pass" : "fail",
      message: auth.authenticated
        ? `logged in as ${auth.user}`
        : "not authenticated",
      fix: "gh auth login",
      fixAuto: false,
    });
  } else {
    results.push({
      name: "gh auth",
      status: "fail",
      message: "skipped (gh not installed)",
    });
  }

  // 5. bd
  const bd = await checkCommand("bd");
  results.push({
    name: "bd",
    status: bd.found ? "pass" : "fail",
    message: bd.found ? (bd.version ?? "installed") : "not found",
    fix: "npm install -g @beads/bd",
    fixAuto: true,
    version: bd.version,
  });

  // 6. bun
  const bun = await checkCommand("bun");
  results.push({
    name: "bun",
    status: bun.found ? "pass" : "fail",
    message: bun.found ? (bun.version ?? "installed") : "not found",
    fix: "curl -fsSL https://bun.sh/install | bash",
    fixAuto: true,
    version: bun.version,
  });

  // 7. workflow
  if (repo.inRepo && repo.root) {
    const hasWorkflow = await checkWorkflow(repo.root);
    results.push({
      name: "workflow",
      status: hasWorkflow ? "pass" : "fail",
      message: hasWorkflow
        ? ".github/workflows/loop.yml"
        : ".github/workflows/loop.yml not found",
      fix: "loop install",
      fixAuto: true,
    });
  } else {
    results.push({
      name: "workflow",
      status: "fail",
      message: "skipped (not in a git repo)",
    });
  }

  // 8. ANTHROPIC_API_KEY
  if (gh.found) {
    const apiKey = await checkSecret("ANTHROPIC_API_KEY");
    if (apiKey === "found") {
      results.push({
        name: "API key",
        status: "pass",
        message: "ANTHROPIC_API_KEY configured",
      });
    } else if (process.env.ANTHROPIC_API_KEY) {
      results.push({
        name: "API key",
        status: "pass",
        message: "ANTHROPIC_API_KEY set in environment",
      });
    } else {
      results.push({
        name: "API key",
        status: "fail",
        message: "ANTHROPIC_API_KEY not found",
        fix: "gh secret set ANTHROPIC_API_KEY",
        fixAuto: false,
      });
    }
  } else {
    if (process.env.ANTHROPIC_API_KEY) {
      results.push({
        name: "API key",
        status: "pass",
        message: "ANTHROPIC_API_KEY set in environment",
      });
    } else {
      results.push({
        name: "API key",
        status: "fail",
        message: "ANTHROPIC_API_KEY not found",
        fix: "gh secret set ANTHROPIC_API_KEY",
        fixAuto: false,
      });
    }
  }

  // 9. LOOP_PAT (optional)
  if (gh.found) {
    const pat = await checkSecret("LOOP_PAT");
    results.push({
      name: "LOOP_PAT",
      status: pat === "found" ? "pass" : "warn",
      message:
        pat === "found"
          ? "configured"
          : "not detected (chaining disabled)",
      fix: "gh secret set LOOP_PAT",
      fixAuto: false,
    });
  } else {
    results.push({
      name: "LOOP_PAT",
      status: "warn",
      message: "skipped (gh not installed)",
      fix: "gh secret set LOOP_PAT",
      fixAuto: false,
    });
  }

  return results;
}

export async function doctor(fix = false): Promise<void> {
  console.log(`\n${BOLD}Loop Doctor${RESET}\n`);

  const results = await runChecks();

  if (fix) {
    // Run auto-fixes for failed items, then re-check
    let fixed = 0;
    for (const r of results) {
      if (r.status === "fail" && r.fixAuto && r.fix) {
        process.stdout.write(`  Fixing ${r.name}... `);
        const ok = await runFix(r);
        if (ok) {
          console.log(`${GREEN}done${RESET}`);
          fixed++;
        } else {
          console.log(`${RED}failed${RESET}`);
        }
      }
    }
    if (fixed > 0) {
      console.log();
      // Re-run checks after fixes
      const updated = await runChecks();
      for (const r of updated) {
        printResult(r);
      }
      const pass = updated.filter((r) => r.status === "pass").length;
      const fail = updated.filter((r) => r.status === "fail").length;
      const warn = updated.filter((r) => r.status === "warn").length;
      console.log(
        `\n${pass}/${updated.length} passed${fail ? `, ${fail} failed` : ""}${warn ? `, ${warn} warning${warn > 1 ? "s" : ""}` : ""}\n`,
      );
      if (fail > 0) process.exit(1);
      return;
    }
  }

  for (const r of results) {
    printResult(r);
  }

  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const warn = results.filter((r) => r.status === "warn").length;
  console.log(
    `\n${pass}/${results.length} passed${fail ? `, ${fail} failed` : ""}${warn ? `, ${warn} warning${warn > 1 ? "s" : ""}` : ""}\n`,
  );

  if (fail > 0) process.exit(1);
}
