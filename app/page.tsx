import { DriftForm } from "@/components/DriftForm";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ repoUrl?: string; docsUrl?: string }>;
}) {
  const { repoUrl, docsUrl } = await searchParams;
  const autoRun = !!(repoUrl && docsUrl);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Code vs docs, diffed by Claude
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
          Your docs drifted from your code.
          <br className="hidden sm:block" />
          <span className="text-emerald-400"> docsParity finds where.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg">
          Give it a GitHub repo and a docs URL. It pulls the real exported API
          surface, crawls the documentation, and shows you exactly where they no
          longer match — ranked by severity, each with the fix.
        </p>
      </section>

      {/* The tool */}
      <DriftForm
        initialRepoUrl={repoUrl ?? ""}
        initialDocsUrl={docsUrl ?? ""}
        autoRun={autoRun}
      />

      {/* The problem */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-100">
          Why docs drift is expensive
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          A developer clones a popular SDK, follows the docs, and hits an error
          because a method signature changed three months ago — but nobody
          updated the docs. Two hours gone. docsParity catches that mismatch in
          about 30 seconds, before it costs anyone an afternoon.
        </p>
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          <Metric value="30s" label="From two URLs to a ranked report" />
          <Metric value="/10" label="A deterministic, shareable drift score" />
          <Metric value="1-click" label="File the fix as a GitHub issue" />
        </dl>
      </section>

      {/* How it works — 4-step pipeline */}
      <section>
        <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wider text-zinc-500">
          How it works
        </h2>
        <p className="mb-6 text-center text-xs text-zinc-600">
          Four stages, each deterministic and inspectable.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <PipelineStep
            step="1"
            title="Pull the source files"
            description="Reads the repo's file tree via the GitHub API and selects the most API-relevant files — not the whole codebase."
            details={[
              "Scores every file: entry points from package.json exports get +100, api/index/sdk names get +25, depth is penalized",
              "Fetches the top 12 files from raw.githubusercontent.com (separate rate limit from the REST API)",
              "Reads package.json exports field to find declared entry points for TS/JS repos",
            ]}
          />
          <PipelineStep
            step="2"
            title="Extract the API surface"
            description="Parses source files into a structured list of exported symbols — names, signatures, doc comments, deprecated flags."
            details={[
              "TypeScript/JavaScript: TypeScript compiler API, real AST — handles re-exports, generics, overloads",
              "Python: multi-line signature collector, docstring extraction, @deprecated detection",
              "Rust/Go/Java: pub-item, export, and public-member scanners — no guesswork on what's public API",
            ]}
          />
          <PipelineStep
            step="3"
            title="Crawl the documentation"
            description="Firecrawl scrapes the docs site and converts it to clean Markdown — the text a developer actually reads."
            details={[
              "Handles SPAs, JS-rendered content, and multi-page doc sites automatically",
              "Strips nav, sidebars, and boilerplate — Claude only sees the actual documentation prose",
              "Returns page titles + Markdown content, preserving code blocks and headings",
            ]}
          />
          <PipelineStep
            step="4"
            title="Diff with Claude, score deterministically"
            description="Claude finds the mismatches. A deterministic formula turns them into a score — no model-guessed numbers."
            details={[
              "Structured outputs (JSON Schema) enforce the response shape — no prompt engineering, no parse failures",
              "Prompt caching on code + docs blocks: the second run on the same repo hits cache and costs ~80% less",
              "Drift score = Σ(severity weight × confidence factor), capped at 10 — high findings score 3, medium 1.5, low 0.6",
            ]}
          />
        </div>
      </section>

      {/* Supported languages */}
      <section>
        <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Supported languages
        </h2>
        <p className="mb-6 text-center text-xs text-zinc-600">
          Each language has a dedicated extractor tuned to its public API conventions.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LangCard
            dot="bg-blue-400"
            textColor="text-blue-300"
            border="border-blue-500/20"
            bg="bg-blue-500/10"
            name="TypeScript / JavaScript"
            parser="TypeScript compiler API"
            extracts="Exported functions, classes, interfaces, enums, type aliases, const exports, re-exports"
            note="Real AST parsing — handles .d.ts declarations and complex re-export chains"
          />
          <LangCard
            dot="bg-emerald-400"
            textColor="text-emerald-300"
            border="border-emerald-500/20"
            bg="bg-emerald-500/10"
            name="Python"
            parser="Regex + bracket-balancing collector"
            extracts="top-level def, class, @property, __init__; collects docstrings and type annotations"
            note="Detects # deprecated comments and .. deprecated:: Sphinx directives"
          />
          <LangCard
            dot="bg-orange-400"
            textColor="text-orange-300"
            border="border-orange-500/20"
            bg="bg-orange-500/10"
            name="Rust"
            parser="pub-item scanner"
            extracts="pub fn, pub struct, pub trait, pub enum, pub type, pub const — at crate root level"
            note="Detects #[deprecated] attribute and collects /// doc comments"
          />
          <LangCard
            dot="bg-sky-400"
            textColor="text-sky-300"
            border="border-sky-500/20"
            bg="bg-sky-500/10"
            name="Go"
            parser="Export scanner"
            extracts="Uppercase-named func, type, struct, interface, const — skips internal/ and cmd/"
            note="Detects // Deprecated: godoc convention; boosts api/, client/, types.go files"
          />
          <LangCard
            dot="bg-red-400"
            textColor="text-red-300"
            border="border-red-500/20"
            bg="bg-red-500/10"
            name="Java"
            parser="Public-member scanner"
            extracts="public class, interface, enum, record; public methods; public static final constants"
            note="Detects @Deprecated annotation; collects Javadoc; handles generics and inline annotations"
          />
          <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-700 p-5 text-center">
            <p className="text-sm text-zinc-500">
              More languages planned. Each takes ~100 lines — the extractor pattern is designed to extend.
            </p>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-100">
          What every report gives you
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <Feature title="Side-by-side mismatches">
            The exact code snippet next to the conflicting docs snippet, so you
            can see the drift at a glance.
          </Feature>
          <Feature title="A drift score out of 10">
            Deterministic and reproducible — computed from severity-weighted
            findings, not a number the model guessed.
          </Feature>
          <Feature title="Coverage score">
            What percentage of your exported symbols are mentioned anywhere in
            the documentation — a quick proxy for discoverability.
          </Feature>
          <Feature title="Deprecated API detection">
            Symbols marked deprecated in code but undocumented as such are
            flagged as high-severity mismatches automatically.
          </Feature>
          <Feature title="A suggested fix per finding">
            Corrected docs text you can paste straight in, or copy with one
            click.
          </Feature>
          <Feature title="A shareable permalink">
            Every run gets its own URL and Open Graph social card. Post your
            score.
          </Feature>
          <Feature title="Submit to maintainer">
            One click opens a pre-filled GitHub issue — title, Markdown body,
            and documentation label already set.
          </Feature>
          <Feature title="Full transparency">
            See which files were inspected, how many symbols were extracted,
            which doc pages were crawled, and which model ran.
          </Feature>
        </ul>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Common questions
        </h2>
        <p className="mb-6 text-center text-xs text-zinc-600">
          Practical things to know before you run it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Faq q="What repos work best?">
            Public GitHub repos with a dedicated docs site — SDKs, libraries,
            and frameworks where the API surface matters. A README-only project
            works but gives thinner results. Private repos are not supported.
          </Faq>
          <Faq q="How long does it take?">
            Usually 30–90 seconds. GitHub file fetching and Firecrawl crawling
            each take 10–20s. Claude&apos;s analysis varies with repo size. A
            progress bar shows each step live so you&apos;re never staring at a
            spinner.
          </Faq>
          <Faq q="Is the drift score reproducible?">
            Yes — it&apos;s deterministic. The formula is{" "}
            <span className="font-mono text-xs text-zinc-300">
              Σ(weight × confidence)
            </span>{" "}
            capped at 10, where high findings score 3, medium 1.5, low 0.6.
            Same inputs always produce the same score. Claude never picks the
            number.
          </Faq>
          <Faq q="Does re-analyzing the same repo cost more?">
            Much less. Both the extracted API surface and the crawled docs are
            sent with{" "}
            <span className="font-mono text-xs text-zinc-300">
              cache_control: ephemeral
            </span>{" "}
            to Claude. On a re-run within 5 minutes those blocks hit the prompt
            cache — roughly 80% of the token cost is eliminated.
          </Faq>
          <Faq q="What if my language isn't listed?">
            TS/JS, Python, Rust, Go, and Java are fully supported. For other
            languages the tool still runs but falls back to the TS/JS extractor,
            which may miss symbols. Language support is designed to extend — each
            extractor is ~100 lines.
          </Faq>
          <Faq q="How do I share or re-use a report?">
            Every completed report gets a permanent URL at{" "}
            <span className="font-mono text-xs text-zinc-300">
              /report/&#123;id&#125;
            </span>
            . The Dashboard lists all past runs. The re-analyze button on any
            report re-runs with the same URLs pre-filled.
          </Faq>
        </div>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-3xl font-bold text-emerald-400">{value}</dt>
      <dd className="mt-1 text-sm text-zinc-400">{label}</dd>
    </div>
  );
}

