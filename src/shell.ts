export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function exec(cmd: string[]): Promise<ExecResult> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

export async function execOrFail(cmd: string[]): Promise<string> {
  const result = await exec(cmd);
  if (result.exitCode !== 0) {
    throw new Error(
      `${cmd.join(" ")} failed (exit ${result.exitCode}): ${result.stderr}`,
    );
  }
  return result.stdout;
}

export async function which(cmd: string): Promise<boolean> {
  const result = await exec(["which", cmd]);
  return result.exitCode === 0;
}
