import {
  Box,
  Text,
  ScrollBox,
  vstyles,
  type CliRenderer,
  type VNode,
} from "@opentui/core"

export interface IssueItem {
  id: string
  title: string
  labels: string[]
  status: string
}

export interface IssueListState {
  issues: IssueItem[]
  epics: IssueItem[]
  selectedIndex: number
}

export function createIssueListState(): IssueListState {
  return { issues: [], epics: [], selectedIndex: 0 }
}

function statusIcon(status: string): string {
  switch (status) {
    case "open":
      return "\u25cb"
    case "in-progress":
      return "\u25d0"
    case "closed":
      return "\u25cf"
    default:
      return "\u25cb"
  }
}

function hasLoopLabel(labels: string[], phase: string): boolean {
  return labels.some((l) => l === `loop:${phase}`)
}

function renderIssueRow(
  item: IssueItem,
  selected: boolean,
  index: number,
): VNode {
  const prefix = selected ? "\u25b8 " : "  "
  const icon = statusIcon(item.status)

  const phases = ["designed", "built", "reviewed", "fixed"]
  const phaseDots = phases
    .map((p) => (hasLoopLabel(item.labels, p) ? "\u25cf" : "\u25cb"))
    .join("")

  const fg = selected ? "#ffffff" : "#aaaaaa"

  return Box(
    {
      id: `issue-row-${index}`,
      height: 1,
      width: "100%",
      flexDirection: "row",
      paddingX: 1,
    },
    Text(
      { fg },
      vstyles.color(selected ? "#ffff00" : "#666666", prefix),
      vstyles.color("#888888", `${icon} `),
      vstyles.color(fg, `#${item.id} `),
      vstyles.color(fg, item.title.slice(0, 30)),
      vstyles.color("#555555", ` ${phaseDots}`),
    ),
  )
}

export function IssueList(
  state: IssueListState,
): VNode {
  const issueRows = state.issues.map((item, i) =>
    renderIssueRow(item, i === state.selectedIndex, i),
  )

  const epicRows = state.epics.map((item, i) =>
    renderIssueRow(
      item,
      i + state.issues.length === state.selectedIndex,
      i + state.issues.length,
    ),
  )

  return Box(
    {
      id: "issue-list-panel",
      width: "30%",
      minWidth: 25,
      flexShrink: 0,
      flexDirection: "column",
      border: true,
      borderStyle: "rounded",
      borderColor: "#555555",
      title: " Issues ",
      titleAlignment: "left",
    },
    ScrollBox(
      {
        scrollY: true,
        stickyScroll: false,
      },
      ...issueRows,
      ...(epicRows.length > 0
        ? [
            Box(
              { height: 1, paddingX: 1 },
              Text({ content: "Epics", fg: "#888888" }),
            ),
            ...epicRows,
          ]
        : []),
    ),
  )
}

export function moveSelection(state: IssueListState, delta: number): void {
  const total = state.issues.length + state.epics.length
  if (total === 0) return
  state.selectedIndex = Math.max(
    0,
    Math.min(total - 1, state.selectedIndex + delta),
  )
}

export function getSelectedIssue(
  state: IssueListState,
): IssueItem | undefined {
  const all = [...state.issues, ...state.epics]
  return all[state.selectedIndex]
}
