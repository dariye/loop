import {
  createCliRenderer,
  Box,
  Text,
  vstyles,
  type KeyEvent,
  type CliRenderer,
} from "@opentui/core"
import {
  IssueList,
  createIssueListState,
  moveSelection,
  getSelectedIssue,
  type IssueListState,
  type IssueItem,
} from "./issue-list.ts"
import {
  Pipeline,
  createPipelineState,
  updateDiscStatus,
  type PipelineState,
  type DiscPhase,
} from "./pipeline.ts"
import {
  LogStream,
  createLogStreamState,
  appendLog,
  clearLog,
  type LogStreamState,
} from "./log-stream.ts"
import { Toolbar } from "./toolbar.ts"
import { list } from "../beads.ts"
import { checkCommand } from "../deps.ts"
import { publish } from "../publish.ts"
import { dispatch } from "../dispatch.ts"
import { exec } from "../shell.ts"

interface AppState {
  issues: IssueListState
  pipeline: PipelineState
  logs: LogStreamState
  model: string
  budget: string
}

let renderer: CliRenderer
let state: AppState

function createAppState(model: string, budget: string): AppState {
  return {
    issues: createIssueListState(),
    pipeline: createPipelineState(),
    logs: createLogStreamState(),
    model,
    budget,
  }
}

function render(): void {
  const root = renderer.root
  // Clear and re-render
  for (const child of root.getChildren()) {
    child.destroy()
  }

  root.add(
    Box(
      {
        id: "app",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      },
      // Header
      Box(
        {
          id: "header",
          height: 1,
          width: "100%",
          flexDirection: "row",
          paddingX: 1,
        },
        Text(
          {},
          vstyles.bold(vstyles.color("#00ffaa", "\u25c9 Loop")),
          vstyles.color("#555555", "  Command Center"),
          vstyles.color("#444444", "  \u2502  "),
          vstyles.color("#888888", `model: ${state.model}`),
        ),
      ),
      // Main area
      Box(
        {
          id: "main",
          flexGrow: 1,
          flexDirection: "row",
        },
        // Left: issue list
        IssueList(state.issues),
        // Right: pipeline + logs
        Box(
          {
            id: "right-panel",
            flexGrow: 1,
            flexDirection: "column",
          },
          Pipeline(state.pipeline),
          LogStream(state.logs),
        ),
      ),
      // Footer toolbar
      Toolbar(),
    ),
  )
}

async function loadIssues(): Promise<void> {
  try {
    const allIssues = await list({ status: "open" })
    state.issues.issues = allIssues
      .filter((i) => !i.labels.includes("epic"))
      .map((i) => ({
        id: i.id,
        title: i.title,
        labels: i.labels,
        status: i.status,
      }))
    state.issues.epics = allIssues
      .filter((i) => i.labels.includes("epic"))
      .map((i) => ({
        id: i.id,
        title: i.title,
        labels: i.labels,
        status: i.status,
      }))
    render()
  } catch {
    appendLog(state.logs, "Failed to load issues from beads", "error")
    render()
  }
}

function syncPipelineToSelection(): void {
  const selected = getSelectedIssue(state.issues)
  if (selected) {
    state.pipeline.issueId = selected.id
    state.pipeline.issueTitle = selected.title
    // Infer disc status from labels
    const phases: DiscPhase[] = ["design", "build", "review", "fix"]
    const labelMap: Record<string, DiscPhase> = {
      "loop:designed": "design",
      "loop:built": "build",
      "loop:reviewed": "review",
      "loop:fixed": "fix",
    }
    // Reset all to pending
    for (const phase of phases) {
      updateDiscStatus(state.pipeline, phase, "pending")
    }
    // Mark completed based on labels
    for (const label of selected.labels) {
      const phase = labelMap[label]
      if (phase) {
        updateDiscStatus(state.pipeline, phase, "complete")
      }
    }
  } else {
    state.pipeline.issueId = null
    state.pipeline.issueTitle = ""
  }
}

