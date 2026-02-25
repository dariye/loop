import { describe, test, expect, beforeEach, spyOn, afterEach } from "bun:test";
import {
  expectCommand,
  resetMockShell,
} from "../test/helpers/mock-shell.ts";
import { dispatch } from "./dispatch.ts";

let sleepSpy: ReturnType<typeof spyOn>;
let logSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  resetMockShell();
  sleepSpy = spyOn(Bun, "sleep").mockResolvedValue(undefined as any);
  logSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  sleepSpy.mockRestore();
  logSpy.mockRestore();
});

describe("dispatch validation", () => {
  test("design requires issue", () => {
    expect(dispatch({ disc: "design" })).rejects.toThrow(
      '"design" phase requires an issue number',
    );
  });

  test("build requires issue", () => {
    expect(dispatch({ disc: "build" })).rejects.toThrow(
      '"build" phase requires an issue number',
    );
  });

  test("review requires pr", () => {
    expect(dispatch({ disc: "review" })).rejects.toThrow(
      '"review" phase requires a PR number',
    );
  });

  test("fix requires pr", () => {
    expect(dispatch({ disc: "fix" })).rejects.toThrow(
      '"fix" phase requires a PR number',
    );
  });
});

describe("dispatch execution", () => {
  test("design with issue sends correct args", async () => {
    expectCommand(
      [
        "gh", "workflow", "run", "loop.yml",
        "-f", "disc=design",
        "-f", "issue=42",
      ],
      { stdout: "" },
    );
    expectCommand(
      [
        "gh", "run", "list",
        "--workflow=loop.yml", "--limit=1",
        "--json", "databaseId",
      ],
      { stdout: JSON.stringify([{ databaseId: 99999 }]) },
    );

    const runId = await dispatch({ disc: "design", issue: "42" });
    expect(runId).toBe("99999");
    expect(sleepSpy).toHaveBeenCalledWith(2000);
  });

  test("review with pr sends correct args", async () => {
    expectCommand(
      [
        "gh", "workflow", "run", "loop.yml",
        "-f", "disc=review",
        "-f", "pr=7",
      ],
      { stdout: "" },
    );
    expectCommand(
      [
        "gh", "run", "list",
        "--workflow=loop.yml", "--limit=1",
        "--json", "databaseId",
      ],
      { stdout: JSON.stringify([{ databaseId: 55555 }]) },
    );

    const runId = await dispatch({ disc: "review", pr: "7" });
    expect(runId).toBe("55555");
  });

  test("chain flag included", async () => {
    expectCommand(
      [
        "gh", "workflow", "run", "loop.yml",
        "-f", "disc=design",
        "-f", "issue=1",
        "-f", "chain=true",
      ],
      { stdout: "" },
    );
    expectCommand(
      [
        "gh", "run", "list",
        "--workflow=loop.yml", "--limit=1",
        "--json", "databaseId",
      ],
      { stdout: JSON.stringify([{ databaseId: 1 }]) },
    );

    await dispatch({ disc: "design", issue: "1", chain: true });
  });

  test("model and budget flags included", async () => {
    expectCommand(
      [
        "gh", "workflow", "run", "loop.yml",
        "-f", "disc=build",
        "-f", "issue=3",
        "-f", "model=opus",
        "-f", "budget=20",
      ],
      { stdout: "" },
    );
    expectCommand(
      [
        "gh", "run", "list",
        "--workflow=loop.yml", "--limit=1",
        "--json", "databaseId",
      ],
      { stdout: JSON.stringify([{ databaseId: 777 }]) },
    );

    await dispatch({
      disc: "build",
      issue: "3",
      model: "opus",
      budget: "20",
    });
  });

  test("throws when no run found", async () => {
    expectCommand(
      [
        "gh", "workflow", "run", "loop.yml",
        "-f", "disc=design",
        "-f", "issue=1",
      ],
      { stdout: "" },
    );
    expectCommand(
      [
        "gh", "run", "list",
        "--workflow=loop.yml", "--limit=1",
        "--json", "databaseId",
      ],
      { stdout: "[]" },
    );

    expect(
      dispatch({ disc: "design", issue: "1" }),
    ).rejects.toThrow("Could not find the dispatched workflow run\n  Try: gh run list --workflow=loop.yml");
  });
});
