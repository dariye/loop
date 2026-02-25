import { describe, test, expect } from "bun:test";
import { createLogStreamState, appendLog, clearLog } from "./log-stream.ts";

describe("createLogStreamState", () => {
  test("returns defaults", () => {
    const state = createLogStreamState();
    expect(state.lines).toEqual([]);
    expect(state.maxLines).toBe(500);
    expect(state.title).toBe("Output");
  });
});

describe("appendLog", () => {
  test("adds an entry", () => {
    const state = createLogStreamState();
    appendLog(state, "hello");
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].text).toBe("hello");
    expect(state.lines[0].type).toBe("info");
    expect(state.lines[0].timestamp).toBeDefined();
  });

  test("supports type parameter", () => {
    const state = createLogStreamState();
    appendLog(state, "fail!", "error");
    expect(state.lines[0].type).toBe("error");
  });

  test("trims to maxLines", () => {
    const state = createLogStreamState();
    state.maxLines = 3;
    for (let i = 0; i < 5; i++) {
      appendLog(state, `line ${i}`);
    }
    expect(state.lines).toHaveLength(3);
    expect(state.lines[0].text).toBe("line 2");
    expect(state.lines[2].text).toBe("line 4");
  });

  test("multiple appends accumulate", () => {
    const state = createLogStreamState();
    appendLog(state, "a", "info");
    appendLog(state, "b", "success");
    appendLog(state, "c", "dim");
    expect(state.lines).toHaveLength(3);
    expect(state.lines.map((l) => l.type)).toEqual(["info", "success", "dim"]);
  });
});

describe("clearLog", () => {
  test("empties lines", () => {
    const state = createLogStreamState();
    appendLog(state, "a");
    appendLog(state, "b");
    clearLog(state);
    expect(state.lines).toEqual([]);
  });

  test("clearing empty state is safe", () => {
    const state = createLogStreamState();
    clearLog(state);
    expect(state.lines).toEqual([]);
  });
});
