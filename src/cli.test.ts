import { describe, test, expect } from "bun:test";
import { parseArgs } from "./cli.ts";

describe("parseArgs", () => {
  test("defaults when no args", () => {
    const result = parseArgs(["bun", "loop.ts"]);
    expect(result).toEqual({
      command: "",
      positional: undefined,
      model: "sonnet",
      budget: "5",
      fix: false,
      dev: false,
    });
  });

  test("parses command", () => {
    const result = parseArgs(["bun", "loop.ts", "doctor"]);
    expect(result.command).toBe("doctor");
    expect(result.positional).toBeUndefined();
  });

  test("parses command + positional", () => {
    const result = parseArgs(["bun", "loop.ts", "design", "LOOP-1"]);
    expect(result.command).toBe("design");
    expect(result.positional).toBe("LOOP-1");
  });

  test("parses --model flag", () => {
    const result = parseArgs(["bun", "loop.ts", "build", "42", "--model", "opus"]);
    expect(result.model).toBe("opus");
    expect(result.command).toBe("build");
    expect(result.positional).toBe("42");
  });

  test("parses --budget flag", () => {
    const result = parseArgs(["bun", "loop.ts", "run", "1", "--budget", "10"]);
    expect(result.budget).toBe("10");
  });

  test("parses --fix flag", () => {
    const result = parseArgs(["bun", "loop.ts", "doctor", "--fix"]);
    expect(result.fix).toBe(true);
    expect(result.command).toBe("doctor");
  });

  test("parses --dev flag", () => {
    const result = parseArgs(["bun", "loop.ts", "install", "--dev"]);
    expect(result.dev).toBe(true);
    expect(result.command).toBe("install");
  });

  test("parses all flags combined", () => {
    const result = parseArgs([
      "bun",
      "loop.ts",
      "design",
      "LOOP-5",
      "--model",
      "haiku",
      "--budget",
      "20",
      "--fix",
      "--dev",
    ]);
    expect(result).toEqual({
      command: "design",
      positional: "LOOP-5",
      model: "haiku",
      budget: "20",
      fix: true,
      dev: true,
    });
  });
});
