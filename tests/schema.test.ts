import { describe, it, expect } from "vitest";
import { parseAnalysis } from "../lib/schema";

describe("parseAnalysis", () => {
  it("parses a well-formed payload", () => {
    const result = parseAnalysis({
      summary: "Docs mostly match.",
      mismatches: [
        {
          title: "createClient renamed",
          code_snippet: "export function createClient()",
          docs_snippet: "client()",
          description: "renamed",
          suggested_fix: "use createClient",
          severity: "high",
          confidence: 0.9,
          file: "src/index.ts",
        },
      ],
    });
    expect(result.summary).toBe("Docs mostly match.");
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].severity).toBe("high");
  });

  it("clamps confidence into [0,1]", () => {
    const result = parseAnalysis({
      summary: "",
      mismatches: [
        {
          title: "t",
          code_snippet: "c",
          docs_snippet: "d",
          description: "x",
          suggested_fix: "f",
          severity: "low",
          confidence: 5,
          file: "",
        },
      ],
    });
    expect(result.mismatches[0].confidence).toBe(1);
  });

  it("defaults an invalid severity to medium", () => {
    const result = parseAnalysis({
      summary: "",
      mismatches: [
        {
          title: "t",
          code_snippet: "c",
          docs_snippet: "d",
          description: "x",
          suggested_fix: "f",
          severity: "catastrophic",
          confidence: 0.5,
          file: "",
        },
      ],
    });
    expect(result.mismatches[0].severity).toBe("medium");
  });

  it("survives missing fields with safe defaults", () => {
    const result = parseAnalysis({ mismatches: [{ title: "only a title" }] });
    expect(result.summary).toBe("");
    expect(result.mismatches[0].title).toBe("only a title");
    expect(result.mismatches[0].severity).toBe("medium");
    expect(result.mismatches[0].confidence).toBe(0.7);
  });

  it("returns an empty analysis for garbage input", () => {
    expect(parseAnalysis("not an object")).toEqual({
      summary: "",
      mismatches: [],
    });
    expect(parseAnalysis(null)).toEqual({ summary: "", mismatches: [] });
  });
});
