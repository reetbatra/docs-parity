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
          Paste a GitHub repo and a docs URL. It reads the exported API surface,
          crawls the docs, and shows you exactly where they disagree. Sorted by
          severity, each finding comes with the fix.
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
          A developer follows the docs, hits an error, and spends two hours
          debugging. The method signature changed six weeks ago. Nobody updated
          the docs. docsParity catches this in 30 seconds, before it costs
          anyone an afternoon.
        </p>
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          <Metric value="30s" label="From two URLs to a ranked report" />
          <Metric value="/10" label="A deterministic, shareable drift score" />
          <Metric value="1-click" label="File the fix as a GitHub issue" />
        </dl>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wider text-zinc-500">
          How it works
        </h2>
        <p className="mb-6 text-center text-xs text-zinc-600">
          Four stages. Each one is deterministic and inspectable.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <PipelineStep
            step="1"
            title="Fetch the source files"
            description="Reads the repo file tree from GitHub and picks the most API-relevant files. Not the whole codebase, just what matters."
            details={[
              "Scores every file: entry points from package.json exports get +100, api/index/sdk filenames get +25, depth is penalized",
              "Fetches the top 12 files from raw.githubusercontent.com, which has a separate rate limit from the REST API",
              "Reads package.json exports to find declared entry points for TS/JS repos",
            ]}
          />
          <PipelineStep
            step="2"
            title="Extract the API surface"
            description="Parses source files into a structured list of exported symbols: names, signatures, doc comments, and deprecated flags."
            details={[
              "TypeScript/JavaScript uses the TypeScript compiler API for real AST parsing. Handles re-exports, generics, and overloads.",
              "Python, Rust, Go, and Java each have a dedicated extractor tuned to that language's public API conventions",
              "Every symbol carries: name, kind, signature, file path, line number, and a deprecated flag",
            ]}
          />
          <PipelineStep
            step="3"
            title="Crawl the docs"
            description="Firecrawl converts the docs site to clean Markdown, stripping nav and sidebars so Claude reads only what developers read."
            details={[
              "Handles SPAs, JS-rendered content, and multi-page doc sites automatically",
              "Strips navigation, sidebars, and boilerplate so the signal-to-noise ratio is high",
              "Returns page titles and Markdown content with code blocks and headings preserved",
            ]}
          />
          <PipelineStep
            step="4"
            title="Diff and score"
            description="Claude compares the API surface to the docs and flags every mismatch. A deterministic formula scores them. No model-guessed numbers."
            details={[
              "Structured outputs (JSON Schema) enforce the response shape. No prompt engineering needed, no parse failures.",
              "Prompt caching on the code and docs blocks: a re-run within 5 minutes hits cache and cuts roughly 80% of the token cost",
              "Drift score = sum of (severity weight x confidence factor), capped at 10. High: 3 pts, medium: 1.5, low: 0.6",
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
          Each language has a dedicated extractor tuned to its public API
          conventions.
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
            note="Real AST parsing; handles .d.ts declarations and complex re-export chains"
          />
          <LangCard
            dot="bg-emerald-400"
            textColor="text-emerald-300"
            border="border-emerald-500/20"
            bg="bg-emerald-500/10"
            name="Python"
            parser="Regex + bracket-balancing collector"
            extracts="Top-level def, class, @property, __init__; collects docstrings and type annotations"
            note="Detects # deprecated comments and the .. deprecated:: Sphinx directive"
          />
          <LangCard
            dot="bg-orange-400"
            textColor="text-orange-300"
            border="border-orange-500/20"
            bg="bg-orange-500/10"
            name="Rust"
            parser="pub-item scanner"
            extracts="pub fn, pub struct, pub trait, pub enum, pub type, pub const at crate root level"
            note="Detects the #[deprecated] attribute and collects /// doc comments"
          />
          <LangCard
            dot="bg-sky-400"
            textColor="text-sky-300"
            border="border-sky-500/20"
            bg="bg-sky-500/10"
            name="Go"
            parser="Export scanner"
            extracts="Uppercase-named func, type, struct, interface, const; skips internal/ and cmd/"
            note="Detects the // Deprecated: godoc convention; boosts api/, client/, types.go files"
          />
          <LangCard
            dot="bg-red-400"
            textColor="text-red-300"
            border="border-red-500/20"
            bg="bg-red-500/10"
            name="Java"
            parser="Public-member scanner"
            extracts="public class, interface, enum, record; public methods; public static final constants"
            note="Detects @Deprecated; collects Javadoc; handles generics and inline annotations"
          />
          <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-700 p-5 text-center">
            <p className="text-sm text-zinc-500">
              More languages planned. Each extractor is around 100 lines and the
              pattern is designed to extend.
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
            The exact code snippet next to the conflicting docs text. You see
            the drift in one glance.
          </Feature>
          <Feature title="A drift score out of 10">
            Computed from severity-weighted findings, not a number Claude
            guessed. Same repo always scores the same.
          </Feature>
          <Feature title="Coverage score">
            The percentage of exported symbols that appear in the docs. A quick
            read on how discoverable your API is.
          </Feature>
          <Feature title="Deprecated API detection">
            Symbols marked deprecated in code but not flagged in docs show up as
            high-severity mismatches automatically.
          </Feature>
          <Feature title="A suggested fix per finding">
            Corrected docs text you can paste straight in or copy with one
            click.
          </Feature>
          <Feature title="A shareable permalink">
            Every run gets its own URL and Open Graph card. Post your score.
          </Feature>
          <Feature title="File as a GitHub issue">
            One click opens a pre-filled issue on the repo, documentation label
            included.
          </Feature>
          <Feature title="Full transparency">
            See which files were read, how many symbols were extracted, which
            doc pages were crawled, and which model ran.
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
            Public GitHub repos with a dedicated docs site. SDKs, libraries, and
            frameworks are ideal. A README-only project gives thinner results.
            Private repos are not supported.
          </Faq>
          <Faq q="How long does it take?">
            Usually 30 to 90 seconds. GitHub fetching and Firecrawl crawling
            each take 10 to 20 seconds. Claude varies with repo size. A
            step-by-step progress bar keeps you oriented throughout.
          </Faq>
          <Faq q="Is the drift score reproducible?">
            Yes. The formula is sum(weight x confidence), capped at 10: high
            findings score 3, medium 1.5, low 0.6. The same inputs always
            produce the same score. Claude never picks the number.
          </Faq>
          <Faq q="Does re-analyzing the same repo cost more?">
            Much less. The API surface and docs blocks are sent with{" "}
            <span className="font-mono text-xs text-zinc-300">
              cache_control: ephemeral
            </span>
            . A re-run within 5 minutes hits the cache and cuts roughly 80% of
            the token cost.
          </Faq>
          <Faq q="What if my language is not listed?">
            TS/JS, Python, Rust, Go, and Java are fully supported. Other
            languages still run but fall back to the TS/JS extractor, which may
            miss symbols. Each extractor is around 100 lines and the pattern is
            designed to extend.
          </Faq>
          <Faq q="How do I share or re-use a report?">
            Every completed report gets a permanent URL at{" "}
            <span className="font-mono text-xs text-zinc-300">
              /report/&#123;id&#125;
            </span>
            . The Dashboard lists all past runs. The re-analyze button re-runs
            with the same URLs pre-filled.
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
