import { mock, afterEach } from "bun:test";
import type { ExecResult } from "../../src/shell.ts";

type CmdMatcher = string[] | ((cmd: string[]) => boolean);

interface Expectation {
  match: CmdMatcher;
  result: ExecResult;
}

const queue: Expectation[] = [];

/**
 * Register an expected command and its result.
 * Commands are consumed on first match (removed from queue).
 */
export function expectCommand(
  match: CmdMatcher,
  result: Partial<ExecResult> = {},
) {
  queue.push({
    match,
    result: { stdout: "", stderr: "", exitCode: 0, ...result },
  });
}

/** Clear all pending expectations. */
export function resetMockShell() {
  queue.length = 0;
}

/** Return count of unconsumed expectations. */
export function pendingCount(): number {
  return queue.length;
}

function consume(cmd: string[]): ExecResult {
  const idx = queue.findIndex((e) => {
    if (typeof e.match === "function") return e.match(cmd);
    if (e.match.length !== cmd.length) return false;
    return e.match.every((s, i) => s === cmd[i]);
  });
  if (idx === -1) {
    throw new Error(
      `Unexpected shell command: ${JSON.stringify(cmd)}\nPending expectations: ${queue.map((e) => JSON.stringify(e.match)).join(", ") || "(none)"}`,
    );
  }
  return queue.splice(idx, 1)[0].result;
}

mock.module("../../src/shell.ts", () => ({
  exec: async (cmd: string[]): Promise<ExecResult> => consume(cmd),
  execOrFail: async (cmd: string[]): Promise<string> => {
    const r = consume(cmd);
    if (r.exitCode !== 0) {
      throw new Error(
        `${cmd.join(" ")} failed (exit ${r.exitCode}): ${r.stderr}`,
      );
    }
    return r.stdout;
  },
  which: async (cmd: string): Promise<boolean> => {
    const r = consume(["which", cmd]);
    return r.exitCode === 0;
  },
}));
