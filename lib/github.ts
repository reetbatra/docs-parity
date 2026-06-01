import type { RepoMeta, SourceFile } from "./types";

export type FetchLike = typeof fetch;

export interface ParsedRepo {
  owner: string;
  repo: string;
  ref?: string;
}

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

const EXCLUDE_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)out\//,
  /(^|\/)coverage\//,
  /(^|\/)\.next\//,
  /(^|\/)examples?\//,
  /(^|\/)demos?\//,
  /(^|\/)docs?\//,
  /(^|\/)website\//,
  /(^|\/)fixtures?\//,
  /(^|\/)__tests__\//,
  /(^|\/)__mocks__\//,
  /(^|\/)test(s)?\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\.stories\.[cm]?[jt]sx?$/,
  /\.min\.js$/,
  /(^|\/)vendor\//,
];

/**
 * Parse the many shapes a GitHub repo URL can take:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   https://github.com/owner/repo/tree/branch/sub/dir
 *   git@github.com:owner/repo.git
 *   owner/repo
 */
export function parseRepoUrl(input: string): ParsedRepo {
  const raw = input.trim();
  if (!raw) throw new Error("Repository URL is required.");

  // git@github.com:owner/repo.git
  const ssh = raw.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (ssh) {
    return { owner: ssh[1], repo: ssh[2] };
  }

  // bare owner/repo
  const bare = raw.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (bare && !raw.includes("://") && !raw.includes("github.com")) {
    return { owner: bare[1], repo: bare[2] };
  }

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new Error(`Could not parse repository URL: ${input}`);
  }

  if (!/github\.com$/i.test(url.hostname)) {
    throw new Error("Only public github.com repositories are supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`URL does not look like a GitHub repo: ${input}`);
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");

  // .../tree/<ref>/...  or .../blob/<ref>/...
  let ref: string | undefined;
  if ((parts[2] === "tree" || parts[2] === "blob") && parts[3]) {
    ref = parts[3];
  }

  return { owner, repo, ref };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "docsparity",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

/** Collect candidate entry-point paths from a package.json `exports`/`main`. */
function collectEntryPoints(pkg: unknown): Set<string> {
  const entries = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && v.startsWith(".")) {
      entries.add(v.replace(/^\.\//, "").replace(/^\.\.\//, ""));
    }
  };
  const walk = (v: unknown) => {
    if (typeof v === "string") return add(v);
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      return Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  if (pkg && typeof pkg === "object") {
    const p = pkg as Record<string, unknown>;
    add(p.main);
    add(p.module);
    add(p.types);
    add(p.typings);
    walk(p.exports);
  }
  return entries;
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

/** Heuristic relevance score: the higher, the more likely to be public API. */
function scoreFile(path: string, entryPoints: Set<string>): number {
  let score = 0;
  const name = basename(path).toLowerCase();
  const depth = path.split("/").length;

  // Exact entry points from package.json are the strongest signal.
  if (entryPoints.has(path)) score += 100;

  // .d.ts files are pure declarations — the cleanest API surface there is.
  if (path.endsWith(".d.ts")) score += 30;

  // Conventional public-surface filenames.
  if (/^(index|main|mod|api|client|sdk|core|public-api)\./.test(name)) {
    score += 25;
  }

  // Prefer source roots; penalize depth.
  if (/(^|\/)src\//.test(path)) score += 10;
  if (/(^|\/)packages\/[^/]+\/src\//.test(path)) score += 8;
  if (/(^|\/)lib\//.test(path)) score += 4;
  score -= depth * 2;

  // Slight preference for TS over JS (richer type info).
  if (/\.tsx?$/.test(path)) score += 3;

  return score;
}

function isSourceFile(path: string): boolean {
  if (EXCLUDE_PATTERNS.some((re) => re.test(path))) return false;
  return SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

export interface FetchSurfaceOptions {
  fetchImpl?: FetchLike;
  maxFiles?: number;
  maxFileBytes?: number;
}

/**
 * Fetch the public API surface of a repo: repo metadata + the most relevant
 * top-level source files (entry points, index/api/client/sdk files, .d.ts
 * declarations). We deliberately do NOT fetch every file — that blows GitHub
 * rate limits and Claude's context. 90% of what docs reference lives in the
 * exported API surface.
 */
export async function fetchRepoApiSurface(
  repoUrl: string,
  options: FetchSurfaceOptions = {},
): Promise<{ repo: RepoMeta; files: SourceFile[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxFiles = options.maxFiles ?? 12;
  const maxFileBytes = options.maxFileBytes ?? 60_000;

  const { owner, repo, ref } = parseRepoUrl(repoUrl);
  const headers = githubHeaders();

  // 1. Repo metadata.
  const metaRes = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers },
  );
  if (metaRes.status === 404) {
    throw new Error(
      `Repository ${owner}/${repo} was not found (is it public?).`,
    );
  }
  if (metaRes.status === 403) {
    throw new Error(
      "GitHub API rate limit hit. Set a GITHUB_TOKEN env var to raise the limit.",
    );
  }
  if (!metaRes.ok) {
    throw new Error(`GitHub returned ${metaRes.status} for ${owner}/${repo}.`);
  }
  const meta = (await metaRes.json()) as Record<string, unknown>;
  const defaultBranch = (meta.default_branch as string) ?? "main";
  const branch = ref ?? defaultBranch;

  const repoMeta: RepoMeta = {
    owner,
    repo,
    fullName: (meta.full_name as string) ?? `${owner}/${repo}`,
    url: (meta.html_url as string) ?? `https://github.com/${owner}/${repo}`,
    defaultBranch,
    branch,
    description: (meta.description as string) ?? null,
    stars: (meta.stargazers_count as number) ?? 0,
    language: (meta.language as string) ?? null,
  };

  // 2. Recursive tree of the branch.
  const treeRes = await fetchImpl(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
      branch,
    )}?recursive=1`,
    { headers },
  );
  if (!treeRes.ok) {
    throw new Error(
      `Could not read the file tree for ${owner}/${repo}@${branch} (status ${treeRes.status}).`,
    );
  }
  const treeJson = (await treeRes.json()) as { tree?: TreeEntry[] };
  const tree = treeJson.tree ?? [];

  // 3. Optionally read package.json to find declared entry points.
  let entryPoints = new Set<string>();
  if (tree.some((t) => t.path === "package.json")) {
    try {
      const pkgRes = await fetchImpl(rawUrl(owner, repo, branch, "package.json"));
      if (pkgRes.ok) {
        const pkg = JSON.parse(await pkgRes.text());
        entryPoints = collectEntryPoints(pkg);
      }
    } catch {
      // Non-fatal — entry points are just a ranking bonus.
    }
  }

  // 4. Rank and select source files.
  const candidates = tree
    .filter((t) => t.type === "blob" && isSourceFile(t.path))
    .filter((t) => (t.size ?? 0) <= maxFileBytes)
    .map((t) => ({ ...t, score: scoreFile(t.path, entryPoints) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);

  if (candidates.length === 0) {
    throw new Error(
      `No TypeScript/JavaScript source files found in ${owner}/${repo}. docsParity targets TS/JS libraries.`,
    );
  }

  // 5. Fetch file contents from raw.githubusercontent.com (not rate-limited
  //    against the REST API quota).
  const files: SourceFile[] = [];
  await Promise.all(
    candidates.map(async (c) => {
      try {
        const res = await fetchImpl(rawUrl(owner, repo, branch, c.path));
        if (!res.ok) return;
        const content = await res.text();
        files.push({
          path: c.path,
          url: `${repoMeta.url}/blob/${branch}/${c.path}`,
          content,
          size: content.length,
        });
      } catch {
        // Skip files we can't read rather than failing the whole run.
      }
    }),
  );

  if (files.length === 0) {
    throw new Error(
      `Found source files in ${owner}/${repo} but could not download their contents.`,
    );
  }

  // Preserve the ranked order.
  const order = new Map(candidates.map((c, i) => [c.path, i]));
  files.sort((a, b) => (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0));

  return { repo: repoMeta, files };
}

function rawUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(
    branch,
  )}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
