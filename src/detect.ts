import { exec } from "./shell.ts"

export interface ProjectProfile {
  language: "typescript" | "javascript" | "python" | "go" | "rust" | "ruby" | "java" | "unknown"
  framework: string | null
  testRunner: string | null
  packageManager: "bun" | "npm" | "yarn" | "pnpm" | null
  hasCI: boolean
  hasLoop: boolean
  hasLoopDir: boolean
  existingOverrides: string[]
  hasSkills: boolean
  existingSkills: string[]
  gitRemote: string | null
  repoName: string | null
}

export async function detectProject(root: string): Promise<ProjectProfile> {
  const [language, framework, testRunner, packageManager, hasCI, hasLoop, hasLoopDir, existingOverrides, existingSkills, gitRemote] =
    await Promise.all([
      detectLanguage(root),
      detectFramework(root),
      detectTestRunner(root),
      detectPackageManager(root),
      detectCI(root),
      checkExists(`${root}/.github/workflows/loop.yml`),
      checkExists(`${root}/.loop`),
      listOverrides(root),
      listSkills(root),
      getGitRemote(root),
    ])

  const repoName = deriveRepoName(gitRemote, root)
  const hasSkills = existingSkills.length > 0

  return {
    language,
    framework,
    testRunner,
    packageManager,
    hasCI,
    hasLoop,
    hasLoopDir,
    existingOverrides,
    hasSkills,
    existingSkills,
    gitRemote,
    repoName,
  }
}

async function checkExists(path: string): Promise<boolean> {
  const file = Bun.file(path)
  return file.exists()
}

async function detectLanguage(root: string): Promise<ProjectProfile["language"]> {
  const checks: [string, ProjectProfile["language"]][] = [
    [`${root}/tsconfig.json`, "typescript"],
    [`${root}/go.mod`, "go"],
    [`${root}/Cargo.toml`, "rust"],
    [`${root}/Gemfile`, "ruby"],
    [`${root}/pyproject.toml`, "python"],
    [`${root}/setup.py`, "python"],
    [`${root}/package.json`, "javascript"],
  ]

  for (const [path, lang] of checks) {
    if (await checkExists(path)) return lang
  }
  return "unknown"
}

async function detectFramework(root: string): Promise<string | null> {
  // Check package.json deps
  try {
    const pkgFile = Bun.file(`${root}/package.json`)
    if (await pkgFile.exists()) {
      const pkg = await pkgFile.json()
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      }
      if (allDeps["next"]) return "next"
      if (allDeps["express"]) return "express"
      if (allDeps["@hono/node-server"] || allDeps["hono"]) return "hono"
      if (allDeps["vue"]) return "vue"
      if (allDeps["react"]) return "react"
      if (allDeps["svelte"]) return "svelte"
    }
  } catch {
    // ignore parse errors
  }

  // Check pyproject.toml
  try {
    const pyFile = Bun.file(`${root}/pyproject.toml`)
    if (await pyFile.exists()) {
      const content = await pyFile.text()
      if (content.includes("django")) return "django"
      if (content.includes("flask")) return "flask"
      if (content.includes("fastapi")) return "fastapi"
    }
  } catch {
    // ignore
  }

  return null
}

async function detectTestRunner(root: string): Promise<string | null> {
  // bunfig.toml [test] section
  try {
    const bunfig = Bun.file(`${root}/bunfig.toml`)
    if (await bunfig.exists()) {
      const content = await bunfig.text()
      if (content.includes("[test]")) return "bun:test"
    }
  } catch {
    // ignore
  }

  // vitest.config.*
  const vitestConfigs = ["vitest.config.ts", "vitest.config.js", "vitest.config.mts"]
  for (const name of vitestConfigs) {
    if (await checkExists(`${root}/${name}`)) return "vitest"
  }

  // jest.config.*
  const jestConfigs = ["jest.config.ts", "jest.config.js", "jest.config.mjs"]
  for (const name of jestConfigs) {
    if (await checkExists(`${root}/${name}`)) return "jest"
  }

  // package.json scripts.test
  try {
    const pkgFile = Bun.file(`${root}/package.json`)
    if (await pkgFile.exists()) {
      const pkg = await pkgFile.json()
      const testScript = pkg.scripts?.test ?? ""
      if (testScript.includes("vitest")) return "vitest"
      if (testScript.includes("jest")) return "jest"
      if (testScript.includes("bun test")) return "bun:test"
      if (testScript.includes("mocha")) return "mocha"
    }
  } catch {
    // ignore
  }

  // pytest
  if (await checkExists(`${root}/pytest.ini`) || await checkExists(`${root}/pyproject.toml`)) {
    try {
      const pyFile = Bun.file(`${root}/pyproject.toml`)
      if (await pyFile.exists()) {
        const content = await pyFile.text()
        if (content.includes("[tool.pytest]") || content.includes("pytest")) return "pytest"
      }
    } catch {
      // ignore
    }
  }

  return null
}

async function detectPackageManager(root: string): Promise<ProjectProfile["packageManager"]> {
  if (await checkExists(`${root}/bun.lock`) || await checkExists(`${root}/bun.lockb`)) return "bun"
  if (await checkExists(`${root}/yarn.lock`)) return "yarn"
  if (await checkExists(`${root}/pnpm-lock.yaml`)) return "pnpm"
  if (await checkExists(`${root}/package-lock.json`)) return "npm"
  return null
}

async function detectCI(root: string): Promise<boolean> {
  const result = await exec(["ls", `${root}/.github/workflows/`])
  if (result.exitCode !== 0) return false
  return result.stdout.split("\n").some((f) => f.trim().endsWith(".yml") || f.trim().endsWith(".yaml"))
}

async function listOverrides(root: string): Promise<string[]> {
  const result = await exec(["ls", `${root}/.loop/`])
  if (result.exitCode !== 0) return []
  return result.stdout
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.endsWith(".md"))
}

async function listSkills(root: string): Promise<string[]> {
  const result = await exec(["ls", `${root}/.claude/skills/`])
  if (result.exitCode !== 0) return []
  return result.stdout
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.startsWith("loop-"))
}

async function getGitRemote(root: string): Promise<string | null> {
  const result = await exec(["git", "-C", root, "remote", "get-url", "origin"])
  if (result.exitCode !== 0) return null
  return result.stdout.trim() || null
}

function deriveRepoName(remote: string | null, root: string): string | null {
  if (remote) {
    // git@github.com:user/repo.git or https://github.com/user/repo.git
    const match = remote.match(/[/:]([^/]+\/[^/]+?)(?:\.git)?$/)
    if (match) return match[1]
  }
  // Fall back to directory name
  const parts = root.split("/")
  return parts[parts.length - 1] || null
}
