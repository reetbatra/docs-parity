import { describe, it, expect, beforeAll } from "vitest";
import { getDocsContent, renderDocs } from "@/lib/firecrawl";

beforeAll(() => {
  process.env.FIRECRAWL_API_KEY = "fc-test";
});

function res(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("getDocsContent", () => {
  it("merges the primary scrape with the breadth crawl and de-dupes", async () => {
    const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? "GET";
      if (url.endsWith("/v1/scrape")) {
        return res({
          data: {
            markdown: "# Intro\nPrimary page content.",
            metadata: { title: "Intro", sourceURL: "https://docs.dev/" },
          },
        });
      }
      if (url.endsWith("/v1/crawl") && method === "POST") {
        return res({ id: "crawl_1" });
      }
      if (url.includes("/v1/crawl/crawl_1")) {
        return res({
          status: "completed",
          data: [
            {
              markdown: "# Intro\nPrimary page content.",
              metadata: { title: "Intro", sourceURL: "https://docs.dev/" },
            },
            {
              markdown: "# Guide\nSecond page.",
              metadata: { title: "Guide", sourceURL: "https://docs.dev/guide" },
            },
          ],
        });
      }
      throw new Error(`unexpected ${method} ${url}`);
    }) as typeof fetch;

    const result = await getDocsContent("https://docs.dev/", {
      fetchImpl,
      pollMs: 1,
      timeoutMs: 1000,
      limit: 5,
    });

    // Primary + one unique crawled page (the duplicate is dropped).
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].url).toBe("https://docs.dev/");
    expect(result.pages.map((p) => p.title)).toContain("Guide");
    expect(result.source).toBe("scrape + crawl");
  });

  it("degrades to just the primary page when the crawl fails", async () => {
    const fetchImpl = (async (input: string | URL) => {
      const url = input.toString();
      if (url.endsWith("/v1/scrape")) {
        return res({
          data: {
            markdown: "Only page.",
            metadata: { title: "Only", sourceURL: "https://docs.dev/" },
          },
        });
      }
      if (url.endsWith("/v1/crawl")) {
        return res({}, false, 500);
      }
      throw new Error(`unexpected ${url}`);
    }) as typeof fetch;

    const result = await getDocsContent("https://docs.dev/", {
      fetchImpl,
      pollMs: 1,
    });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].markdown).toBe("Only page.");
  });

  it("throws when no content can be extracted", async () => {
    const fetchImpl = (async (input: string | URL) => {
      const url = input.toString();
      if (url.endsWith("/v1/scrape")) return res({ data: { markdown: "" } });
      if (url.endsWith("/v1/crawl")) return res({}, false, 500);
      throw new Error("unexpected");
    }) as typeof fetch;

    await expect(
      getDocsContent("https://docs.dev/", { fetchImpl, pollMs: 1 }),
    ).rejects.toThrow(/could not extract/i);
  });

  it("renderDocs labels each page", () => {
    const md = renderDocs([
      { url: "https://docs.dev/", title: "Intro", markdown: "hello" },
    ]);
    expect(md).toContain("DOC PAGE: Intro");
    expect(md).toContain("hello");
  });
});
