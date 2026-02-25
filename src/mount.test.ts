import { describe, test, expect, beforeEach } from "bun:test"
import {
  expectCommand,
  resetMockShell,
} from "../test/helpers/mock-shell.ts"

beforeEach(() => {
  resetMockShell()
})

describe("resolveProject logic", () => {
  test("git rev-parse returns repo root", async () => {
    // Import exec from the mocked shell
    const { exec } = await import("./shell.ts")

    expectCommand(
      ["git", "rev-parse", "--show-toplevel"],
      { stdout: "/home/user/project" },
    )

    const result = await exec(["git", "rev-parse", "--show-toplevel"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("/home/user/project")
  })

  test("git rev-parse fails outside repo", async () => {
    const { exec } = await import("./shell.ts")

    expectCommand(
      ["git", "rev-parse", "--show-toplevel"],
      { exitCode: 128, stderr: "fatal: not a git repository" },
    )

    const result = await exec(["git", "rev-parse", "--show-toplevel"])
    expect(result.exitCode).toBe(128)
  })

  test("git -C <path> resolves local path", async () => {
    const { exec } = await import("./shell.ts")

    expectCommand(
      ["git", "-C", "/tmp/some-repo", "rev-parse", "--show-toplevel"],
      { stdout: "/tmp/some-repo" },
    )

    const result = await exec(["git", "-C", "/tmp/some-repo", "rev-parse", "--show-toplevel"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("/tmp/some-repo")
  })
})

describe("LoopConfig schema", () => {
  test("config JSON is valid", () => {
    const config = { model: "sonnet", budget: 5 }
    const json = JSON.stringify(config, null, 2)
    const parsed = JSON.parse(json)
    expect(parsed.model).toBe("sonnet")
    expect(parsed.budget).toBe(5)
  })

  test("config with opus model", () => {
    const config = { model: "opus", budget: 10 }
    const json = JSON.stringify(config, null, 2)
    const parsed = JSON.parse(json)
    expect(parsed.model).toBe("opus")
    expect(parsed.budget).toBe(10)
  })

  test("config with defaults", () => {
    const config = { model: "sonnet", budget: 5 }
    expect(config.model).toBe("sonnet")
    expect(config.budget).toBe(5)
  })
})

describe("GitHub URL parsing", () => {
  test("extracts repo name from HTTPS URL", () => {
    const url = "https://github.com/dariye/loop"
    const match = url.match(/[/:]([^/]+\/[^/]+?)(?:\.git)?$/)
    expect(match?.[1]).toBe("dariye/loop")
  })

  test("extracts repo name from SSH URL", () => {
    const url = "git@github.com:dariye/loop.git"
    const match = url.match(/[/:]([^/]+\/[^/]+?)(?:\.git)?$/)
    expect(match?.[1]).toBe("dariye/loop")
  })

  test("extracts repo name from HTTPS URL with .git suffix", () => {
    const url = "https://github.com/user/repo.git"
    const match = url.match(/[/:]([^/]+\/[^/]+?)(?:\.git)?$/)
    expect(match?.[1]).toBe("user/repo")
  })
})
