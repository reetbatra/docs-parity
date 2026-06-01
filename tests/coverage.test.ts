import { describe, it, expect } from "vitest";
import { computeCoverageScore, coverageLabel } from "../lib/coverage";
import type { ApiSymbol } from "../lib/types";

function sym(name: string): ApiSymbol {
  return { kind: "function", name, signature: `def ${name}()`, file: "a.py", line: 1 };
}

describe("computeCoverageScore", () => {
  it("returns 100 with full coverage", () => {
    const result = computeCoverageScore(
      [sym("foo"), sym("bar")],
      "foo does this and bar does that",
    );
    expect(result.score).toBe(100);
    expect(result.covered).toBe(2);
    expect(result.total).toBe(2);
  });

  it("returns 0 when no symbols appear in docs", () => {
    const result = computeCoverageScore(
      [sym("alpha"), sym("beta")],
      "nothing relevant here",
    );
    expect(result.score).toBe(0);
    expect(result.covered).toBe(0);
  });

  it("returns partial coverage", () => {
    const result = computeCoverageScore(
      [sym("foo"), sym("bar"), sym("baz"), sym("qux")],
      "foo and bar are mentioned",
    );
    expect(result.score).toBe(50);
    expect(result.covered).toBe(2);
    expect(result.total).toBe(4);
  });

  it("returns 100 with empty symbol list", () => {
    const result = computeCoverageScore([], "any docs");
    expect(result.score).toBe(100);
    expect(result.covered).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("coverageLabel", () => {
  it("labels high coverage as well documented", () => {
    expect(coverageLabel(95)).toBe("Well documented");
    expect(coverageLabel(90)).toBe("Well documented");
  });

  it("labels medium coverage correctly", () => {
    expect(coverageLabel(75)).toBe("Mostly documented");
    expect(coverageLabel(55)).toBe("Partially documented");
  });

  it("labels low coverage as poorly documented", () => {
    expect(coverageLabel(30)).toBe("Poorly documented");
  });
});
