import { resolve } from "path";

async function gitRoot(): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error("Not inside a git repository");
  }
  return out.trim();
}

async function confirm(question: string): Promise<boolean> {
  process.stdout.write(`${question} [y/N] `);
  for await (const line of console) {
    const answer = line.trim().toLowerCase();
    return answer === "y" || answer === "yes";
  }
  return false;
}

/**
 * Install the loop.yml workflow file into .github/workflows/.
 * Returns the path to the installed file.
 */
export async function installWorkflow(root: string): Promise<string> {
  const targetDir = resolve(root, ".github", "workflows");
  const targetPath = resolve(targetDir, "loop.yml");

  const packageRoot = resolve(import.meta.dir, "..");
  const templatePath = resolve(packageRoot, "install", "loop.yml");

  const templateFile = Bun.file(templatePath);
  if (!(await templateFile.exists())) {
    throw new Error(`Template not found at ${templatePath}`);
  }

  // Ensure .github/workflows directory exists
  const mkdirProc = Bun.spawn(["mkdir", "-p", targetDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await mkdirProc.exited;

  const content = await templateFile.text();
  await Bun.write(targetPath, content);

  return targetPath;
}

/**
 * Ensure .loop/ directory exists. Returns the path to the directory.
 */
export async function ensureLoopDir(root: string): Promise<string> {
  const loopDir = resolve(root, ".loop");
  const mkProc = Bun.spawn(["mkdir", "-p", loopDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await mkProc.exited;
  // Create .gitkeep if it doesn't exist
  const gitkeep = resolve(loopDir, ".gitkeep");
  const file = Bun.file(gitkeep);
  if (!(await file.exists())) {
    await Bun.write(gitkeep, "");
  }
  return loopDir;
}

/**
 * Ensure .claude/skills/ directory exists. Returns the path to the directory.
 */
export async function ensureSkillsDir(root: string): Promise<string> {
  const skillsDir = resolve(root, ".claude", "skills");
  const mkProc = Bun.spawn(["mkdir", "-p", skillsDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await mkProc.exited;
  return skillsDir;
}

/**
 * Install all loop skill folders from package skills/ to .claude/skills/.
 * Returns the list of installed skill names.
 */
export async function installSkills(root: string): Promise<string[]> {
  const skillsDir = await ensureSkillsDir(root);
  const packageRoot = resolve(import.meta.dir, "..");
  const phases = ["loop-design", "loop-build", "loop-review", "loop-fix"];
  const installed: string[] = [];

  for (const skill of phases) {
    const srcDir = resolve(packageRoot, "skills", skill);
    const srcPath = resolve(srcDir, "SKILL.md");
    const srcFile = Bun.file(srcPath);
    if (!(await srcFile.exists())) continue;

    const destDir = resolve(skillsDir, skill);
    const mkProc = Bun.spawn(["mkdir", "-p", destDir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await mkProc.exited;

    const content = await srcFile.text();
    await Bun.write(resolve(destDir, "SKILL.md"), content);

    // Copy criteria/ subdirectory if it exists (e.g., loop-review)
    const criteriaDir = resolve(srcDir, "criteria");
    const lsProc = Bun.spawn(["ls", criteriaDir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const lsOut = await new Response(lsProc.stdout).text();
    const lsCode = await lsProc.exited;
    if (lsCode === 0 && lsOut.trim().length > 0) {
      const destCriteriaDir = resolve(destDir, "criteria");
      const mkCriteriaProc = Bun.spawn(["mkdir", "-p", destCriteriaDir], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await mkCriteriaProc.exited;

      for (const filename of lsOut.trim().split("\n")) {
        if (!filename.endsWith(".md")) continue;
        const critSrc = Bun.file(resolve(criteriaDir, filename));
        if (await critSrc.exists()) {
          const critContent = await critSrc.text();
          await Bun.write(resolve(destCriteriaDir, filename), critContent);
        }
      }
    }

    installed.push(skill);
  }

  return installed;
}

export async function install(opts?: { dev?: boolean }): Promise<void> {
  const root = await gitRoot();

  const targetPath = resolve(root, ".github", "workflows", "loop.yml");
  const targetFile = Bun.file(targetPath);
  if (await targetFile.exists()) {
    const overwrite = await confirm(
      `${targetPath} already exists. Overwrite?`
    );
    if (!overwrite) {
      console.log("Aborted.");
      return;
    }
  }

  const installed = await installWorkflow(root);
  console.log(`Installed workflow to ${installed}`);

  if (opts?.dev) {
    // Dev mode: full contributor setup
    console.log("\nRunning contributor setup...\n");

    // Install dependencies
    console.log("Installing dependencies...");
    const installProc = Bun.spawn(["bun", "install"], {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "inherit",
      stderr: "inherit",
    });
    await installProc.exited;

    // Link for global dev access
    console.log("\nLinking loop globally...");
    const linkProc = Bun.spawn(["bun", "link"], {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "inherit",
      stderr: "inherit",
    });
    await linkProc.exited;

    // Create .loop/ directory for config
    const loopDir = await ensureLoopDir(root);
    console.log(`\nCreated ${loopDir}/`);

    // Install skills
    const skills = await installSkills(root);
    console.log(`Installed ${skills.length} skills to .claude/skills/`);

    console.log("\nDev setup complete!");
    console.log();
    console.log("Next steps:");
    console.log("  1. Run: bun bin/loop.ts doctor     — verify environment");
    console.log("  2. Run: bun bin/loop.ts --help      — see all commands");
    console.log("  3. Edit skills in .claude/skills/ to customize prompts");
  } else {
    console.log();
    console.log("Next steps:");
    console.log(
      "  1. Add ANTHROPIC_API_KEY as a repository secret",
    );
    console.log(
      "  2. Optionally add LOOP_PAT (a GitHub PAT) for chaining workflow dispatches",
    );
    console.log("  3. Commit and push the workflow file");
  }
}
