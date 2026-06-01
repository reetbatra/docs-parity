import type { DriftReport } from "@/lib/types";
import { countBySeverity } from "@/lib/drift";
import { formatDate, formatDuration } from "@/lib/utils";
import { DriftScore } from "./DriftScore";
import { MismatchCard } from "./MismatchCard";
import { ShareActions } from "./ShareActions";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums text-zinc-100">
        {value}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

export function ReportView({ report }: { report: DriftReport }) {
  const counts = countBySeverity(report.mismatches);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <DriftScore score={report.driftScore} label={report.scoreLabel} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <a
                href={report.repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl font-semibold text-zinc-100 hover:text-emerald-300"
              >
                {report.repo.fullName}
              </a>
              {report.repo.stars > 0 && (
                <span className="text-sm text-zinc-500">
                  ★ {report.repo.stars.toLocaleString()}
                </span>
              )}
            </div>

            <p className="mt-1 truncate text-sm text-zinc-400">
              vs{" "}
              <a
                href={report.docs.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 underline-offset-2 hover:underline"
              >
                {report.docs.url}
              </a>
            </p>

            {report.summary && (
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                {report.summary}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-red-300">
                {counts.high} high
              </span>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-300">
                {counts.medium} medium
              </span>
              <span className="rounded-full bg-zinc-500/15 px-2.5 py-1 text-zinc-300">
                {counts.low} low
              </span>
            </div>

            <div className="mt-5">
              <ShareActions report={report} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-4">
          <Stat label="Files analyzed" value={report.stats.filesAnalyzed} />
          <Stat label="API symbols" value={report.stats.symbolsExtracted} />
          <Stat label="Doc pages" value={report.stats.docPages} />
          <Stat label="Analyzed in" value={formatDuration(report.durationMs)} />
        </div>

        <details className="mt-4 text-xs text-zinc-500">
          <summary className="cursor-pointer select-none hover:text-zinc-300">
            {report.files.length} source files inspected · {report.model} ·{" "}
            {formatDate(report.createdAt)}
          </summary>
          <ul className="mt-2 space-y-1">
            {report.files.map((f) => (
              <li key={f.path}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:text-zinc-300"
                >
                  {f.path}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* Mismatches */}
      {report.mismatches.length === 0 ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-8 text-center">
          <p className="text-lg font-semibold text-emerald-300">
            Full parity — no significant drift found 🎉
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            The documentation matches the code&apos;s public API surface well.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            {report.mismatches.length} mismatch
            {report.mismatches.length === 1 ? "" : "es"} found
          </h2>
          {report.mismatches.map((m, i) => (
            <MismatchCard
              key={`${m.title}-${i}`}
              report={report}
              mismatch={m}
              index={i}
            />
          ))}
        </section>
      )}
    </div>
  );
}
