import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { analyzeDrift } from "../lib/analyze";

/**
 * A minimal stub of the Anthropic client: `messages.stream(...)` returns an
 * object whose `finalMessage()` resolves to a Message with a single text block.
 */
function stubClient(text: string, capture?: (params: unknown) => void) {
  return {
    messages: {
      stream(params: unknown) {
        capture?.(params);
        return {
          finalMessage: async () => ({
            content: [{ type: "text", text }],
          }),
        };
      },
    },
  } as unknown as Anthropic;
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
  it("parses Claude's structured JSON into a validated analysis", async () => {
    const { analysis, model } = await analyzeDrift({
      repoFullName: "acme/lib",
      docsUrl: "https://acme.dev/docs",
      apiSurface: "export function createClient(options: Options)",
      docsContent: "createClient(url)",
      client: stubClient(validPayload),
      model: "claude-opus-4-8",
    });

    expect(model).toBe("claude-opus-4-8");
    expect(analysis.summary).toBe("One signature drifted.");
    expect(analysis.mismatches[0].severity).toBe("high");
  });

  it("sends cached, structured-output request params", async () => {
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

    // Structured outputs configured.
    const outputConfig = captured.output_config as {
      format?: { type?: string };
      effort?: string;
    };
    expect(outputConfig.format?.type).toBe("json_schema");
    expect(outputConfig.effort).toBe("high");
    expect(captured.thinking).toEqual({ type: "adaptive" });

    // The large code & docs blocks are marked for prompt caching.
    const messages = captured.messages as Array<{
      content: Array<{ cache_control?: unknown }>;
    }>;
    const cached = messages[0].content.filter((b) => b.cache_control);
    expect(cached.length).toBe(2);
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
