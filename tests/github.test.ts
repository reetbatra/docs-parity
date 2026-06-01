import { describe, it, expect } from "vitest";
import { parseRepoUrl, fetchRepoApiSurface } from "../lib/github";

describe("parseRepoUrl", () => {
  it("parses a standard https URL", () => {
    expect(parseRepoUrl("https://github.com/vercel/ai")).toEqual({
      owner: "vercel",
      repo: "ai",
      ref: undefined,
    });
  });

  it("strips a trailing .git", () => {
    expect(parseRepoUrl("https://github.com/prisma/prisma.git")).toMatchObject({
      owner: "prisma",
      repo: "prisma",
    });
  });

  it("parses a tree URL and extracts the ref", () => {
    expect(
      parseRepoUrl("https://github.com/honojs/hono/tree/next/src/index.ts"),
    ).toMatchObject({ owner: "honojs", repo: "hono", ref: "next" });
  });

  it("parses an ssh URL", () => {
    expect(parseRepoUrl("git@github.com:colinhacks/zod.git")).toMatchObject({
      owner: "colinhacks",
      repo: "zod",
    });
  });

  it("parses a bare owner/repo", () => {
    expect(parseRepoUrl("vercel/next.js")).toMatchObject({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("rejects non-github hosts", () => {
    expect(() => parseRepoUrl("https://gitlab.com/foo/bar")).toThrow();
  });

  it("rejects empty input", () => {
    expect(() => parseRepoUrl("   ")).toThrow();
  });
});

// --- fetchRepoApiSurface with a fully mocked fetch ---

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function textResponse(text: string) {
  return {
    ok: true,
    status: 200,
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

describe("fetchRepoApiSurface", () => {
  it("selects entry points and ranked source files, excluding tests/docs", async () => {
    const fetchImpl = (async (input: string | URL) => {
      const url = input.toString();
      if (url === "https://api.github.com/repos/acme/lib") {
        return jsonResponse({
          default_branch: "main",
          full_name: "acme/lib",
          html_url: "https://github.com/acme/lib",
          stargazers_count: 1234,
          description: "A test lib",
          language: "TypeScript",
        });
      }
      if (url.includes("/git/trees/main")) {
        return jsonResponse({
          tree: [
            { path: "package.json", type: "blob", size: 200 },
            { path: "src/index.ts", type: "blob", size: 500 },
            { path: "src/client.ts", type: "blob", size: 800 },
            { path: "src/internal/deep/util.ts", type: "blob", size: 400 },
            { path: "test/index.test.ts", type: "blob", size: 100 },
            { path: "docs/guide.ts", type: "blob", size: 100 },
            { path: "README.md", type: "blob", size: 100 },
            { path: "dist/index.js", type: "blob", size: 9000 },
          ],
        });
      }
      if (url.endsWith("/main/package.json")) {
        return textResponse(JSON.stringify({ main: "src/index.ts" }));
      }
      if (url.endsWith("/main/src/index.ts")) {
        return textResponse("export const a = 1;");
      }
      if (url.endsWith("/main/src/client.ts")) {
        return textResponse("export class Client {}");
      }
      if (url.endsWith("/main/src/internal/deep/util.ts")) {
        return textResponse("export const util = () => {};");
      }
      throw new Error(`unexpected url ${url}`);
    }) as typeof fetch;

    const { repo, files } = await fetchRepoApiSurface(
      "https://github.com/acme/lib",
      { fetchImpl },
    );

    expect(repo.fullName).toBe("acme/lib");
    expect(repo.branch).toBe("main");
    expect(repo.stars).toBe(1234);

    const paths = files.map((f) => f.path);
    // Entry point ranked first.
    expect(paths[0]).toBe("src/index.ts");
    expect(paths).toContain("src/client.ts");
    // Tests, docs, dist, README all excluded.
    expect(paths).not.toContain("test/index.test.ts");
    expect(paths).not.toContain("docs/guide.ts");
    expect(paths).not.toContain("dist/index.js");
    expect(paths).not.toContain("README.md");

    // Blob URLs are constructed correctly.
    const index = files.find((f) => f.path === "src/index.ts");
    expect(index?.url).toBe(
      "https://github.com/acme/lib/blob/main/src/index.ts",
    );
  });

  it("throws a clear error on 404", async () => {
    const fetchImpl = (async () =>
      jsonResponse({}, { ok: false, status: 404 })) as typeof fetch;
    await expect(
      fetchRepoApiSurface("https://github.com/acme/missing", { fetchImpl }),
    ).rejects.toThrow(/not found/i);
  });
});
