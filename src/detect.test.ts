import { describe, test, expect, beforeEach } from "bun:test"
import {
  expectCommand,
  resetMockShell,
} from "../test/helpers/mock-shell.ts"
import { detectProject } from "./detect.ts"

// Mock Bun.file().exists() by controlling what files "exist"
// detect.ts uses Bun.file(path).exists() for file checks and Bun.file(path).json()/text() for content
// We can't easily mock Bun.file, so we test the detection logic through the exec-based paths
// and rely on integration-style assertions for file-based checks.

beforeEach(() => {
  resetMockShell()
})

describe("detectProject", () => {
  test("detects CI from workflows directory", async () => {
    // detectCI uses exec(["ls", ...])
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".github/workflows"),
      { stdout: "ci.yml\nloop.yml" },
    )
    // listOverrides uses exec(["ls", ...])
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".loop"),
      { exitCode: 1 },
    )
    // listSkills uses exec(["ls", ...])
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".claude/skills"),
      { exitCode: 1 },
    )
    // getGitRemote
    expectCommand(
      (cmd) => cmd[0] === "git" && cmd.includes("get-url"),
      { stdout: "https://github.com/test/repo.git" },
    )
    // detectFrontend template checks (app/views, resources/views, templates)
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("app/views"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("resources/views"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("/fake/root/templates"),
      { exitCode: 1 },
    )

    // We can't fully test file-based detection since Bun.file is not mocked,
    // but we test the exec-based paths
    const profile = await detectProject("/fake/root")
    expect(profile.hasCI).toBe(true)
    expect(profile.hasSkills).toBe(false)
    expect(profile.existingSkills).toEqual([])
    expect(profile.gitRemote).toBe("https://github.com/test/repo.git")
    expect(profile.repoName).toBe("test/repo")
    expect(profile.hasFrontend).toBe(false)
  })

  test("detects no CI when workflows dir missing", async () => {
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".github/workflows"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".loop"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".claude/skills"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "git" && cmd.includes("get-url"),
      { exitCode: 1 },
    )
    // detectFrontend template checks
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("app/views"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("resources/views"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("/fake/root/templates"),
      { exitCode: 1 },
    )

    const profile = await detectProject("/fake/root")
    expect(profile.hasCI).toBe(false)
    expect(profile.gitRemote).toBeNull()
    expect(profile.hasFrontend).toBe(false)
  })

  test("detects overrides in .loop directory", async () => {
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".github/workflows"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".loop"),
      { stdout: "design.md\nbuild.md\n.gitkeep" },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".claude/skills"),
      { stdout: "loop-design\nloop-build" },
    )
    expectCommand(
      (cmd) => cmd[0] === "git" && cmd.includes("get-url"),
      { stdout: "git@github.com:user/project.git" },
    )
    // detectFrontend template checks
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("app/views"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("resources/views"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("/fake/root/templates"),
      { exitCode: 1 },
    )

    const profile = await detectProject("/fake/root")
    expect(profile.existingOverrides).toContain("design.md")
    expect(profile.existingOverrides).toContain("build.md")
    expect(profile.existingOverrides).not.toContain(".gitkeep")
    expect(profile.hasSkills).toBe(true)
    expect(profile.existingSkills).toContain("loop-design")
    expect(profile.existingSkills).toContain("loop-build")
    expect(profile.repoName).toBe("user/project")
  })

  test("derives repo name from directory when no remote", async () => {
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".github/workflows"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".loop"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes(".claude/skills"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "git" && cmd.includes("get-url"),
      { exitCode: 1 },
    )
    // detectFrontend template checks
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("app/views"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("resources/views"),
      { exitCode: 1 },
    )
    expectCommand(
      (cmd) => cmd[0] === "ls" && cmd[1]?.includes("/home/user/my-project/templates"),
      { exitCode: 1 },
    )

    const profile = await detectProject("/home/user/my-project")
    expect(profile.repoName).toBe("my-project")
    expect(profile.hasFrontend).toBe(false)
  })
})