function PipelineStep({
  step,
  title,
  description,
  details,
}: {
  step: string;
  title: string;
  description: string;
  details: string[];
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-7 shrink-0 place-items-center rounded-md bg-zinc-800 text-sm font-semibold text-emerald-300">
          {step}
        </div>
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-zinc-400">{description}</p>
      <ul className="space-y-1.5">
        {details.map((d) => (
          <li key={d} className="flex gap-2 text-xs leading-relaxed text-zinc-500">
            <span className="mt-0.5 shrink-0 text-emerald-600">›</span>
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LangCard({
  dot,
  textColor,
  border,
  bg,
  name,
  parser,
  extracts,
  note,
}: {
  dot: string;
  textColor: string;
  border: string;
  bg: string;
  name: string;
  parser: string;
  extracts: string;
  note: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${border} ${bg}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`size-2 rounded-full ${dot}`} />
        <span className={`text-sm font-semibold ${textColor}`}>{name}</span>
      </div>
      <dl className="space-y-2 text-xs">
        <div>
          <dt className="font-medium text-zinc-400">Parser</dt>
          <dd className="mt-0.5 text-zinc-500">{parser}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-400">Extracts</dt>
          <dd className="mt-0.5 text-zinc-500">{extracts}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-400">Note</dt>
          <dd className="mt-0.5 text-zinc-500">{note}</dd>
        </div>
      </dl>
    </div>
  );
}

function Feature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 text-emerald-400" aria-hidden>
        ✓
      </span>
      <div>
        <div className="text-sm font-medium text-zinc-100">{title}</div>
        <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">
          {children}
        </p>
      </div>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <p className="mb-2 text-sm font-semibold text-zinc-100">{q}</p>
      <p className="text-sm leading-relaxed text-zinc-400">{children}</p>
    </div>
  );
}
