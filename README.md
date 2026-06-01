<div align="center">

# ◑ docsParity

**Find where your docs and code drift apart — and exactly what to fix.**

Give it a GitHub repo URL and a docs URL. docsParity pulls the repo's real exported API surface, crawls the documentation, and uses Claude to diff them — returning the top mismatches ranked by severity, each with the code snippet, the conflicting docs snippet, what changed, and the suggested fix, plus an overall **drift score out of 10**.

</div>

---

## The problem

A developer clones a popular SDK, follows the docs, and hits an error because a method signature changed three months ago — but nobody updated the docs. Two hours wasted.

**docsParity catches that in ~30 seconds**, before it costs anyone an afternoon.

---

## Features

- **Two inputs, one report.** A GitHub repo URL and a docs URL. That's it.
- **Real API extraction.** Uses the **TypeScript compiler AST** to pull exported functions, classes (with public method signatures), interfaces, types, enums, consts, and re-exports — not brittle regex. Prioritizes entry points (`index`/`api`/`client`/`sdk`, `package.json` `exports`, and `.d.ts` declarations).
- **Live crawl.** Firecrawl scrapes the docs site to clean Markdown (primary page guaranteed + a small breadth crawl, credit-conscious).
- **Structured Claude analysis.** `claude-opus-4-8` by default, with adaptive thinking, `effort: high`, and JSON-schema **structured outputs**. The large code/docs blocks use **prompt caching**, so re-running the same repo+docs (the "famous repo" buttons) is cheap.
- **Deterministic drift score.** Computed from severity-weighted, confidence-scaled findings — reproducible and explainable, not a number the model made up.
- **Live progress.** The analysis streams step-by-step status (fetch code → extract → crawl → analyze) over NDJSON.
- **Run on a famous repo.** One-click examples (Vercel AI SDK, Prisma, Hono, Zod) so anyone can try it instantly.
- **Shareable reports.** Every run gets a permalink at `/report/<id>` with a dynamic title/description and an Open Graph card. Post your score.
- **Submit to maintainer.** Each mismatch (and the whole report) has a button that opens a pre-filled GitHub issue — turning an audit tool into a contribution tool.

---

## How it works

```
GitHub repo URL ─▶ GitHub REST API ─▶ rank & fetch top source files
                                          │
                                          ▼
                                  TypeScript compiler ─▶ API surface (signatures)
                                                              │
docs URL ─▶ Firecrawl (scrape + crawl) ─▶ Markdown ──────────┤
                                                              ▼
                                            Claude (structured outputs + caching)
                                                              │
                                                              ▼
                          mismatches + summary ─▶ deterministic drift score ─▶ saved report
```

1. **Fetch code** (`lib/github.ts`) — parse the repo URL, read the tree, rank files by relevance (entry points, `index`/`api`/`client`/`sdk`, `.d.ts`, `src/` depth), and download the top ~12 from `raw.githubusercontent.com`.
2. **Extract surface** (`lib/extract.ts`) — walk each file's TypeScript AST and emit a compact, signature-level view of the public API.
3. **Crawl docs** (`lib/firecrawl.ts`) — always scrape the primary page; best-effort breadth crawl for more pages; merge, de-dupe, cap.
4. **Analyze** (`lib/analyze.ts`) — send the API surface + docs to Claude with a JSON schema; get back the top mismatches.
5. **Score & persist** (`lib/drift.ts`, `lib/storage.ts`) — compute the drift score, save the report for sharing.

It deliberately does **not** parse every file — that blows GitHub rate limits and the token budget. ~90% of what docs reference lives in the exported API surface.

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Required | What it's for |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | ✅ | The code-vs-docs analysis. |
| `FIRECRAWL_API_KEY` | ✅ | Crawling the docs site. [Free tier](https://firecrawl.dev): 500 credits/month. |
| `GITHUB_TOKEN` | optional | Raises the GitHub rate limit (60 → 5,000/hr). A no-scope classic token is enough. |
| `BLOB_READ_WRITE_TOKEN` | optional | Vercel Blob, for durable shareable report links. Auto-provisioned on Vercel. Without it, reports save to a local `.reports/` folder. |
| `ANALYSIS_MODEL` | optional | Override the model (default `claude-opus-4-8`). |
| `DRIFT_CRAWL` | optional | Set to `false` to scrape only the primary docs page (saves credits). |

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000, paste a repo + docs URL (or click a famous-repo chip), and watch it work.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build. |
| `npm test` | Run the Vitest suite. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |

---

## Testing

The pure logic — URL parsing, AST extraction, drift scoring, schema validation, issue formatting, the Firecrawl merge, the GitHub file selection, and the Claude response parsing — is covered by [Vitest](https://vitest.dev) with all network calls mocked:

```bash
npm test
```

---

## Deploying to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add `ANTHROPIC_API_KEY` and `FIRECRAWL_API_KEY` (and optionally `GITHUB_TOKEN`) as environment variables.
3. Add a **Blob** store from the Vercel dashboard — this auto-injects `BLOB_READ_WRITE_TOKEN` so `/report/<id>` links persist.
4. Deploy. The analysis route runs on the Node.js runtime with a 300s max duration.

---

## Architecture

```
app/
  page.tsx                     # Landing page + form
  api/analyze/route.ts         # POST: runs the pipeline, streams NDJSON progress + final report
  api/report/[id]/route.ts     # GET: fetch a saved report as JSON
  report/[id]/page.tsx         # Shareable report page (+ generateMetadata, opengraph-image)
lib/
  github.ts                    # repo URL parsing + API-surface file selection
  extract.ts                   # TypeScript compiler AST → API symbols
  firecrawl.ts                 # docs scrape + crawl
  analyze.ts                   # Claude structured-output analysis
  drift.ts                     # deterministic drift score
  schema.ts                    # Zod + JSON schema for the analysis
  storage.ts                   # Vercel Blob / local-fs report persistence
  github-issue.ts              # pre-filled GitHub issue builder
  pipeline.ts                  # orchestrates the whole run with progress callbacks
components/                    # ReportView, MismatchCard, DriftScore, DriftForm, …
tests/                         # Vitest unit tests
```

---

## Tech stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript · the official Anthropic SDK (`@anthropic-ai/sdk`) · Zod · Firecrawl · Vercel Blob.

---

## Limitations

- Targets **TypeScript / JavaScript** libraries (the API extraction is TS/JS-specific).
- The analysis is a focused diff of the **public API surface** vs the docs, not a full semantic audit.
- Crawl breadth and depth are capped to respect Firecrawl's free tier and Claude's context.

---

## License

MIT
