import { Box, Text, vstyles, type VNode } from "@opentui/core"

export interface ToolbarAction {
  key: string
  label: string
}

const defaultActions: ToolbarAction[] = [
  { key: "d", label: "design" },
  { key: "b", label: "build" },
  { key: "r", label: "review" },
  { key: "f", label: "fix" },
  { key: "R", label: "Run all" },
  { key: "s", label: "sync" },
  { key: "q", label: "quit" },
]

export function Toolbar(actions: ToolbarAction[] = defaultActions): VNode {
  const items = actions.map((a) =>
    Text(
      { id: `toolbar-${a.key}` },
      vstyles.bold(vstyles.color("#ffff00", `[${a.key}]`)),
      vstyles.color("#aaaaaa", `${a.label} `),
    ),
  )

  return Box(
    {
      id: "toolbar",
      height: 1,
      width: "100%",
      flexDirection: "row",
      gap: 1,
      paddingX: 1,
    },
    ...items,
  )
}
