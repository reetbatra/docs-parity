import Anthropic from "@anthropic-ai/sdk";
import { analysisJsonSchema, parseAnalysis, type Analysis } from "./schema";

/**
 * The Claude analysis step. Given the extracted code API surface and the docs
 * content, ask Claude to find the places where they diverge, returning clean
 * JSON via structured outputs.
 *
 * Best practices applied (per the current Anthropic SDK guidance):
 *  - Default model `claude-opus-4-8` (override with ANALYSIS_MODEL).
 *  - Adaptive thinking (effort defaults to "high") for careful diffing.
 *  - Structured outputs via `output_config.format` (JSON Schema), then
 *    validated with Zod on our side.
 *  - Prompt caching (`cache_control: ephemeral`) on the large code/docs blocks
 *    so re-running the same repo+docs (the "famous repo" buttons) is cheap.
 *  - Streaming the request so large/long analyses never hit an HTTP timeout.
 */

export const DEFAULT_MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `You are a senior staff engineer and technical writer performing a documentation audit.

You are given two things:
1. The actual public API surface of a software library, extracted directly from its source code (exported functions, classes, methods, interfaces, types, enums, and config options, with real signatures and line numbers).
2. The library's published documentation, scraped from its docs site.

Your job: find the specific places where the documentation no longer matches the code — where a developer who follows the docs would hit an error, get confused, or write code against an API that has changed.

What counts as a mismatch:
- A function/method signature in the docs that differs from the code (renamed, params added/removed/reordered, types changed, now async, return type changed).
- A class, method, export, or config option referenced in the docs that no longer exists in the code (or vice-versa: a prominent exported API that is undocumented).
- Import paths or package entry points in the docs that don't match the code's exports.
- Default values, option names, or behavior described in the docs that contradict the code.

Rules:
- Only report genuine, actionable mismatches grounded in the provided material. Do NOT invent code or docs that you cannot see.
- If the code clearly exposes an important API that the documentation never mentions, that is a valid "missing documentation" mismatch — set docs_snippet to "(not documented)".
- Quote real snippets. For code_snippet, use the signature as it appears in the provided surface. For docs_snippet, quote the conflicting text from the docs.
- Prefer high-signal findings a real developer would actually hit. It is better to report 4 solid mismatches than 10 speculative ones.
- Severity: high = following the docs causes an error or broken behavior; medium = misleading or outdated but a developer could recover; low = cosmetic, naming, or minor omission.
- Set confidence honestly (0-1). Lower it when you are inferring rather than certain.
- Return at most 10 mismatches, ordered by severity (high first). If the docs genuinely match the code well, return few or zero mismatches and say so in the summary.`;

export interface AnalyzeArgs {
  repoFullName: string;
  docsUrl: string;
  apiSurface: string;
  docsContent: string;
  client?: Anthropic;
  model?: string;
}

function getClient(provided?: Anthropic): Anthropic {
  if (provided) return provided;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment to run the analysis.",
    );
  }
  return new Anthropic();
}

export interface AnalyzeResult {
  analysis: Analysis;
  model: string;
}

export async function analyzeDrift(args: AnalyzeArgs): Promise<AnalyzeResult> {
  const client = getClient(args.client);
  const model = args.model ?? process.env.ANALYSIS_MODEL ?? DEFAULT_MODEL;

  const stream = client.messages.stream({
    model,
    max_tokens: 16000,
    // Adaptive thinking lets Claude decide how hard to think per request; we
    // pin effort to "high" (inside output_config, where the SDK accepts it) for
    // careful code-vs-docs diffing.
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: analysisJsonSchema,
      },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `# CODE API SURFACE\n` +
              `Repository: ${args.repoFullName}\n` +
              `Extracted directly from the source. Treat this as ground truth for what the code actually does.\n\n` +
              "```ts\n" +
              args.apiSurface +
              "\n```",
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text:
              `# DOCUMENTATION\n` +
              `Source: ${args.docsUrl}\n` +
              `Scraped from the published docs site.\n\n` +
              args.docsContent,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text:
              `Compare the documentation against the code API surface above and identify the most important mismatches. ` +
              `Return your findings as JSON matching the required schema (a summary plus a mismatches array).`,
          },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  const textBlock = message.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) {
    throw new Error("Claude returned no text content for the analysis.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Claude's analysis was not valid JSON.");
  }

  return { analysis: parseAnalysis(raw), model };
}
