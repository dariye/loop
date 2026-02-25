# Loop

One command turns a GitHub issue into a tested, reviewed pull request.

```
Issue #42 ──▶ Design ──▶ Build ──▶ Review ──▶ Done
                                      │
                                    (fail)
                                      │
                                      ▼
                                     Fix ──▶ Review  (up to 3 rounds)
```

Loop dispatches Claude Code on GitHub Actions through four phases — design, build, review, fix — and chains them automatically.

## Quick Start

```bash
# Get started
loop mount
```

The dashboard walks you through setup and lands you in the interactive command center.

Or set up manually:

```bash
# 1. Install the workflow
npx @dariye/loop install

# 2. Add your API key
gh secret set ANTHROPIC_API_KEY
gh secret set LOOP_PAT           # optional: enables auto-chaining

# 3. Ship it
loop run 42
```

## How It Works

```bash
loop run 42           # Full pipeline: design → build → review → done
```

Or run individual phases:

```bash
loop design 42        # Explore codebase, produce design document
loop build 42         # Implement the design, open a PR
loop review 17        # Review PR against 6 criteria
loop fix 17           # Address review feedback, push fixes
```

## Commands

| Command | Description |
|---------|-------------|
| `loop mount [url\|path]` | Interactive setup wizard |
| `loop run <issue>` | Full pipeline with auto-chaining |
| `loop design <issue>` | Design phase only |
| `loop build <issue>` | Build phase only |
| `loop review <pr>` | Review phase only |
| `loop fix <pr>` | Fix phase only |
| `loop launch` | Interactive TUI dashboard |
| `loop status` | Show recent runs |
| `loop doctor [--fix]` | Check (and fix) dependencies |
| `loop install [--dev]` | Install workflow to repo |

### Options

```bash
loop --model opus run 42      # Use a specific Claude model
loop --budget 10 build 42     # Set max budget in USD
```

### TUI Dashboard

```bash
loop launch
```

```
┌──────────────────────────────────────────────────────────────────┐
│ ◉ Loop  Command Center                          model: sonnet    │
├────────────────────────┬─────────────────────────────────────────┤
│ Issues                 │ Pipeline             #42                │
│                        │                                         │
│ ▸ #42 Add auth flow   │  ✓ Design  ──────── complete            │
│   #43 Fix navbar      │  ⟳ Build   ──────── running             │
│   #44 Add dark mode   │  ○ Review  ──────── pending             │
│                        │  ○ Fix     ──────── pending             │
│ Epics                  │                                         │
│   #10 Auth system      ├─────────────────────────────────────────┤
│                        │ Output                                  │
│                        │ 14:32:01 Dispatching build for #42...   │
│                        │ 14:32:03 Started run 12345678           │
├────────────────────────┴─────────────────────────────────────────┤
│ [d]esign [b]uild [r]eview [f]ix [R]un all [s]ync [q]uit         │
└──────────────────────────────────────────────────────────────────┘
```

**Keybindings:** `j/k` navigate | `d` design | `b` build | `r` review | `f` fix | `R` run all | `s` sync | `q` quit

## Architecture

```
YOU (Mission Control)           GITHUB ACTIONS (Launch Pad)
┌──────────────────┐            ┌──────────────────────────┐
│  loop CLI / TUI  │──dispatch──▶  Claude Code (Spacecraft) │
│                  │◀─telemetry──│  design → comment        │
└──────────────────┘            │  build  → PR              │
                                │  review → approval        │
                                │  fix    → commit          │
                                └──────────────────────────┘
```

**Mission Control** (your terminal) dispatches flight plans to the **Launch Pad** (GitHub Actions), where the **Spacecraft** (Claude Code) executes each phase and reports back via telemetry (issues, PRs, labels, comments).

### Inside a Workflow Run

Each `loop.yml` dispatch runs this sequence on GitHub Actions:

```
┌─ loop.yml ──────────────────────────────────────────────┐
│                                                          │
│  1. Validate inputs          (phase + issue/pr check)    │
│  2. Checkout repo            (full git history)          │
│  3. Install Claude Code      (npm -g)                    │
│  4. Fetch context            (issue, PR, design, epic)   │
│  5. Resolve prompt           (.loop/<phase>.md or default)│
│  6. Run Claude Code          (scoped tools per phase)    │
│  7. Post artifacts           (comment / PR / review)     │
│  8. Auto-chain               (→ next phase if chain=true)│
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Flight plans** are GitHub issues. Each phase runs with scoped permissions:

| Phase | Access | Output |
|-------|--------|--------|
| Design | Read-only | Issue comment with design doc |
| Build | Full edit | Branch + PR |
| Review | Read-only | PR review (approve or request changes) |
| Fix | Full edit | Commits pushed to PR branch |

### Auto-Chaining

`loop run` chains phases automatically:

```
design → build → review → (pass) done
                         → (fail) fix → review → ...
```

The fix/review loop runs up to 3 rounds (configurable via `max_fix_rounds`).

Auto-chaining requires the `LOOP_PAT` secret because `GITHUB_TOKEN` cannot trigger `workflow_dispatch` events.

## Customization

Override the default prompts for any phase by creating files in your repo:

```
.loop/
├── design.md
├── build.md
├── review.md
└── fix.md
```

Loop checks for `.loop/<phase>.md` first and falls back to built-in defaults.

### Epic Convention

Link issues to an epic with labels:

```bash
bd label 42 epic:10      # Issue #42 belongs to epic #10
```

The design and build phases automatically include epic context.

## Prerequisites

- [Bun](https://bun.sh) — runtime
- [GitHub CLI](https://cli.github.com/) (`gh`) — authenticated
- [beads](https://github.com/dariye/beads) (`bd`) — local issue management

Run `loop doctor` to verify everything is set up, or `loop doctor --fix` to auto-install missing tools.

## License

MIT
