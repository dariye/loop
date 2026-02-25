import { describe, test, expect } from "bun:test";
import {
  createIssueListState,
  moveSelection,
  getSelectedIssue,
  type IssueItem,
} from "./issue-list.ts";

const items: IssueItem[] = [
  { id: "1", title: "First", labels: ["loop:designed"], status: "open" },
  { id: "2", title: "Second", labels: [], status: "in-progress" },
  { id: "3", title: "Third", labels: ["loop:built"], status: "closed" },
];

describe("createIssueListState", () => {
  test("returns empty defaults", () => {
    const state = createIssueListState();
    expect(state.issues).toEqual([]);
    expect(state.epics).toEqual([]);
    expect(state.selectedIndex).toBe(0);
  });
});

describe("moveSelection", () => {
  test("moves down", () => {
    const state = createIssueListState();
    state.issues = items;
    moveSelection(state, 1);
    expect(state.selectedIndex).toBe(1);
  });

  test("moves up", () => {
    const state = createIssueListState();
    state.issues = items;
    state.selectedIndex = 2;
    moveSelection(state, -1);
    expect(state.selectedIndex).toBe(1);
  });

  test("clamps at top", () => {
    const state = createIssueListState();
    state.issues = items;
    state.selectedIndex = 0;
    moveSelection(state, -1);
    expect(state.selectedIndex).toBe(0);
  });

  test("clamps at bottom", () => {
    const state = createIssueListState();
    state.issues = items;
    state.selectedIndex = 2;
    moveSelection(state, 1);
    expect(state.selectedIndex).toBe(2);
  });

  test("spans issues and epics", () => {
    const state = createIssueListState();
    state.issues = [items[0]];
    state.epics = [items[1]];
    state.selectedIndex = 0;
    moveSelection(state, 1);
    expect(state.selectedIndex).toBe(1);
  });

  test("no-op on empty list", () => {
    const state = createIssueListState();
    moveSelection(state, 1);
    expect(state.selectedIndex).toBe(0);
  });
});

describe("getSelectedIssue", () => {
  test("returns correct item from issues", () => {
    const state = createIssueListState();
    state.issues = items;
    state.selectedIndex = 1;
    expect(getSelectedIssue(state)).toEqual(items[1]);
  });

  test("returns item from epics when index past issues", () => {
    const state = createIssueListState();
    state.issues = [items[0]];
    state.epics = [items[1], items[2]];
    state.selectedIndex = 2;
    expect(getSelectedIssue(state)).toEqual(items[2]);
  });

  test("returns undefined for empty state", () => {
    const state = createIssueListState();
    expect(getSelectedIssue(state)).toBeUndefined();
  });
});
