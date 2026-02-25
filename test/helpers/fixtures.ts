import type { Issue, Comment } from "../../src/beads.ts";

export const sampleIssue: Issue = {
  id: "LOOP-1",
  title: "Add authentication",
  body: "We need user auth for the dashboard",
  status: "open",
  labels: ["gh:42", "epic:E-1"],
};

export const sampleIssueNoLabels: Issue = {
  id: "LOOP-2",
  title: "Fix navigation bug",
  body: "Nav breaks on mobile",
  status: "open",
  labels: [],
};

export const sampleEpic: Issue = {
  id: "E-1",
  title: "User Management Epic",
  body: "All user management features",
  status: "open",
  labels: [],
};

export const sampleComment: Comment = {
  id: "c-1",
  body: "Looks good, let's proceed",
  author: "reviewer",
  created: "2025-01-15T10:30:00Z",
};

export const ghIssueCreateResponse = JSON.stringify({ number: 99 });

export const ghIssueViewLabels = JSON.stringify({
  labels: [{ name: "loop:designed" }, { name: "bug" }],
});

export const ghRunListResponse = JSON.stringify([{ databaseId: 12345 }]);

export const ghSecretListResponse =
  "ANTHROPIC_API_KEY\tUpdated 2025-01-01\nLOOP_PAT\tUpdated 2025-01-01";
