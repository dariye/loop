import { describe, test, expect } from "bun:test";
import { createPipelineState, updateDiscStatus } from "./pipeline.ts";

describe("createPipelineState", () => {
  test("returns defaults", () => {
    const state = createPipelineState();
    expect(state.issueId).toBeNull();
    expect(state.issueTitle).toBe("");
    expect(state.discs).toHaveLength(4);
    expect(state.discs.map((d) => d.phase)).toEqual([
      "design",
      "build",
      "review",
      "fix",
    ]);
    expect(state.discs.every((d) => d.status === "pending")).toBe(true);
  });
});

describe("updateDiscStatus", () => {
  test("updates status of a phase", () => {
    const state = createPipelineState();
    updateDiscStatus(state, "build", "running");
    expect(state.discs[1].status).toBe("running");
    expect(state.discs[1].runId).toBeUndefined();
  });

  test("updates status and runId", () => {
    const state = createPipelineState();
    updateDiscStatus(state, "design", "complete", "12345");
    expect(state.discs[0].status).toBe("complete");
    expect(state.discs[0].runId).toBe("12345");
  });

  test("no-op for unknown phase", () => {
    const state = createPipelineState();
    updateDiscStatus(state, "unknown" as any, "running");
    expect(state.discs.every((d) => d.status === "pending")).toBe(true);
  });

  test("preserves other phases", () => {
    const state = createPipelineState();
    updateDiscStatus(state, "design", "complete");
    updateDiscStatus(state, "review", "failed");
    expect(state.discs[0].status).toBe("complete");
    expect(state.discs[1].status).toBe("pending");
    expect(state.discs[2].status).toBe("failed");
    expect(state.discs[3].status).toBe("pending");
  });
});
