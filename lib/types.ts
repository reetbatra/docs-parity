import type { Mismatch, Severity } from "./schema";

export type { Mismatch, Severity };

/** Metadata about the GitHub repository we analyzed. */
export interface RepoMeta {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  branch: string;
  description: string | null;
  stars: number;
  language: string | null;
}

/** A single source file pulled from the repo. */
export interface SourceFile {
  path: string;
  url: string;
  content: string;
  size: number;
}

/** A symbol extracted from the public API surface of the code. */
export interface ApiSymbol {
  kind:
    | "function"
    | "class"
    | "method"
    | "interface"
    | "type"
    | "enum"
    | "const"
    | "reexport"
    | "default";
  name: string;
  signature: string;
  doc?: string;
  file: string;
  line: number;
}

/** A single documentation page extracted by Firecrawl. */
export interface DocPage {
  url: string;
  title: string;
  markdown: string;
}

/** The two-field input that drives the whole pipeline. */
export interface AnalyzeInput {
  repoUrl: string;
  docsUrl: string;
}

/** The full, shareable report. This is what we persist and render. */
export interface DriftReport {
  id: string;
  createdAt: string;
  input: AnalyzeInput;
  repo: RepoMeta;
  docs: {
    url: string;
    pagesCrawled: number;
    source: string;
  };
  stats: {
    filesAnalyzed: number;
    symbolsExtracted: number;
    docPages: number;
  };
  files: { path: string; url: string }[];
  driftScore: number;
  scoreLabel: string;
  summary: string;
  mismatches: Mismatch[];
  model: string;
  durationMs: number;
}

/** Pipeline progress steps, in order. */
export const PIPELINE_STEPS = [
  "parse",
  "code",
  "extract",
  "docs",
  "analyze",
  "save",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export interface ProgressEvent {
  type: "progress";
  step: PipelineStep;
  status: "start" | "done";
  detail?: string;
}

export interface ReportEvent {
  type: "report";
  report: DriftReport;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type StreamEvent = ProgressEvent | ReportEvent | ErrorEvent;

export type ProgressCallback = (event: Omit<ProgressEvent, "type">) => void;
