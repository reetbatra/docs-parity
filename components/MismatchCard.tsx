"use client";

import { useState } from "react";
import type { DriftReport, Mismatch } from "@/lib/types";
import { buildIssueUrl, mismatchToMarkdown } from "@/lib/github-issue";
import { SeverityBadge } from "./SeverityBadge";
import { CodeBlock } from "./CodeBlock";

export function MismatchCard({
  report,
  mismatch,
  index,
}: {
  report: DriftReport;
  mismatch: Mismatch;
  index: number;
}) {
  const [copied, setCopied] = useState(false);

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(mismatchToMarkdown(mismatch));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-sm transition-colors hover:border-zinc-700">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-600">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              {mismatch.title}
            </h3>
            {mismatch.file && (
              <p className="mt-0.5 font-mono text-xs text-zinc-500">
                {mismatch.file}
              </p>
            )}
          </div>
        </div>
        <SeverityBadge severity={mismatch.severity} />
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <CodeBlock label="In the code" tone="code">
          {mismatch.code_snippet}
        </CodeBlock>
        <CodeBlock label="In the docs" tone="docs">
          {mismatch.docs_snippet}
        </CodeBlock>
      </div>

      {mismatch.description && (
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          {mismatch.description}
        </p>
      )}

      {mismatch.suggested_fix && (
        <div className="mt-3">
          <CodeBlock label="Suggested fix" tone="fix">
            {mismatch.suggested_fix}
          </CodeBlock>
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={buildIssueUrl(report, mismatch)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white"
        >
          Submit to maintainer
          <span aria-hidden>↗</span>
        </a>
        <button
          type="button"
          onClick={copyMarkdown}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          {copied ? "Copied ✓" : "Copy as Markdown"}
        </button>
        <span className="ml-auto text-xs text-zinc-600">
          {Math.round(mismatch.confidence * 100)}% confidence
        </span>
      </footer>
    </article>
  );
}
