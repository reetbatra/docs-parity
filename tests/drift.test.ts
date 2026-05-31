import { describe, it, expect } from "vitest";
import {
  computeDriftScore,
  scoreLabel,
  scoreTone,
  sortMismatches,
  countBySeverity,
} from "@/lib/drift";
import type { Mismatch } from "@/lib/schema";

function m(severity: Mismatch["severity"], confidence = 1): Mismatch {
  return {
    title: "t",
    code_snippet: "c",
    docs_snippet: "d",
    description: "desc",
    suggested_fix: "fix",
    severity,
    confidence,
    file: "f.ts",
  };
}

describe("computeDriftScore", () => {
  it("is 0 for no mismatches", () => {
    expect(computeDriftScore([])).toBe(0);
  });

  it("weights high more than medium more than low", () => {
    const high = computeDriftScore([m("high")]);
    const medium = computeDriftScore([m("medium")]);
    const low = computeDriftScore([m("low")]);
    expect(high).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(low);
  });

  it("caps at 10", () => {
    const many = Array.from({ length: 20 }, () => m("high"));
    expect(computeDriftScore(many)).toBe(10);
  });

  it("scales down low-confidence findings", () => {
    const confident = computeDriftScore([m("high", 1)]);
    const unsure = computeDriftScore([m("high", 0)]);
    expect(confident).toBeGreaterThan(unsure);
  });
});

describe("scoreLabel & scoreTone", () => {
  it("labels the bands", () => {
    expect(scoreLabel(0)).toBe("In sync");
    expect(scoreLabel(3)).toBe("Minor drift");
    expect(scoreLabel(5)).toBe("Notable drift");
    expect(scoreLabel(9)).toBe("Severe drift");
  });

  it("tones map low->green, high->red", () => {
    expect(scoreTone(1)).toBe("green");
    expect(scoreTone(9)).toBe("red");
  });
});

describe("sortMismatches", () => {
  it("orders high first, then by confidence", () => {
    const list = [
      m("low", 0.9),
      m("high", 0.5),
      m("high", 0.95),
      m("medium", 0.8),
    ];
    const sorted = sortMismatches(list);
    expect(sorted.map((x) => x.severity)).toEqual([
      "high",
      "high",
      "medium",
      "low",
    ]);
    // Among the two highs, the more confident one comes first.
    expect(sorted[0].confidence).toBe(0.95);
  });

  it("does not mutate the input", () => {
    const list = [m("low"), m("high")];
    const copy = [...list];
    sortMismatches(list);
    expect(list).toEqual(copy);
  });
});

describe("countBySeverity", () => {
  it("tallies each severity", () => {
    expect(countBySeverity([m("high"), m("high"), m("low")])).toEqual({
      high: 2,
      medium: 0,
      low: 1,
    });
  });
});
