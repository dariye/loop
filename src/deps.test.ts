import { describe, test, expect, beforeEach } from "bun:test";
import {
  expectCommand,
  resetMockShell,
} from "../test/helpers/mock-shell.ts";
import {
  checkCommand,
  checkGhAuth,
  checkGitRepo,
  checkSecret,
} from "./deps.ts";

beforeEach(() => {
  resetMockShell();
});

describe("checkCommand", () => {
  test("found with version", async () => {
    expectCommand(["which", "git"], { stdout: "/usr/bin/git" });
    expectCommand(["git", "--version"], {
      stdout: "git version 2.39.3",
    });
    const result = await checkCommand("git");
    expect(result.found).toBe(true);
    expect(result.version).toBe("2.39.3");
  });

  test("not found", async () => {
    expectCommand(["which", "missing"], { exitCode: 1 });
    const result = await checkCommand("missing");
    expect(result.found).toBe(false);
    expect(result.version).toBeUndefined();
  });

  test("found but no version match", async () => {
    expectCommand(["which", "tool"], { stdout: "/usr/bin/tool" });
    expectCommand(["tool", "--version"], { stdout: "unknown output" });
    const result = await checkCommand("tool");
    expect(result.found).toBe(true);
    expect(result.version).toBeUndefined();
  });

  test("custom version flag", async () => {
    expectCommand(["which", "node"], { stdout: "/usr/bin/node" });
    expectCommand(["node", "-v"], { stdout: "v20.11.0" });
    const result = await checkCommand("node", "-v");
    expect(result.found).toBe(true);
    expect(result.version).toBe("20.11.0");
  });
});

describe("checkGhAuth", () => {
  test("authenticated (account format)", async () => {
    expectCommand(["gh", "auth", "status"], {
      stdout:
        "github.com\n  Logged in to github.com account testuser (keyring)",
    });
    const result = await checkGhAuth();
    expect(result.authenticated).toBe(true);
    expect(result.user).toBe("testuser");
  });

  test("authenticated (as format)", async () => {
    expectCommand(["gh", "auth", "status"], {
      stdout:
        "github.com\n  Logged in to github.com as otheruser",
    });
    const result = await checkGhAuth();
    expect(result.authenticated).toBe(true);
    expect(result.user).toBe("otheruser");
  });

  test("not authenticated", async () => {
    expectCommand(["gh", "auth", "status"], { exitCode: 1 });
    const result = await checkGhAuth();
    expect(result.authenticated).toBe(false);
  });
});

describe("checkGitRepo", () => {
  test("in a repo", async () => {
    expectCommand(["git", "rev-parse", "--show-toplevel"], {
      stdout: "/home/user/project",
    });
    const result = await checkGitRepo();
    expect(result.inRepo).toBe(true);
    expect(result.root).toBe("/home/user/project");
  });

  test("not in a repo", async () => {
    expectCommand(["git", "rev-parse", "--show-toplevel"], {
      exitCode: 128,
      stderr: "fatal: not a git repository",
    });
    const result = await checkGitRepo();
    expect(result.inRepo).toBe(false);
  });
});

describe("checkSecret", () => {
  test("found", async () => {
    expectCommand(["gh", "secret", "list"], {
      stdout:
        "ANTHROPIC_API_KEY\tUpdated 2025-01-01\nOTHER_SECRET\tUpdated 2025-02-01",
    });
    const result = await checkSecret("ANTHROPIC_API_KEY");
    expect(result).toBe("found");
  });

  test("not found", async () => {
    expectCommand(["gh", "secret", "list"], {
      stdout: "OTHER_SECRET\tUpdated 2025-02-01",
    });
    const result = await checkSecret("ANTHROPIC_API_KEY");
    expect(result).toBe("not_found");
  });

  test("error returns unknown", async () => {
    expectCommand(["gh", "secret", "list"], {
      exitCode: 1,
      stderr: "auth required",
    });
    const result = await checkSecret("ANTHROPIC_API_KEY");
    expect(result).toBe("unknown");
  });
});
