import { resolve } from "path"
import { exec } from "./shell.ts"
import { detectProject, type ProjectProfile } from "./detect.ts"
import { installWorkflow, ensureLoopDir, ensureSkillsDir, installSkills } from "./install.ts"
import { runChecks } from "./doctor.ts"
import { checkSecret } from "./deps.ts"
import {
  createWizard,
  destroyWizard,
  promptSelect,
  promptConfirm,
  promptText,
  showStatus,
  type WizardContext,
} from "./ui/wizard.ts"

const TOTAL_STEPS = 7

export interface MountOptions {
  target?: string
}

export interface LoopConfig {
  model?: string
  budget?: number
  browser?: "auto" | "true" | "false"
  browserExtensions?: string[]
}

export async function mount(opts: MountOptions): Promise<void> {
  // Step 1: Project Selection (interactive in TUI if no target)
  const { root, profile, ctx } = await stepProjectSelect(opts.target)

  try {
    // Step 2: Install Workflow
    await stepInstallWorkflow(ctx, root, profile)

    // Step 3: Skill Installation
    await stepSkillInstall(ctx, root, profile)

    // Step 4: Browser Configuration
    const browserConfig = await stepBrowserConfig(ctx, profile)

    // Step 5: Secrets
    await stepSecrets(ctx)

    // Step 6: Defaults (Model + Budget)
    const config = await stepDefaults(ctx, browserConfig)

    // Write config
    const loopDir = await ensureLoopDir(root)
    await Bun.write(resolve(loopDir, "config.json"), JSON.stringify(config, null, 2) + "\n")

    // Step 7: Doctor Verification
    await stepDoctor(ctx)

    // Always launch dashboard with onboarding
    destroyWizard(ctx)

    const { launch } = await import("./ui/app.ts")
    await launch(config.model ?? "sonnet", String(config.budget ?? 5), { onboarding: true })
  } catch (err) {
    destroyWizard(ctx)
    throw err
  }
}

async function resolveTarget(target: string): Promise<string> {
  // GitHub URL
  if (target.startsWith("https://github.com/") || target.startsWith("git@github.com:")) {
    console.log(`Cloning ${target}...`)
    const result = await exec(["gh", "repo", "clone", target])
    if (result.exitCode !== 0) {
      console.error(`Error: Failed to clone ${target}`)
      console.error(`  ${result.stderr}`)
      process.exit(1)
    }
    const match = target.match(/[/:]([^/]+?)(?:\.git)?$/)
    const dirName = match?.[1] ?? "repo"
    return resolve(process.cwd(), dirName)
  }

  // Local path
  const absPath = resolve(target)
  const result = await exec(["git", "-C", absPath, "rev-parse", "--show-toplevel"])
  if (result.exitCode !== 0) {
    console.error(`Error: ${absPath} is not a git repository`)
    process.exit(1)
  }
  return result.stdout.trim()
}

