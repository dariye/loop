import {
  createCliRenderer,
  Box,
  Text,
  Select,
  Input,
  vstyles,
  SelectRenderableEvents,
  InputRenderableEvents,
  type CliRenderer,
} from "@opentui/core"
import type { VNode } from "@opentui/core"

export interface WizardContext {
  renderer: CliRenderer
}

export async function createWizard(): Promise<WizardContext> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true })
  renderer.start()
  return { renderer }
}

export function destroyWizard(ctx: WizardContext): void {
  ctx.renderer.stop()
}

export function StepHeader(step: number, total: number, title: string): VNode {
  return Box(
    { flexDirection: "row", width: "100%", height: 1 },
    Text(
      {},
      vstyles.dim(`Step ${step}/${total}`),
      vstyles.dim(" — "),
      vstyles.bold(vstyles.color("#ffffff", title)),
    ),
  )
}

export function InfoBlock(entries: { label: string; value: string; icon?: string }[]): VNode {
  return Box(
    { flexDirection: "column", width: "100%", paddingX: 1 },
    ...entries.map((e) =>
      Box(
        { flexDirection: "row", height: 1 },
        Text(
          {},
          vstyles.color("#555555", e.icon ?? "·"),
          vstyles.dim(" "),
          vstyles.dim(e.label.padEnd(20)),
          vstyles.color("#00ffaa", e.value),
        ),
      ),
    ),
  )
}

export function promptSelect(
  ctx: WizardContext,
  step: number,
  total: number,
  title: string,
  options: { name: string; description: string }[],
): Promise<number> {
  return new Promise((resolve) => {
    const root = ctx.renderer.root
    for (const child of root.getChildren()) child.destroy()

    const select = Select({
      options,
      selectedIndex: 0,
      focusedTextColor: "#ffffff",
      focusedBackgroundColor: "#333333",
      showDescription: true,
      wrapSelection: true,
    })

    root.add(
      Box(
        { flexDirection: "column", width: "100%", paddingX: 2, paddingY: 1 },
        StepHeader(step, total, title),
        Box({ height: 1 }),
        select,
        Box({ height: 1 }),
        Text({}, vstyles.color("#555555", "↑/↓ navigate  Enter select")),
      ),
    )

    ;(select as any).on(SelectRenderableEvents.ITEM_SELECTED, (index: number) => {
      resolve(index)
    })
  })
}

export function promptConfirm(
  ctx: WizardContext,
  step: number,
  total: number,
  question: string,
  defaultYes = true,
): Promise<boolean> {
  const options = defaultYes
    ? [
        { name: "Yes", description: "Continue" },
        { name: "No", description: "Cancel" },
      ]
    : [
        { name: "No", description: "Cancel" },
        { name: "Yes", description: "Continue" },
      ]

  return promptSelect(ctx, step, total, question, options).then((index) => {
    return defaultYes ? index === 0 : index === 1
  })
}

export function promptText(
  ctx: WizardContext,
  step: number,
  total: number,
  label: string,
  defaultValue = "",
  placeholder?: string,
): Promise<string> {
  return new Promise((resolve) => {
    const root = ctx.renderer.root
    for (const child of root.getChildren()) child.destroy()

    const input = Input({
      value: defaultValue,
      placeholder: placeholder ?? "",
    })

    root.add(
      Box(
        { flexDirection: "column", width: "100%", paddingX: 2, paddingY: 1 },
        StepHeader(step, total, label),
        Box({ height: 1 }),
        Box(
          { flexDirection: "row", height: 1, width: "100%" },
          Text({}, vstyles.color("#888888", "› ")),
          Box(
            { border: true, borderStyle: "rounded", borderColor: "#00ffaa", minWidth: 30, height: 3, paddingX: 1 },
            input,
          ),
        ),
        Box({ height: 1 }),
        Text({}, vstyles.color("#555555", "Type your value and press Enter")),
      ),
    )

    ;(input as any).on(InputRenderableEvents.ENTER, () => {
      const value = (input as any).value || defaultValue
      resolve(value)
    })
  })
}

export function showStatus(
  ctx: WizardContext,
  title: string,
  lines: { icon: string; label: string; value: string }[],
): void {
  const root = ctx.renderer.root
  for (const child of root.getChildren()) child.destroy()

  root.add(
    Box(
      { flexDirection: "column", width: "100%", paddingX: 2, paddingY: 1 },
      Text({}, vstyles.bold(vstyles.color("#00ffaa", title))),
      Box({ height: 1 }),
      ...lines.map((l) =>
        Box(
          { flexDirection: "row", height: 1 },
          Text(
            {},
            vstyles.color(
              l.icon === "✓" ? "#00ff00" : l.icon === "✗" ? "#ff0000" : "#ffaa00",
              ` ${l.icon} `,
            ),
            vstyles.dim(l.label.padEnd(20)),
            vstyles.color("#ffffff", l.value),
          ),
        ),
      ),
    ),
  )
}
