import { Box, Text, vstyles, type VNode } from "@opentui/core"

export type DiscPhase = "design" | "build" | "review" | "fix"
export type PhaseStatus = "pending" | "running" | "complete" | "failed" | "skipped"

export interface PipelineDisc {
  phase: DiscPhase
  status: PhaseStatus
  runId?: string
  duration?: string
}

export interface PipelineState {
  issueId: string | null
  issueTitle: string
  discs: PipelineDisc[]
}

export function createPipelineState(): PipelineState {
  return {
    issueId: null,
    issueTitle: "",
    discs: [
      { phase: "design", status: "pending" },
      { phase: "build", status: "pending" },
      { phase: "review", status: "pending" },
      { phase: "fix", status: "pending" },
    ],
  }
}

function statusIcon(status: PhaseStatus): string {
  switch (status) {
    case "pending":
      return "\u25cb"
    case "running":
      return "\u27f3"
    case "complete":
      return "\u2713"
    case "failed":
      return "\u2717"
    case "skipped":
      return "\u2500"
  }
}

function statusColor(status: PhaseStatus): string {
  switch (status) {
    case "pending":
      return "#666666"
    case "running":
      return "#ffff00"
    case "complete":
      return "#00ff00"
    case "failed":
      return "#ff4444"
    case "skipped":
      return "#555555"
  }
}

function phaseLabel(phase: DiscPhase): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}

function renderDiscRow(disc: PipelineDisc): VNode {
  const icon = statusIcon(disc.status)
  const color = statusColor(disc.status)
  const label = phaseLabel(disc.phase)
  const dots = "\u2500".repeat(12)
  const extra = disc.duration ? ` (${disc.duration})` : ""

  return Box(
    {
      id: `disc-${disc.phase}`,
      height: 1,
      width: "100%",
      flexDirection: "row",
      paddingX: 1,
    },
    Text(
      {},
      vstyles.color(color, `  ${icon} ${label}`),
      vstyles.color("#333333", `  ${dots}  `),
      vstyles.color(color, `${disc.status}${extra}`),
    ),
  )
}

export function Pipeline(state: PipelineState): VNode {
  const header = state.issueId
    ? `#${state.issueId} ${state.issueTitle}`
    : "No issue selected"

  return Box(
    {
      id: "pipeline-panel",
      flexGrow: 1,
      flexDirection: "column",
      border: true,
      borderStyle: "rounded",
      borderColor: "#555555",
      title: " Pipeline ",
      titleAlignment: "left",
    },
    Box(
      { height: 1, paddingX: 1 },
      Text({ content: header, fg: state.issueId ? "#ffffff" : "#666666" }),
    ),
    Box({ height: 1 }),
    ...state.discs.map(renderDiscRow),
  )
}

export function updateDiscStatus(
  state: PipelineState,
  phase: DiscPhase,
  status: PhaseStatus,
  runId?: string,
): void {
  const disc = state.discs.find((d) => d.phase === phase)
  if (disc) {
    disc.status = status
    if (runId) disc.runId = runId
  }
}
