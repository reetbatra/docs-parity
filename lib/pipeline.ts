import { nanoid } from "nanoid";
import { fetchRepoApiSurface } from "./github";
import { extractApiSurface, renderApiSurface } from "./extract";
import { extractPythonSurface } from "./extract-python";
import { getDocsContent, renderDocs } from "./firecrawl";
import { analyzeDrift } from "./analyze";
import { computeDriftScore, scoreLabel, sortMismatches } from "./drift";
import { computeCoverageScore } from "./coverage";
import { saveReport } from "./storage";
import type { AnalyzeInput, DriftReport, ProgressCallback } from "./types";

/**
 * The end-to-end pipeline: GitHub -> AST extraction -> Firecrawl -> Claude ->
 * score -> persist. Emits progress via the callback so the UI can show live
 * step-by-step status.
 */
export async function runAnalysis(
  input: AnalyzeInput,
  onProgress: ProgressCallback = () => {},
): Promise<DriftReport> {
  const startedAt = Date.now();
  const repoUrl = input.repoUrl?.trim();
  const docsUrl = input.docsUrl?.trim();

  onProgress({ step: "parse", status: "start" });
  if (!repoUrl) throw new Error("A GitHub repository URL is required.");
  if (!docsUrl) throw new Error("A documentation URL is required.");
  try {
    new URL(docsUrl.includes("://") ? docsUrl : `https://${docsUrl}`);
  } catch {
    throw new Error(`The documentation URL looks invalid: ${docsUrl}`);
  }
  onProgress({ step: "parse", status: "done" });

  // 1. Pull the repo's API surface.
  onProgress({ step: "code", status: "start" });
  const { repo, files } = await fetchRepoApiSurface(repoUrl);
  onProgress({
    step: "code",
    status: "done",
    detail: `${files.length} source files`,
  });

  // 2. Extract the structured API surface.
  onProgress({ step: "extract", status: "start" });
  const isPython = repo.language?.toLowerCase() === "python";
  const symbols = isPython
    ? extractPythonSurface(files)
    : extractApiSurface(files);
  const apiSurface = renderApiSurface(symbols, files);
  onProgress({
    step: "extract",
    status: "done",
    detail: `${symbols.length} exported symbols`,
  });

  // 3. Crawl the docs.
  onProgress({ step: "docs", status: "start" });
  const docs = await getDocsContent(
    docsUrl.includes("://") ? docsUrl : `https://${docsUrl}`,
  );
  const docsContent = renderDocs(docs.pages);
  onProgress({
    step: "docs",
    status: "done",
    detail: `${docs.pages.length} doc pages`,
  });

  const { score: coverageScore, covered: coveredSymbols } =
    computeCoverageScore(symbols, docsContent);
  const deprecatedSymbols = symbols
    .filter((s) => s.deprecated)
    .map((s) => ({ name: s.name, kind: s.kind, file: s.file }));

  // 4. Analyze with Claude.
  onProgress({ step: "analyze", status: "start" });
  const { analysis, model } = await analyzeDrift({
    repoFullName: repo.fullName,
    docsUrl,
    apiSurface,
    docsContent,
  });
  const mismatches = sortMismatches(analysis.mismatches).slice(0, 10);
  const driftScore = computeDriftScore(mismatches);
  onProgress({
    step: "analyze",
    status: "done",
    detail: `${mismatches.length} mismatches`,
  });

  const report: DriftReport = {
    id: nanoid(10),
    createdAt: new Date().toISOString(),
    input: { repoUrl, docsUrl },
    repo,
    docs: {
      url: docsUrl,
      pagesCrawled: docs.pages.length,
      source: docs.source,
    },
    stats: {
      filesAnalyzed: files.length,
      symbolsExtracted: symbols.length,
      docPages: docs.pages.length,
    },
    files: files.map((f) => ({ path: f.path, url: f.url })),
    driftScore,
    scoreLabel: scoreLabel(driftScore),
    coverageScore,
    coveredSymbols,
    deprecatedSymbols,
    summary: analysis.summary,
    mismatches,
    model,
    durationMs: Date.now() - startedAt,
  };

  // 5. Persist for sharing.
  onProgress({ step: "save", status: "start" });
  try {
    await saveReport(report);
  } catch {
    // Persistence failing shouldn't lose the user's result — they still get
    // the report inline; only the shareable link won't resolve.
  }
  onProgress({ step: "save", status: "done" });

  return report;
}
