import { describe, it, expect } from "vitest";
import type OpenAI from "openai";
import { analyzeDrift } from "../lib/analyze";

/**
 * A minimal stub of the OpenAI-compatible (DeepSeek) client:
 * `chat.completions.stream(...)` returns an object whose
 * `finalChatCompletion()` resolves to a ChatCompletion with one message.
 */
function stubClient(text: string, capture?: (params: unknown) => void) {
  return {
    chat: {
      completions: {
        stream(params: unknown) {
          capture?.(params);
          return {
            finalChatCompletion: async () => ({
              choices: [{ message: { content: text } }],
            }),
          };
        },
      },
    },
  } as unknown as OpenAI;
}

const validPayload = JSON.stringify({
  summary: "One signature drifted.",
  mismatches: [
    {
      title: "createClient signature changed",
      code_snippet: "export function createClient(options: Options)",
      docs_snippet: "createClient(url)",
      description: "params differ",
      suggested_fix: "pass Options",
      severity: "high",
      confidence: 0.9,
      file: "src/index.ts",
    },
  ],
});

describe("analyzeDrift", () => {
  it("parses DeepSeek's JSON-mode output into a validated analysis", async () => {
    const { analysis, model } = await analyzeDrift({
      repoFullName: "acme/lib",
      docsUrl: "https://acme.dev/docs",
      apiSurface: "export function createClient(options: Options)",
      docsContent: "createClient(url)",
      client: stubClient(validPayload),
      model: "deepseek-reasoner",
    });

    expect(model).toBe("deepseek-reasoner");
    expect(analysis.summary).toBe("One signature drifted.");
    expect(analysis.mismatches[0].severity).toBe("high");
  });

  it("sends JSON-mode request params with the schema embedded in the system prompt", async () => {
    let captured: Record<string, unknown> = {};
    await analyzeDrift({
      repoFullName: "acme/lib",
      docsUrl: "https://acme.dev/docs",
      apiSurface: "surface",
      docsContent: "docs",
      client: stubClient(validPayload, (p) => {
        captured = p as Record<string, unknown>;
      }),
    });

    // JSON mode configured (DeepSeek/OpenAI-compatible structured output).
    const responseFormat = captured.response_format as { type?: string };
    expect(responseFormat.type).toBe("json_object");

    // The schema is spelled out in the system prompt, since JSON mode alone
    // doesn't enforce shape.
    const messages = captured.messages as Array<{
      role: string;
      content: string;
    }>;
    const system = messages.find((m) => m.role === "system");
    expect(system?.content).toContain('"mismatches"');

    // The code/docs blocks land in the user message.
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain("CODE API SURFACE");
    expect(user?.content).toContain("DOCUMENTATION");
  });

  it("throws on non-JSON output", async () => {
    await expect(
      analyzeDrift({
        repoFullName: "acme/lib",
        docsUrl: "https://acme.dev/docs",
        apiSurface: "s",
        docsContent: "d",
        client: stubClient("this is not json"),
      }),
    ).rejects.toThrow(/not valid JSON/i);
  });
});
