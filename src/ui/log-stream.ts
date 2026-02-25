import { Box, Text, ScrollBox, vstyles, type VNode } from "@opentui/core"

export interface LogLine {
  text: string
  type: "info" | "success" | "error" | "dim"
  timestamp?: string
}

export interface LogStreamState {
  lines: LogLine[]
  maxLines: number
  title: string
}

export function createLogStreamState(): LogStreamState {
  return {
    lines: [],
    maxLines: 500,
    title: "Output",
  }
}

function lineColor(type: LogLine["type"]): string {
  switch (type) {
    case "info":
      return "#cccccc"
    case "success":
      return "#00ff00"
    case "error":
      return "#ff4444"
    case "dim":
      return "#666666"
  }
}

export function LogStream(state: LogStreamState): VNode {
  const rows = state.lines.map((line, i) =>
    Box(
      { id: `log-${i}`, height: 1, paddingX: 1 },
      Text(
        {},
        ...(line.timestamp
          ? [vstyles.color("#555555", `${line.timestamp} `)]
          : []),
        vstyles.color(lineColor(line.type), line.text),
      ),
    ),
  )

  return Box(
    {
      id: "log-stream-panel",
      flexGrow: 1,
      flexDirection: "column",
      border: true,
      borderStyle: "rounded",
      borderColor: "#555555",
      title: ` ${state.title} `,
      titleAlignment: "left",
    },
    ScrollBox(
      {
        scrollY: true,
        stickyScroll: true,
        stickyStart: "bottom",
      },
      ...(rows.length > 0
        ? rows
        : [
            Box(
              { paddingX: 1, paddingY: 1 },
              Text({ content: "Waiting for output...", fg: "#555555" }),
            ),
          ]),
    ),
  )
}

export function appendLog(
  state: LogStreamState,
  text: string,
  type: LogLine["type"] = "info",
): void {
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  state.lines.push({ text, type, timestamp })
  if (state.lines.length > state.maxLines) {
    state.lines.splice(0, state.lines.length - state.maxLines)
  }
}

export function clearLog(state: LogStreamState): void {
  state.lines = []
}
