import OpenAI from "openai";
import { analysisJsonSchema, parseAnalysis, type Analysis } from "./schema";

/**
 * The drift analysis step. Given the extracted code API surface and the docs
 * content, ask an LLM to find the places where they diverge, returning JSON
 * we validate with Zod.
 *
 * Runs on DeepSeek's OpenAI-compatible chat completions API:
 *  - Default model `deepseek-chat` (override with ANALYSIS_MODEL).
 *  - JSON mode (`response_format: { type: "json_object" }`) with the schema
 *    spelled out in the system prompt — DeepSeek guarantees valid JSON but
 *    not schema conformance, so Zod's `.catch(...)` fallbacks in schema.ts
 *    are the actual validation layer.
 *  - DeepSeek caches repeated prompt prefixes automatically server-side, so
 *    re-running the same repo+docs (the "famous repo" buttons) is cheap with
 *    no client-side cache annotations needed.
 *  - Streaming the request so large/long analyses never hit an HTTP timeout.
 */

export const DEFAULT_MODEL = "deepseek-chat";

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
- If a symbol is marked \`@deprecated\` in the code (shown as \`/** @deprecated */\` in the API surface) but the docs do not warn users to stop using it or provide a migration path, that is a high-severity mismatch.
- Return at most 10 mismatches, ordered by severity (high first). If the docs genuinely match the code well, return few or zero mismatches and say so in the summary.

Respond with a single JSON object only — no markdown fences, no commentary before or after — matching exactly this JSON Schema:
${JSON.stringify(analysisJsonSchema)}`;

export interface AnalyzeArgs {
  repoFullName: string;
  docsUrl: string;
  apiSurface: string;
  docsContent: string;
  client?: OpenAI;
  model?: string;
}

function getClient(provided?: OpenAI): OpenAI {
  if (provided) return provided;
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set. Add it to your environment to run the analysis.",
    );
  }
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
}

export interface AnalyzeResult {
  analysis: Analysis;
  model: string;
}

export async function analyzeDrift(args: AnalyzeArgs): Promise<AnalyzeResult> {
  const client = getClient(args.client);
  const model = args.model ?? process.env.ANALYSIS_MODEL ?? DEFAULT_MODEL;

  const stream = client.chat.completions.stream({
    model,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `# CODE API SURFACE\n` +
          `Repository: ${args.repoFullName}\n` +
          `Extracted directly from the source. Treat this as ground truth for what the code actually does.\n\n` +
          "```ts\n" +
          args.apiSurface +
          "\n```\n\n" +
          `# DOCUMENTATION\n` +
          `Source: ${args.docsUrl}\n` +
          `Scraped from the published docs site.\n\n` +
          args.docsContent +
          `\n\nCompare the documentation against the code API surface above and identify the most important mismatches. ` +
          `Return your findings as JSON matching the required schema (a summary plus a mismatches array).`,
      },
    ],
  });

  const completion = await stream.finalChatCompletion();
  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("DeepSeek returned no text content for the analysis.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("DeepSeek's analysis was not valid JSON.");
  }

  return { analysis: parseAnalysis(raw), model };
}