async function stepProjectSelect(
  target?: string,
): Promise<{ root: string; profile: ProjectProfile; ctx: WizardContext }> {
  // If target provided, resolve pre-TUI (same as before)
  if (target) {
    const root = await resolveTarget(target)
    const profile = await detectProject(root)
    const ctx = await createWizard()
    showDetection(ctx, profile)
    await Bun.sleep(500)
    return { root, profile, ctx }
  }

  // Check if we're in a git repo
  const gitResult = await exec(["git", "rev-parse", "--show-toplevel"])
  const inGitRepo = gitResult.exitCode === 0
  const cwd = process.cwd()
  const dirName = cwd.split("/").pop() ?? cwd

  // Start TUI for interactive selection
  const ctx = await createWizard()

  if (inGitRepo) {
    const choice = await promptSelect(ctx, 1, TOTAL_STEPS, `Mount this directory?  ${cwd}`, [
      { name: "Yes, mount here", description: `Set up Loop in ${dirName}` },
      { name: "Clone from GitHub URL", description: "Clone a repo and mount it" },
      { name: "Enter a local path", description: "Mount a different directory" },
      { name: "Exit", description: "Cancel and exit" },
    ])

    if (choice === 3) {
      destroyWizard(ctx)
      return process.exit(0)
    }

    if (choice === 0) {
      const root = gitResult.stdout.trim()
      const profile = await detectProject(root)
      showDetection(ctx, profile)
      await Bun.sleep(500)
      return { root, profile, ctx }
    }

    if (choice === 1) {
      const url = await promptText(ctx, 1, TOTAL_STEPS, "GitHub URL", "", "https://github.com/user/repo")
      destroyWizard(ctx)
      const root = await resolveTarget(url)
      const profile = await detectProject(root)
      const newCtx = await createWizard()
      showDetection(newCtx, profile)
      await Bun.sleep(500)
      return { root, profile, ctx: newCtx }
    }

    // choice === 2: local path
    const localPath = await promptText(ctx, 1, TOTAL_STEPS, "Local path", "", "/path/to/project")
    const root = await resolveTarget(localPath)
    const profile = await detectProject(root)
    showDetection(ctx, profile)
    await Bun.sleep(500)
    return { root, profile, ctx }
  }

  // Not in a git repo — prompt for URL or path directly
  const choice = await promptSelect(ctx, 1, TOTAL_STEPS, "No git repository detected", [
    { name: "Clone from GitHub URL", description: "Clone a repo and mount it" },
    { name: "Enter a local path", description: "Mount an existing directory" },
    { name: "Exit", description: "Cancel and exit" },
  ])

  if (choice === 2) {
    destroyWizard(ctx)
    return process.exit(0)
  }

  if (choice === 0) {
    const url = await promptText(ctx, 1, TOTAL_STEPS, "GitHub URL", "", "https://github.com/user/repo")
    destroyWizard(ctx)
    const root = await resolveTarget(url)
    const profile = await detectProject(root)
    const newCtx = await createWizard()
    showDetection(newCtx, profile)
    await Bun.sleep(500)
    return { root, profile, ctx: newCtx }
  }

  // choice === 1: local path
  const localPath = await promptText(ctx, 1, TOTAL_STEPS, "Local path", "", "/path/to/project")
  const root = await resolveTarget(localPath)
  const profile = await detectProject(root)
  showDetection(ctx, profile)
  await Bun.sleep(500)
  return { root, profile, ctx }
}

function showDetection(ctx: WizardContext, profile: ProjectProfile): void {
  const langLabel = profile.language === "unknown" ? "not detected" : profile.language
  const fwLabel = profile.framework ?? "none detected"
  const testLabel = profile.testRunner ?? "none detected"
  const pmLabel = profile.packageManager ?? "none detected"
  const repoLabel = profile.repoName ?? "unknown"

  showStatus(ctx, `Detected: ${repoLabel}`, [
    { icon: "◉", label: "Language", value: langLabel },
    { icon: "◉", label: "Framework", value: fwLabel },
    { icon: "◉", label: "Test runner", value: testLabel },
    { icon: "◉", label: "Package manager", value: pmLabel },
    { icon: profile.hasCI ? "✓" : "·", label: "CI workflows", value: profile.hasCI ? "detected" : "none" },
    { icon: profile.hasLoop ? "✓" : "·", label: "Loop installed", value: profile.hasLoop ? "yes" : "no" },
  ])
}

async function stepInstallWorkflow(ctx: WizardContext, root: string, profile: ProjectProfile): Promise<void> {
  if (profile.hasLoop) {
    const overwrite = await promptConfirm(ctx, 2, TOTAL_STEPS, "Workflow exists. Reinstall?", false)
    if (!overwrite) return
  }

  showStatus(ctx, "Installing workflow...", [
    { icon: "⟳", label: "Workflow", value: ".github/workflows/loop.yml" },
  ])

  const path = await installWorkflow(root)

  showStatus(ctx, "Workflow installed", [
    { icon: "✓", label: "Workflow", value: path },
  ])
  await Bun.sleep(800)
}

