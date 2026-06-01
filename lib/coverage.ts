import type { ApiSymbol } from "./types";

export interface CoverageResult {
  score: number;   // 0–100
  covered: number; // symbols with names appearing in docs
  total: number;   // total symbols
}

/**
 * Compute what fraction of the exported API surface is mentioned anywhere in
 * the documentation. Uses simple name-presence matching — fast, deterministic,
 * and a useful proxy for "has a developer reading the docs a chance of
 * discovering this API?".
 */
export function computeCoverageScore(
  symbols: ApiSymbol[],
  docsContent: string,
): CoverageResult {
  if (symbols.length === 0) return { score: 100, covered: 0, total: 0 };
  const covered = symbols.filter((s) => docsContent.includes(s.name)).length;
  return {
    score: Math.round((covered / symbols.length) * 100),
    covered,
    total: symbols.length,
  };
}

export function coverageLabel(score: number): string {
  if (score >= 90) return "Well documented";
  if (score >= 70) return "Mostly documented";
  if (score >= 50) return "Partially documented";
  return "Poorly documented";
}
