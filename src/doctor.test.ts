import { describe, test, expect, beforeEach, spyOn, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  expectCommand,
  resetMockShell,
} from "../test/helpers/mock-shell.ts";
import { runChecks, doctor } from "./doctor.ts";

let logSpy: ReturnType<typeof spyOn>;
let exitSpy: ReturnType<typeof spyOn>;
let tmpDir: string;

beforeEach(() => {
  resetMockShell();
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);

  // Create a temp dir with the workflow file for checkWorkflow
  tmpDir = mkdtempSync(join(tmpdir(), "loop-test-"));
  mkdirSync(join(tmpDir, ".github", "workflows"), { recursive: true });
  writeFileSync(join(tmpDir, ".github", "workflows", "loop.yml"), "name: loop");
});

afterEach(() => {
  logSpy.mockRestore();
  exitSpy.mockRestore();
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Set up mock expectations for all commands that runChecks invokes. */
function expectAllPass() {
  // git
  expectCommand(["which", "git"], { stdout: "/usr/bin/git" });
  expectCommand(["git", "--version"], { stdout: "git version 2.39.3" });
  // git repo — use real temp dir so checkWorkflow finds the file
  expectCommand(["git", "rev-parse", "--show-toplevel"], {
    stdout: tmpDir,
  });
  // gh
  expectCommand(["which", "gh"], { stdout: "/usr/bin/gh" });
  expectCommand(["gh", "--version"], { stdout: "gh version 2.44.0" });
  // gh auth
  expectCommand(["gh", "auth", "status"], {
    stdout: "Logged in to github.com account testuser (keyring)",
  });
  // bd
  expectCommand(["which", "bd"], { stdout: "/usr/bin/bd" });
  expectCommand(["bd", "--version"], { stdout: "bd version 1.2.0" });
  // bun
  expectCommand(["which", "bun"], { stdout: "/usr/bin/bun" });
  expectCommand(["bun", "--version"], { stdout: "1.1.0" });
  // secrets (called twice: once for ANTHROPIC_API_KEY, once for LOOP_PAT)
  expectCommand(["gh", "secret", "list"], {
    stdout:
      "ANTHROPIC_API_KEY\tUpdated 2025-01-01\nLOOP_PAT\tUpdated 2025-01-01",
  });
  expectCommand(["gh", "secret", "list"], {
    stdout:
      "ANTHROPIC_API_KEY\tUpdated 2025-01-01\nLOOP_PAT\tUpdated 2025-01-01",
  });
}

describe("runChecks", () => {
  test("all pass", async () => {
    expectAllPass();
    const results = await runChecks();
    const fails = results.filter((r) => r.status === "fail");
    expect(fails).toHaveLength(0);
    expect(results.length).toBeGreaterThanOrEqual(9);
  });

  test("git missing → fail", async () => {
    // git not found
    expectCommand(["which", "git"], { exitCode: 1 });
    // git repo check
    expectCommand(["git", "rev-parse", "--show-toplevel"], {
      exitCode: 128,
      stderr: "not a git repo",
    });
    // gh
    expectCommand(["which", "gh"], { stdout: "/usr/bin/gh" });
    expectCommand(["gh", "--version"], { stdout: "gh version 2.44.0" });
    // gh auth
    expectCommand(["gh", "auth", "status"], {
      stdout: "Logged in to github.com account testuser (keyring)",
    });
    // bd
    expectCommand(["which", "bd"], { stdout: "/usr/bin/bd" });
    expectCommand(["bd", "--version"], { stdout: "bd version 1.2.0" });
    // bun
    expectCommand(["which", "bun"], { stdout: "/usr/bin/bun" });
    expectCommand(["bun", "--version"], { stdout: "1.1.0" });
    // secrets
    expectCommand(["gh", "secret", "list"], {
      stdout: "ANTHROPIC_API_KEY\tUpdated 2025-01-01\nLOOP_PAT\tUpdated 2025-01-01",
    });
    expectCommand(["gh", "secret", "list"], {
      stdout: "ANTHROPIC_API_KEY\tUpdated 2025-01-01\nLOOP_PAT\tUpdated 2025-01-01",
    });

    const results = await runChecks();
    const git = results.find((r) => r.name === "git");
    expect(git?.status).toBe("fail");
  });

  test("gh missing → skips auth check", async () => {
    // git
    expectCommand(["which", "git"], { stdout: "/usr/bin/git" });
    expectCommand(["git", "--version"], { stdout: "git version 2.39.3" });
    // git repo
    expectCommand(["git", "rev-parse", "--show-toplevel"], {
      stdout: tmpDir,
    });
    // gh not found
    expectCommand(["which", "gh"], { exitCode: 1 });
    // bd
    expectCommand(["which", "bd"], { stdout: "/usr/bin/bd" });
    expectCommand(["bd", "--version"], { stdout: "bd version 1.2.0" });
    // bun
    expectCommand(["which", "bun"], { stdout: "/usr/bin/bun" });
    expectCommand(["bun", "--version"], { stdout: "1.1.0" });

    const results = await runChecks();
    const ghAuth = results.find((r) => r.name === "gh auth");
    expect(ghAuth?.status).toBe("fail");
    expect(ghAuth?.message).toContain("skipped");
  });

  test("env var fallback for API key", async () => {
    // gh not found — so secrets can't be checked via gh
    expectCommand(["which", "git"], { stdout: "/usr/bin/git" });
    expectCommand(["git", "--version"], { stdout: "git version 2.39.3" });
    expectCommand(["git", "rev-parse", "--show-toplevel"], {
      stdout: tmpDir,
    });
    expectCommand(["which", "gh"], { exitCode: 1 });
    expectCommand(["which", "bd"], { stdout: "/usr/bin/bd" });
    expectCommand(["bd", "--version"], { stdout: "bd version 1.2.0" });
    expectCommand(["which", "bun"], { stdout: "/usr/bin/bun" });
    expectCommand(["bun", "--version"], { stdout: "1.1.0" });

    // Set env var as fallback
    const orig = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    try {
      const results = await runChecks();
      const apiKey = results.find((r) => r.name === "API key");
      expect(apiKey?.status).toBe("pass");
      expect(apiKey?.message).toContain("environment");
    } finally {
      if (orig === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = orig;
    }
  });
});

describe("doctor", () => {
  test("exits 1 on failure", async () => {
    // Only git fails, rest pass
    expectCommand(["which", "git"], { exitCode: 1 });
    expectCommand(["git", "rev-parse", "--show-toplevel"], {
      exitCode: 128,
      stderr: "not a git repo",
    });
    expectCommand(["which", "gh"], { stdout: "/usr/bin/gh" });
    expectCommand(["gh", "--version"], { stdout: "gh version 2.44.0" });
    expectCommand(["gh", "auth", "status"], {
      stdout: "Logged in to github.com account testuser (keyring)",
    });
    expectCommand(["which", "bd"], { stdout: "/usr/bin/bd" });
    expectCommand(["bd", "--version"], { stdout: "bd version 1.2.0" });
    expectCommand(["which", "bun"], { stdout: "/usr/bin/bun" });
    expectCommand(["bun", "--version"], { stdout: "1.1.0" });
    expectCommand(["gh", "secret", "list"], {
      stdout: "ANTHROPIC_API_KEY\tUpdated 2025-01-01\nLOOP_PAT\tUpdated 2025-01-01",
    });
    expectCommand(["gh", "secret", "list"], {
      stdout: "ANTHROPIC_API_KEY\tUpdated 2025-01-01\nLOOP_PAT\tUpdated 2025-01-01",
    });

    const writeSpy = spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await doctor(false);
    expect(exitSpy).toHaveBeenCalledWith(1);
    writeSpy.mockRestore();
  });

  test("all pass → no exit", async () => {
    expectAllPass();
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await doctor(false);
    expect(exitSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
