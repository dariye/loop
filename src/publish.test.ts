import { describe, test, expect } from "bun:test";
import { findGhLabel, findEpicLabel } from "./publish.ts";

describe("findGhLabel", () => {
  test("extracts number from gh:N label", () => {
    expect(findGhLabel(["bug", "gh:42", "priority:high"])).toBe(42);
  });

  test("returns undefined when no gh label", () => {
    expect(findGhLabel(["bug", "priority:high"])).toBeUndefined();
  });

  test("picks first gh label", () => {
    expect(findGhLabel(["gh:10", "gh:20"])).toBe(10);
  });

  test("ignores partial matches", () => {
    expect(findGhLabel(["gh:abc", "gh:", "github:5"])).toBeUndefined();
  });

  test("handles empty array", () => {
    expect(findGhLabel([])).toBeUndefined();
  });
});

describe("findEpicLabel", () => {
  test("extracts epic ID", () => {
    expect(findEpicLabel(["epic:E-1", "bug"])).toBe("E-1");
  });

  test("returns undefined when no epic label", () => {
    expect(findEpicLabel(["bug", "gh:42"])).toBeUndefined();
  });

  test("handles complex epic IDs", () => {
    expect(findEpicLabel(["epic:PROJ-123-auth"])).toBe("PROJ-123-auth");
  });

  test("handles empty array", () => {
    expect(findEpicLabel([])).toBeUndefined();
  });
});
