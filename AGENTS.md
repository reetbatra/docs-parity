# What this project is
docsParity — give it a GitHub repo URL and a docs URL; it extracts the repo's real exported API surface, crawls the docs, and uses AI to diff them into ranked mismatches with a deterministic drift score out of 10. This is the flagship portfolio project for AI/DevRel applications — quality bar is "public demo", not "side project".

Names differ everywhere: local folder `docs-drift-detector`, package + Vercel project `docsparity`, GitHub repo `reetbatra/docs-parity`.

# Stack
- Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, deployed on Vercel
- DeepSeek API via the OpenAI-compatible SDK (`deepseek-chat` by default, JSON mode + automatic server-side prompt caching), Firecrawl for docs crawling, Vercel Blob for report storage, Zod v4, Vitest

# Commands
- Run locally: `npm run dev`
- Test: `npm test` (all) or `npx vitest run tests/extract.test.ts` (one file)
- Before shipping: `npm run typecheck && npm run lint && npm run build`

# Rules for this repo
- The pipeline lives in `lib/`: `github.ts` (fetch + rank source files), `extract*.ts` (per-language API extraction — TS via compiler AST, plus Python/Java/Rust/Go), `firecrawl.ts` (docs crawl), `analyze.ts` (DeepSeek call), `drift.ts` (score), `pipeline.ts` (orchestration), `storage.ts` (Blob, or local `.reports/` without a token).
- API routes in `app/api/`: `analyze` streams step-by-step progress as NDJSON; `report` backs the shareable `/report/<id>` permalinks.
- The drift score is computed deterministically in `drift.ts` from severity-weighted, confidence-scaled findings — never let the model output the score itself.
- New language support = `lib/extract-<lang>.ts` + matching `tests/extract-<lang>.test.ts`. Every `lib/` module has a test file; keep it that way.
- Env vars are documented in `.env.example` — required: `DEEPSEEK_API_KEY`, `FIRECRAWL_API_KEY`. Add new config there first, commented, with the same tone.

# Gotchas
- Zod is v4 and Tailwind is v4 — both differ from training data (Tailwind config is CSS-based; there is no `tailwind.config.js`).
- Firecrawl free tier is 500 credits/month — keep crawls breadth-limited and credit-conscious; `DRIFT_CRAWL=false` skips the breadth crawl entirely.
- Re-runs of the same repo+docs are cheap partly because DeepSeek caches repeated prompt prefixes server-side automatically — no client-side cache annotations to preserve, but keep the code/docs blocks as a stable prefix in the analyze prompt so cache hits still land.
- `analyze.ts` uses DeepSeek's JSON mode (`response_format: json_object`), which guarantees valid JSON but not schema conformance — `schema.ts`'s Zod `.catch(...)` fallbacks are the real validation layer, not the embedded JSON Schema in the prompt.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
