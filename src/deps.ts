import { exec } from "./shell.ts";

export interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  fix?: string;
  fixAuto?: boolean;
  version?: string;
}

export async function checkCommand(
  cmd: string,
  versionFlag = "--version",
): Promise<{ found: boolean; version?: string }> {
  try {
    const whichResult = await exec(["which", cmd]);
    if (whichResult.exitCode !== 0) return { found: false };

    const result = await exec([cmd, versionFlag]);
    // Version might be on stdout or stderr (git uses stdout, gh uses stdout)
    const raw = (result.stdout + result.stderr).trim();
    // Extract version-looking string
    const match = raw.match(/(\d+\.\d+[\.\d]*)/);
    return { found: true, version: match?.[1] };
  } catch {
    return { found: false };
  }
}

export async function checkGhAuth(): Promise<{
  authenticated: boolean;
  user?: string;
}> {
  try {
    const result = await exec(["gh", "auth", "status"]);
    if (result.exitCode !== 0) return { authenticated: false };
    const output = result.stdout + result.stderr;
    const match = output.match(/Logged in to \S+ account (\S+)/) ??
      output.match(/Logged in to .+ as (\S+)/);
    return { authenticated: true, user: match?.[1] };
  } catch {
    return { authenticated: false };
  }
}

export async function checkGitRepo(): Promise<{
  inRepo: boolean;
  root?: string;
}> {
  try {
    const result = await exec(["git", "rev-parse", "--show-toplevel"]);
    if (result.exitCode !== 0) return { inRepo: false };
    return { inRepo: true, root: result.stdout };
  } catch {
    return { inRepo: false };
  }
}

export async function checkWorkflow(gitRoot: string): Promise<boolean> {
  const file = Bun.file(`${gitRoot}/.github/workflows/loop.yml`);
  return file.exists();
}

export async function checkSecret(
  name: string,
): Promise<"found" | "not_found" | "unknown"> {
  try {
    const result = await exec(["gh", "secret", "list"]);
    if (result.exitCode !== 0) return "unknown";
    // gh secret list outputs lines like "SECRET_NAME\tUpdated 2024-01-01"
    const names = result.stdout
      .split("\n")
      .map((l) => l.split("\t")[0]?.trim())
      .filter(Boolean);
    return names.includes(name) ? "found" : "not_found";
  } catch {
    return "unknown";
  }
}