async function stepSkillInstall(ctx: WizardContext, root: string, profile: ProjectProfile): Promise<void> {
  const choice = await promptSelect(ctx, 3, TOTAL_STEPS, "Phase Skills", [
    { name: "Install skills (recommended)", description: "Install loop-design, loop-build, loop-review, loop-fix to .claude/skills/" },
    { name: "Customize skills", description: "Install as editable templates you can modify" },
  ])

  if (profile.hasSkills) {
    const overwrite = await promptConfirm(
      ctx, 3, TOTAL_STEPS,
      "Skills already installed. Overwrite?",
      false,
    )
    if (!overwrite) return
  }

  showStatus(ctx, "Installing skills...", [
    { icon: "⟳", label: "Skills", value: ".claude/skills/loop-*" },
  ])

  const installed = await installSkills(root)

  showStatus(ctx, `${installed.length} skills installed`, installed.map((s) => ({
    icon: "✓",
    label: s,
    value: ".claude/skills/" + s + "/SKILL.md",
  })))
  await Bun.sleep(800)

  if (choice === 1) {
    showStatus(ctx, "Skills installed as editable templates", [
      { icon: "✎", label: "Edit skills", value: ".claude/skills/loop-*/SKILL.md" },
      { icon: "✎", label: "Edit review criteria", value: ".claude/skills/loop-review/criteria/*.md" },
      { icon: "+", label: "Add criteria", value: "Add .md files to criteria/ to extend review" },
    ])
    await Bun.sleep(500)
  }
}

const DEFAULT_BROWSER_EXTENSIONS = [
  "tsx", "jsx", "vue", "svelte", "css", "scss", "sass", "less",
  "html", "erb", "haml", "slim", "ejs", "hbs", "handlebars",
  "pug", "jade", "blade.php", "twig", "mustache", "liquid", "svg",
]

async function stepBrowserConfig(
  ctx: WizardContext,
  profile: ProjectProfile,
): Promise<Pick<LoopConfig, "browser" | "browserExtensions">> {
  if (profile.hasFrontend) {
    const fwLabel = profile.framework ?? "frontend files"
    const choice = await promptSelect(ctx, 4, TOTAL_STEPS, `Frontend detected (${fwLabel}). Enable headless browser in CI?`, [
      { name: "Enable (recommended)", description: "Auto-detect frontend file changes and verify with Chrome" },
      { name: "Always on", description: "Run browser verification on every PR" },
      { name: "Disable", description: "No browser verification in CI" },
    ])

    if (choice === 2) {
      return { browser: "false" }
    }

    const browser = choice === 1 ? "true" as const : "auto" as const

    // Ask for extension customization
    const defaultExts = DEFAULT_BROWSER_EXTENSIONS.join(",")
    const extsStr = await promptText(
      ctx, 4, TOTAL_STEPS,
      "Frontend file extensions (comma-separated)",
      defaultExts,
      "e.g. tsx,jsx,vue,css,html,erb",
    )

    const browserExtensions = extsStr.split(",").map((s) => s.trim()).filter(Boolean)
    return { browser, browserExtensions }
  }

  // No frontend detected
  const choice = await promptSelect(ctx, 4, TOTAL_STEPS, "No frontend framework detected. Enable headless browser for template files?", [
    { name: "Enable", description: "Auto-detect changes to .erb, .haml, .html, etc." },
    { name: "Disable (recommended)", description: "Skip browser verification" },
  ])

  if (choice === 1) {
    return { browser: "false" }
  }

  const defaultExts = DEFAULT_BROWSER_EXTENSIONS.join(",")
  const extsStr = await promptText(
    ctx, 4, TOTAL_STEPS,
    "Frontend file extensions (comma-separated)",
    defaultExts,
    "e.g. tsx,jsx,vue,css,html,erb",
  )

  const browserExtensions = extsStr.split(",").map((s) => s.trim()).filter(Boolean)
  return { browser: "auto", browserExtensions }
}

