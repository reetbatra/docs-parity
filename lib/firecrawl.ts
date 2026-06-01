import type { DocPage } from "./types";
import type { FetchLike } from "./github";

/**
 * Firecrawl integration. We always scrape the primary docs URL (guaranteed
 * content, 1 credit) and additionally do a small, capped crawl for breadth
 * (best-effort — failures or timeouts degrade gracefully to just the primary
 * page). This keeps us well within Firecrawl's free 500-credits/month tier.
 */

const DEFAULT_BASE = "https://api.firecrawl.dev";

interface FirecrawlDoc {
  markdown?: string;
  metadata?: {
    title?: string;
    sourceURL?: string;
    url?: string;
    ogTitle?: string;
  };
}

function baseUrl(): string {
  return process.env.FIRECRAWL_API_URL?.replace(/\/$/, "") ?? DEFAULT_BASE;
}

function apiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error(
      "FIRECRAWL_API_KEY is not set. Get a free key (500 credits/month) at firecrawl.dev.",
    );
  }
  return key;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
  };
}

function toDocPage(doc: FirecrawlDoc, fallbackUrl: string): DocPage | null {
  const markdown = (doc.markdown ?? "").trim();
  if (!markdown) return null;
  const url = doc.metadata?.sourceURL ?? doc.metadata?.url ?? fallbackUrl;
  const title =
    doc.metadata?.title ??
    doc.metadata?.ogTitle ??
    new URL(url, fallbackUrl).pathname;
  return { url, title, markdown };
}

export interface CrawlOptions {
  fetchImpl?: FetchLike;
  /** Max pages for the breadth crawl. */
  limit?: number;
  /** Max milliseconds to wait for the crawl to complete. */
  timeoutMs?: number;
  /** Whether to attempt the breadth crawl at all. */
  crawl?: boolean;
  /** Poll interval for the crawl status. */
  pollMs?: number;
}

/** Scrape a single docs page to Markdown. */
export async function scrapePage(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<DocPage | null> {
  const res = await fetchImpl(`${baseUrl()}/v1/scrape`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(
      `Firecrawl scrape failed (${res.status})${text ? `: ${text}` : ""}`,
    );
  }
  const json = (await res.json()) as { data?: FirecrawlDoc };
  if (!json.data) return null;
  return toDocPage(json.data, url);
}

/** Best-effort breadth crawl of the docs site. Returns [] on any failure. */
export async function crawlSite(
  url: string,
  options: CrawlOptions = {},
): Promise<DocPage[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.limit ?? 8;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const pollMs = options.pollMs ?? 2_000;

  try {
    const startRes = await fetchImpl(`${baseUrl()}/v1/crawl`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        url,
        limit,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!startRes.ok) return [];
    const start = (await startRes.json()) as { id?: string; url?: string };
    const id = start.id;
    if (!id) return [];

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const statusRes = await fetchImpl(`${baseUrl()}/v1/crawl/${id}`, {
        headers: authHeaders(),
      });
      if (!statusRes.ok) return [];
      const status = (await statusRes.json()) as {
        status?: string;
        data?: FirecrawlDoc[];
      };
      if (status.status === "completed" || status.status === "failed") {
        return (status.data ?? [])
          .map((d) => toDocPage(d, url))
          .filter((p): p is DocPage => p !== null);
      }
      await sleep(pollMs);
    }
    return [];
  } catch {
    return [];
  }
}

export interface DocsResult {
  pages: DocPage[];
  source: string;
}

/**
 * Get docs content: guaranteed primary page + optional breadth crawl, merged
 * and de-duplicated by URL, capped by page count and total size.
 */
export async function getDocsContent(
  url: string,
  options: CrawlOptions & { maxPages?: number; maxChars?: number } = {},
): Promise<DocsResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxPages = options.maxPages ?? 12;
  const maxChars = options.maxChars ?? 80_000;
  const doCrawl = options.crawl ?? process.env.DRIFT_CRAWL !== "false";

  const pagesByUrl = new Map<string, DocPage>();

  // Primary page — required.
  const primary = await scrapePage(url, fetchImpl);
  if (primary) pagesByUrl.set(normalizeUrl(primary.url), primary);

  // Breadth crawl — best effort.
  if (doCrawl) {
    const crawled = await crawlSite(url, { ...options, fetchImpl });
    for (const page of crawled) {
      const key = normalizeUrl(page.url);
      if (!pagesByUrl.has(key)) pagesByUrl.set(key, page);
    }
  }

  if (pagesByUrl.size === 0) {
    throw new Error(`Could not extract any documentation content from ${url}.`);
  }

  // Cap pages, prefer the primary page first.
  const primaryKey = primary ? normalizeUrl(primary.url) : null;
  const ordered = [...pagesByUrl.values()].sort((a, b) => {
    if (primaryKey) {
      if (normalizeUrl(a.url) === primaryKey) return -1;
      if (normalizeUrl(b.url) === primaryKey) return 1;
    }
    return b.markdown.length - a.markdown.length;
  });

  const selected: DocPage[] = [];
  let total = 0;
  for (const page of ordered) {
    if (selected.length >= maxPages) break;
    const remaining = maxChars - total;
    if (remaining <= 500) break;
    const markdown =
      page.markdown.length > remaining
        ? page.markdown.slice(0, remaining)
        : page.markdown;
    selected.push({ url: page.url, title: page.title, markdown });
    total += markdown.length;
  }

  return {
    pages: selected,
    source: doCrawl ? "scrape + crawl" : "scrape",
  };
}

/** Render docs pages as a single block for the model prompt. */
export function renderDocs(pages: DocPage[]): string {
  return pages
    .map((p) => `// DOC PAGE: ${p.title}\n// URL: ${p.url}\n\n${p.markdown}`)
    .join("\n\n---\n\n");
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 200);
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