async function dispatchDisc(disc: DiscPhase, chain = false): Promise<void> {
  const selected = getSelectedIssue(state.issues)
  if (!selected) {
    appendLog(state.logs, "No issue selected", "error")
    render()
    return
  }

  const issueId = selected.id
  appendLog(state.logs, `Dispatching ${disc} for #${issueId}...`, "info")
  updateDiscStatus(state.pipeline, disc, "running")
  render()

  try {
    // Publish to GitHub first for design/build
    if (disc === "design" || disc === "build") {
      appendLog(state.logs, "Publishing issue to GitHub...", "dim")
      render()
      await publish(issueId)
    }

    const runId = await dispatch({
      disc,
      issue: disc === "design" || disc === "build" ? issueId : undefined,
      chain,
      model: state.model,
      budget: state.budget,
    })

    appendLog(state.logs, `Started run ${runId}`, "success")
    appendLog(state.logs, `Track: gh run watch ${runId}`, "dim")
    render()

    // Poll status in background
    pollRunStatus(runId, disc)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appendLog(state.logs, `Failed: ${msg}`, "error")
    updateDiscStatus(state.pipeline, disc, "failed")
    render()
  }
}

async function pollRunStatus(
  runId: string,
  disc: DiscPhase,
): Promise<void> {
  const poll = async () => {
    try {
      const result = await exec(["gh", "run", "view", runId, "--json", "status,conclusion"])
      if (result.exitCode !== 0) throw new Error(result.stderr)
      const data = JSON.parse(result.stdout)

      if (data.status === "completed") {
        if (data.conclusion === "success") {
          updateDiscStatus(state.pipeline, disc, "complete")
          appendLog(state.logs, `${disc} completed successfully`, "success")
        } else {
          updateDiscStatus(state.pipeline, disc, "failed")
          appendLog(
            state.logs,
            `${disc} failed: ${data.conclusion}`,
            "error",
          )
        }
        render()
        return
      }

      // Still running, poll again
      render()
      setTimeout(poll, 5000)
    } catch {
      // gh command failed, retry later
      setTimeout(poll, 10000)
    }
  }

  setTimeout(poll, 5000)
}

function handleKeypress(key: KeyEvent): void {
  switch (key.name) {
    case "q":
      process.exit(0)
      break
    case "j":
    case "down":
      moveSelection(state.issues, 1)
      syncPipelineToSelection()
      render()
      break
    case "k":
    case "up":
      moveSelection(state.issues, -1)
      syncPipelineToSelection()
      render()
      break
    case "d":
      dispatchDisc("design")
      break
    case "b":
      dispatchDisc("build")
      break
    case "r":
      if (key.shift) {
        // R = run full pipeline
        dispatchDisc("design", true)
      } else {
        dispatchDisc("review")
      }
      break
    case "f":
      dispatchDisc("fix")
      break
    case "s":
      appendLog(state.logs, "Syncing beads...", "dim")
      render()
      loadIssues()
      break
  }
}

export async function launch(
  model = "sonnet",
  budget = "5",
  opts?: { onboarding?: boolean },
): Promise<void> {
  // Check prerequisites
  const [gh, bd] = await Promise.all([checkCommand("gh"), checkCommand("bd")])
  if (!gh.found) {
    console.error(
      "Error: gh (GitHub CLI) not found. Install: https://cli.github.com",
    )
    console.error("  Or run: loop doctor --fix")
    process.exit(1)
  }
  if (!bd.found) {
    console.error(
      "Error: bd (beads) CLI not found. Install: npm install -g @beads/bd",
    )
    console.error("  Or run: loop doctor --fix")
    process.exit(1)
  }

  renderer = await createCliRenderer({ exitOnCtrlC: true })
  state = createAppState(model, budget)

  renderer.keyInput.on("keypress", handleKeypress)

  // Initial render
  render()
  appendLog(state.logs, "Loading issues...", "dim")
  render()

  // Load issues
  await loadIssues()
  syncPipelineToSelection()

  if (opts?.onboarding) {
    appendLog(state.logs, "", "dim")
    appendLog(state.logs, "Welcome to Loop Command Center", "info")
    appendLog(state.logs, "\u2500".repeat(35), "dim")
    appendLog(state.logs, "j/k or \u2191/\u2193   Navigate issues", "dim")
    appendLog(state.logs, "d            Design phase", "dim")
    appendLog(state.logs, "b            Build phase", "dim")
    appendLog(state.logs, "r            Review phase", "dim")
    appendLog(state.logs, "R            Run full pipeline", "dim")
    appendLog(state.logs, "s            Sync issues", "dim")
    appendLog(state.logs, "q            Quit", "dim")
    appendLog(state.logs, "", "dim")
    appendLog(state.logs, "Select an issue and press R to run the full pipeline.", "info")
  }

  render()

  renderer.start()
}
