import { describe, it, expect } from "vitest";
import {
  buildIssueUrl,
  mismatchToMarkdown,
  reportToIssueMarkdown,
} from "../lib/github-issue";
import type { DriftReport, Mismatch } from "../lib/types";

const mismatch: Mismatch = {
  title: "createClient signature changed",
  code_snippet: "export function createClient(options: Options): Client",
  docs_snippet: "createClient(url)",
  description: "The docs pass a URL string but the code expects an Options object.",
  suggested_fix: "Update the docs to pass an Options object.",
  severity: "high",
  confidence: 0.92,
  file: "src/index.ts",
};

const report: DriftReport = {
  id: "abc123",
  createdAt: new Date().toISOString(),
  input: { repoUrl: "https://github.com/acme/lib", docsUrl: "https://acme.dev/docs" },
  repo: {
    owner: "acme",
    repo: "lib",
    fullName: "acme/lib",
    url: "https://github.com/acme/lib",
    defaultBranch: "main",
    branch: "main",
    description: null,
    stars: 10,
    language: "TypeScript",
  },
  docs: { url: "https://acme.dev/docs", pagesCrawled: 3, source: "scrape + crawl" },
  stats: { filesAnalyzed: 5, symbolsExtracted: 20, docPages: 3 },
  files: [],
  driftScore: 6.4,
  scoreLabel: "Notable drift",
  summary: "Several signatures have drifted.",
  mismatches: [mismatch],
  model: "claude-opus-4-8",
  durationMs: 12000,
};

describe("mismatchToMarkdown", () => {
  it("includes the code, docs, and suggested fix", () => {
    const md = mismatchToMarkdown(mismatch);
    expect(md).toContain("createClient signature changed");
    expect(md).toContain("export function createClient");
    expect(md).toContain("createClient(url)");
    expect(md).toContain("Update the docs");
    expect(md).toContain("src/index.ts");
  });
});

describe("reportToIssueMarkdown", () => {
  it("includes the drift score, severity counts, and repo/docs links", () => {
    const md = reportToIssueMarkdown(report);
    expect(md).toContain("6.4/10");
    expect(md).toContain("1 high");
    expect(md).toContain("https://github.com/acme/lib");
    expect(md).toContain("https://acme.dev/docs");
  });
});

describe("buildIssueUrl", () => {
  it("builds a prefilled new-issue URL for the whole report", () => {
    const url = buildIssueUrl(report);
    expect(url.startsWith("https://github.com/acme/lib/issues/new?")).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("labels")).toBe("documentation");
    expect(parsed.searchParams.get("title")).toContain("documentation mismatches");
    expect(parsed.searchParams.get("body")).toContain("createClient");
  });

  it("builds a focused issue for a single mismatch", () => {
    const url = buildIssueUrl(report, mismatch);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("title")).toBe(
      "docs: createClient signature changed",
    );
    expect(parsed.searchParams.get("body")).toContain("createClient(url)");
  });
});