async function stepSecrets(ctx: WizardContext): Promise<void> {
  const apiKeyStatus = await checkSecret("ANTHROPIC_API_KEY")
  const patStatus = await checkSecret("LOOP_PAT")

  const apiKeyIcon = apiKeyStatus === "found" ? "✓" : apiKeyStatus === "not_found" ? "✗" : "⚠"
  const patIcon = patStatus === "found" ? "✓" : patStatus === "not_found" ? "⚠" : "⚠"

  const apiKeyValue = apiKeyStatus === "found" ? "configured" : apiKeyStatus === "not_found" ? "missing" : "could not check"
  const patValue = patStatus === "found" ? "configured" : patStatus === "not_found" ? "not set (chaining disabled)" : "could not check"

  showStatus(ctx, "Repository Secrets", [
    { icon: apiKeyIcon, label: "ANTHROPIC_API_KEY", value: apiKeyValue },
    { icon: patIcon, label: "LOOP_PAT", value: patValue },
  ])
  await Bun.sleep(500)

  // Offer to set missing secrets
  if (apiKeyStatus === "not_found") {
    const setKey = await promptSelect(ctx, 5, TOTAL_STEPS, "ANTHROPIC_API_KEY is missing", [
      { name: "Set now", description: "Run gh secret set ANTHROPIC_API_KEY" },
      { name: "Skip", description: "Set it manually later" },
    ])

    if (setKey === 0) {
      destroyWizard(ctx)
      // Run gh secret set with inherited stdio for interactive input
      const proc = Bun.spawn(["gh", "secret", "set", "ANTHROPIC_API_KEY"], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
      await proc.exited
      // Recreate wizard
      const newCtx = await import("./ui/wizard.ts").then((m) => m.createWizard())
      Object.assign(ctx, newCtx)
    }
  }

  if (patStatus === "not_found") {
    const setPat = await promptSelect(ctx, 5, TOTAL_STEPS, "LOOP_PAT enables auto-chaining", [
      { name: "Set now", description: "Run gh secret set LOOP_PAT" },
      { name: "Skip", description: "Set it manually later (chaining disabled)" },
    ])

    if (setPat === 0) {
      destroyWizard(ctx)
      const proc = Bun.spawn(["gh", "secret", "set", "LOOP_PAT"], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
      await proc.exited
      const newCtx = await import("./ui/wizard.ts").then((m) => m.createWizard())
      Object.assign(ctx, newCtx)
    }
  }
}

async function stepDefaults(ctx: WizardContext, browserConfig: Pick<LoopConfig, "browser" | "browserExtensions">): Promise<LoopConfig> {
  const modelIndex = await promptSelect(ctx, 6, TOTAL_STEPS, "Default Claude model", [
    { name: "sonnet (recommended)", description: "Best balance of speed and quality" },
    { name: "opus", description: "Maximum quality, slower" },
    { name: "haiku", description: "Fastest, most economical" },
  ])

  const modelMap = ["sonnet", "opus", "haiku"]
  const model = modelMap[modelIndex]

  const budgetStr = await promptText(ctx, 6, TOTAL_STEPS, "Default budget (USD per run)", "5", "e.g. 5")
  const budget = parseFloat(budgetStr) || 5

  return { model, budget, ...browserConfig }
}

async function stepDoctor(ctx: WizardContext): Promise<void> {
  showStatus(ctx, "Running health checks...", [
    { icon: "⟳", label: "Checking", value: "dependencies and configuration" },
  ])

  const results = await runChecks()

  const lines = results.map((r) => ({
    icon: r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "⚠",
    label: r.name,
    value: r.message,
  }))

  const pass = results.filter((r) => r.status === "pass").length
  const fail = results.filter((r) => r.status === "fail").length
  showStatus(ctx, `Health Check — ${pass}/${results.length} passed`, lines)
  await Bun.sleep(1000)

  if (fail > 0) {
    const action = await promptSelect(ctx, 7, TOTAL_STEPS, `${fail} check(s) failed`, [
      { name: "Run auto-fix", description: "Attempt to fix issues automatically" },
      { name: "Continue anyway", description: "Proceed with setup despite failures" },
    ])

    if (action === 0) {
      // Import and run doctor fix logic
      const { doctor } = await import("./doctor.ts")
      destroyWizard(ctx)
      await doctor(true)
      const newCtx = await import("./ui/wizard.ts").then((m) => m.createWizard())
      Object.assign(ctx, newCtx)
    }
  }
}

