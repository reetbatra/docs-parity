import type { Mismatch, Severity } from "./schema";

/**
 * Deterministic drift scoring. We compute the score ourselves from the
 * severity-weighted findings rather than asking the model for a number, so the
 * score is reproducible and explainable.
 *
 * Scale: 0 = docs perfectly match the code (full parity), 10 = severe drift.
 */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  high: 3,
  medium: 1.5,
  low: 0.6,
};

export const SEVERITY_RANK: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Sum severity weights, lightly scaled by confidence, capped at 10.
 * A finding at full confidence contributes its full weight; a low-confidence
 * finding contributes proportionally less so speculative hits don't dominate.
 */
export function computeDriftScore(mismatches: Mismatch[]): number {
  const raw = mismatches.reduce((acc, m) => {
    const weight = SEVERITY_WEIGHT[m.severity];
    const confidenceFactor = 0.5 + 0.5 * m.confidence;
    return acc + weight * confidenceFactor;
  }, 0);
  const capped = Math.min(10, raw);
  return Math.round(capped * 10) / 10;
}

export function scoreLabel(score: number): string {
  if (score < 2) return "In sync";
  if (score < 4) return "Minor drift";
  if (score < 7) return "Notable drift";
  return "Severe drift";
}

/** Tailwind-friendly color band for a drift score (higher = worse). */
export function scoreTone(score: number): "green" | "amber" | "orange" | "red" {
  if (score < 2) return "green";
  if (score < 4) return "amber";
  if (score < 7) return "orange";
  return "red";
}

/** Sort by severity (high first), then by confidence (high first). */
export function sortMismatches(mismatches: Mismatch[]): Mismatch[] {
  return [...mismatches].sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rank !== 0) return rank;
    return b.confidence - a.confidence;
  });
}

export function countBySeverity(
  mismatches: Mismatch[],
): Record<Severity, number> {
  return mismatches.reduce(
    (acc, m) => {
      acc[m.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  );
}
