import { describe, test, expect, beforeEach } from "bun:test";
import {
  expectCommand,
  resetMockShell,
} from "../test/helpers/mock-shell.ts";
import { show, list, label, update, comments } from "./beads.ts";

beforeEach(() => {
  resetMockShell();
});

describe("show", () => {
  test("parses JSON response", async () => {
    const issue = {
      id: "LOOP-1",
      title: "Test",
      body: "Body",
      status: "open",
      labels: ["gh:5"],
    };
    expectCommand(["bd", "show", "LOOP-1", "--json"], {
      stdout: JSON.stringify(issue),
    });
    const result = await show("LOOP-1");
    expect(result).toEqual(issue);
  });

  test("throws on bd failure", async () => {
    expectCommand(["bd", "show", "LOOP-99", "--json"], {
      exitCode: 1,
      stderr: "issue not found",
    });
    expect(show("LOOP-99")).rejects.toThrow("failed");
  });
});

describe("comments", () => {
  test("parses comment array", async () => {
    const cmts = [
      { id: "c-1", body: "Hello", author: "user", created: "2025-01-01T00:00:00Z" },
    ];
    expectCommand(["bd", "comments", "LOOP-1", "--json"], {
      stdout: JSON.stringify(cmts),
    });
    const result = await comments("LOOP-1");
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe("Hello");
  });
});

describe("list", () => {
  test("returns issues", async () => {
    const issues = [
      { id: "LOOP-1", title: "A", body: "", status: "open", labels: [] },
    ];
    expectCommand(["bd", "list", "--json"], {
      stdout: JSON.stringify(issues),
    });
    const result = await list();
    expect(result).toHaveLength(1);
  });

  test("passes parent filter", async () => {
    expectCommand(["bd", "list", "--json", "--parent", "E-1"], {
      stdout: "[]",
    });
    const result = await list({ parent: "E-1" });
    expect(result).toEqual([]);
  });

  test("passes status filter", async () => {
    expectCommand(["bd", "list", "--json", "--status", "open"], {
      stdout: "[]",
    });
    const result = await list({ status: "open" });
    expect(result).toEqual([]);
  });

  test("passes both filters", async () => {
    expectCommand(
      ["bd", "list", "--json", "--parent", "E-1", "--status", "open"],
      { stdout: "[]" },
    );
    const result = await list({ parent: "E-1", status: "open" });
    expect(result).toEqual([]);
  });
});

describe("label", () => {
  test("passes labels to bd", async () => {
    expectCommand(["bd", "label", "LOOP-1", "bug", "urgent"], {
      stdout: "",
    });
    await label("LOOP-1", ["bug", "urgent"]);
  });
});

describe("update", () => {
  test("passes field flags", async () => {
    expectCommand(
      ["bd", "update", "LOOP-1", "--status", "closed", "--title", "New"],
      { stdout: "" },
    );
    await update("LOOP-1", { status: "closed", title: "New" });
  });
});
