import { describe, test, expect, spyOn, afterEach } from "bun:test";
import { formatStatus, formatAge } from "./status.ts";

describe("formatStatus", () => {
  test("completed success → green pass", () => {
    const result = formatStatus("completed", "success");
    expect(result).toContain("pass");
  });

  test("completed failure → red fail", () => {
    const result = formatStatus("completed", "failure");
    expect(result).toContain("fail");
  });

  test("completed cancelled → yellow cancelled", () => {
    const result = formatStatus("completed", "cancelled");
    expect(result).toContain("cancelled");
  });

  test("completed null → yellow unknown", () => {
    const result = formatStatus("completed", null);
    expect(result).toContain("unknown");
  });

  test("in_progress → cyan running", () => {
    const result = formatStatus("in_progress", null);
    expect(result).toContain("running");
  });

  test("queued → dim queued", () => {
    const result = formatStatus("queued", null);
    expect(result).toContain("queued");
  });

  test("unknown status → dim status text", () => {
    const result = formatStatus("waiting", null);
    expect(result).toContain("waiting");
  });
});

describe("formatAge", () => {
  let dateSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    dateSpy?.mockRestore();
  });

  test("minutes ago", () => {
    const now = new Date("2025-06-15T12:30:00Z").getTime();
    dateSpy = spyOn(Date, "now").mockReturnValue(now);
    expect(formatAge("2025-06-15T12:25:00Z")).toBe("5m ago");
  });

  test("zero minutes", () => {
    const now = new Date("2025-06-15T12:00:30Z").getTime();
    dateSpy = spyOn(Date, "now").mockReturnValue(now);
    expect(formatAge("2025-06-15T12:00:00Z")).toBe("0m ago");
  });

  test("hours ago", () => {
    const now = new Date("2025-06-15T15:00:00Z").getTime();
    dateSpy = spyOn(Date, "now").mockReturnValue(now);
    expect(formatAge("2025-06-15T12:00:00Z")).toBe("3h ago");
  });

  test("days ago", () => {
    const now = new Date("2025-06-17T12:00:00Z").getTime();
    dateSpy = spyOn(Date, "now").mockReturnValue(now);
    expect(formatAge("2025-06-15T12:00:00Z")).toBe("2d ago");
  });

  test("boundary: 59 minutes → minutes", () => {
    const now = new Date("2025-06-15T12:59:00Z").getTime();
    dateSpy = spyOn(Date, "now").mockReturnValue(now);
    expect(formatAge("2025-06-15T12:00:00Z")).toBe("59m ago");
  });

  test("boundary: 60 minutes → 1h", () => {
    const now = new Date("2025-06-15T13:00:00Z").getTime();
    dateSpy = spyOn(Date, "now").mockReturnValue(now);
    expect(formatAge("2025-06-15T12:00:00Z")).toBe("1h ago");
  });

  test("boundary: 23 hours → hours", () => {
    const now = new Date("2025-06-16T11:00:00Z").getTime();
    dateSpy = spyOn(Date, "now").mockReturnValue(now);
    expect(formatAge("2025-06-15T12:00:00Z")).toBe("23h ago");
  });

  test("boundary: 24 hours → 1d", () => {
    const now = new Date("2025-06-16T12:00:00Z").getTime();
    dateSpy = spyOn(Date, "now").mockReturnValue(now);
    expect(formatAge("2025-06-15T12:00:00Z")).toBe("1d ago");
  });
});
