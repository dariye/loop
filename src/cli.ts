import { install } from "./install.ts";
import { publish } from "./publish.ts";
import { dispatch } from "./dispatch.ts";
import { status } from "./status.ts";
import { doctor } from "./doctor.ts";

const USAGE = `
loop — AI-powered issue-to-PR pipeline

Usage:
  loop mount [url|path]     Interactive setup wizard for a project
  loop install [--dev]      Install workflow (--dev: full contributor setup)
  loop doctor [--fix]       Check dependencies (--fix: auto-install missing)
  loop launch               Open interactive TUI dashboard
  loop status               Show recent runs, issues, and PRs

  loop design <issue>       Publish issue to GitHub + dispatch design phase
  loop build  <issue>       Publish issue to GitHub + dispatch build phase
  loop review <pr>          Dispatch review phase for a PR
  loop fix    <pr>          Dispatch fix phase for a PR

  loop run    <issue>       Full pipeline: design → build → review (auto-chain)

Options:
  --model <model>           Claude model to use (default: sonnet)
  --budget <n>              Max dollar budget for the run (default: 5)
  --help                    Show this help message
`.trim();

interface ParsedArgs {
  command: string;
  positional: string | undefined;
  model: string;
  budget: string;
  fix: boolean;
  dev: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip bun and script path

  let model = "sonnet";
  let budget = "5";
  let fix = false;
  let dev = false;
  const rest: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && i + 1 < args.length) {
      model = args[++i];
    } else if (args[i] === "--budget" && i + 1 < args.length) {
      budget = args[++i];
    } else if (args[i] === "--fix") {
      fix = true;
    } else if (args[i] === "--dev") {
      dev = true;
    } else {
      rest.push(args[i]);
    }
  }

  return {
    command: rest[0] ?? "",
    positional: rest[1],
    model,
    budget,
    fix,
    dev,
  };
}

export async function main(): Promise<void> {
  const { command, positional, model, budget, fix, dev } = parseArgs(
    process.argv,
  );

  switch (command) {
    case "mount": {
      const { mount } = await import("./mount.ts");
      await mount({ target: positional });
      break;
    }

    case "install": {
      await install({ dev });
      break;
    }

    case "doctor": {
      await doctor(fix);
      break;
    }

    case "launch": {
      const { launch } = await import("./ui/app.ts");
      await launch(model, budget);
      break;
    }

    case "status": {
      await status();
      break;
    }

    case "design": {
      if (!positional) {
        console.error("Error: loop design requires an <issue> argument\n  Try: loop design LOOP-1");
        process.exit(1);
      }
      const ghNum = await publish(positional);
      await dispatch({
        disc: "design",
        issue: String(ghNum),
        model,
        budget,
      });
      break;
    }

    case "build": {
      if (!positional) {
        console.error("Error: loop build requires an <issue> argument\n  Try: loop build LOOP-1");
        process.exit(1);
      }
      const ghNum = await publish(positional);
      await dispatch({
        disc: "build",
        issue: String(ghNum),
        model,
        budget,
      });
      break;
    }

    case "review": {
      if (!positional) {
        console.error("Error: loop review requires a <pr> argument\n  Try: loop review 17");
        process.exit(1);
      }
      await dispatch({
        disc: "review",
        pr: positional,
        model,
        budget,
      });
      break;
    }

    case "fix": {
      if (!positional) {
        console.error("Error: loop fix requires a <pr> argument\n  Try: loop fix 17");
        process.exit(1);
      }
      await dispatch({
        disc: "fix",
        pr: positional,
        model,
        budget,
      });
      break;
    }

    case "run": {
      if (!positional) {
        console.error("Error: loop run requires an <issue> argument\n  Try: loop run LOOP-1");
        process.exit(1);
      }
      const ghNum = await publish(positional);
      await dispatch({
        disc: "design",
        issue: String(ghNum),
        chain: true,
        model,
        budget,
      });
      break;
    }

    case "--help":
    case "help":
    case "": {
      console.log(USAGE);
      break;
    }

    default: {
      console.error(`Unknown command: ${command}\n  Try: loop --help`);
      process.exit(1);
    }
  }
}
