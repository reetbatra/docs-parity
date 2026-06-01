import { z } from "zod";

/**
 * The shape of a single documentation/code mismatch, and the overall analysis
 * payload Claude returns. Zod is the source of truth for runtime validation;
 * `analysisJsonSchema` is the equivalent JSON Schema we hand to the Anthropic
 * structured-outputs API (`output_config.format`).
 */

export const SEVERITIES = ["high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const severitySchema = z.enum(SEVERITIES).catch("medium");

export const mismatchSchema = z.object({
  title: z.string().catch("Untitled mismatch"),
  code_snippet: z.string().catch(""),
  docs_snippet: z.string().catch(""),
  description: z.string().catch(""),
  suggested_fix: z.string().catch(""),
  severity: severitySchema,
  confidence: z
    .number()
    .catch(0.7)
    .transform((n) => Math.min(1, Math.max(0, n))),
  file: z.string().catch(""),
});

export type Mismatch = z.infer<typeof mismatchSchema>;

export const analysisSchema = z.object({
  summary: z.string().catch(""),
  mismatches: z.array(mismatchSchema).catch([]),
});

export type Analysis = z.infer<typeof analysisSchema>;

/**
 * JSON Schema handed to Claude via `output_config.format`. Structured outputs
 * require `additionalProperties: false` on every object and forbid numeric /
 * length constraints, so we encode confidence as a plain number and clamp it
 * ourselves after parsing.
 */
export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description:
        "A 1-3 sentence plain-English verdict on how well the docs match the code.",
    },
    mismatches: {
      type: "array",
      description:
        "The most important places where the documentation contradicts, omits, or lags the actual code. At most 10, ordered by severity (high first).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            description: "A short, specific headline for this mismatch.",
          },
          code_snippet: {
            type: "string",
            description:
              "The relevant snippet from the actual code (a signature, export, or config option). Quote it as it appears in the source.",
          },
          docs_snippet: {
            type: "string",
            description:
              "The conflicting or outdated snippet from the documentation. If the code is simply undocumented, use the exact string '(not documented)'.",
          },
          description: {
            type: "string",
            description:
              "What specifically diverges between the code and the docs, and why a developer following the docs would be misled.",
          },
          suggested_fix: {
            type: "string",
            description:
              "The corrected documentation text or a concrete instruction for how to update the docs to match the code.",
          },
          severity: {
            type: "string",
            enum: ["high", "medium", "low"],
            description:
              "high = following the docs will cause an error or broken behavior; medium = misleading or outdated but recoverable; low = cosmetic, naming, or minor omission.",
          },
          confidence: {
            type: "number",
            description:
              "Your confidence from 0 to 1 that this is a real, current mismatch (not a false positive).",
          },
          file: {
            type: "string",
            description:
              "The source file path the code_snippet came from, if identifiable; otherwise an empty string.",
          },
        },
        required: [
          "title",
          "code_snippet",
          "docs_snippet",
          "description",
          "suggested_fix",
          "severity",
          "confidence",
          "file",
        ],
      },
    },
  },
  required: ["summary", "mismatches"],
} as const;

/**
 * Parse + normalize a raw model payload into a validated Analysis. Never throws:
 * malformed individual fields fall back to safe defaults via `.catch(...)`.
 */
export function parseAnalysis(raw: unknown): Analysis {
  const result = analysisSchema.safeParse(raw);
  if (result.success) return result.data;
  return { summary: "", mismatches: [] };
}
