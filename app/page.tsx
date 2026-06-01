import { DriftForm } from "@/components/DriftForm";

export default function Home() {
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
      <DriftForm />

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

      {/* How it works */}
      <section>
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-zinc-500">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <HowItWorks
            step="1"
            title="Read the real API"
            body="We pull entry points and key source files, then parse them with the TypeScript compiler (TS/JS) or a signature extractor (Python) — not regex."
          />
          <HowItWorks
            step="2"
            title="Crawl the docs"
            body="Firecrawl scrapes the documentation site to clean Markdown — the text developers actually read."
          />
          <HowItWorks
            step="3"
            title="Diff with Claude"
            body="Claude compares signatures, exports and config against the docs and returns the top mismatches, each with a suggested fix."
          />
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
          <Feature title="A suggested fix per finding">
            Corrected docs text you can paste straight in.
          </Feature>
          <Feature title="A shareable permalink">
            Every run gets its own URL and social card. Post your score.
          </Feature>
          <Feature title="Submit to maintainer">
            One click opens a pre-filled GitHub issue with the formatted report.
          </Feature>
          <Feature title="Full transparency">
            See which files were inspected, how many symbols were extracted, and
            which model ran.
          </Feature>
        </ul>
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

function HowItWorks({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-2 grid size-7 place-items-center rounded-md bg-zinc-800 text-sm font-semibold text-emerald-300">
        {step}
      </div>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">{body}</p>
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
