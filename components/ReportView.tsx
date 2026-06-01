import type { DriftReport } from "@/lib/types";
import { countBySeverity } from "@/lib/drift";
import { coverageLabel } from "@/lib/coverage";
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

        {/* Coverage score */}
        {report.coverageScore != null && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <div className="text-2xl font-bold tabular-nums text-zinc-100">
              {report.coverageScore}%
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-300">
                API coverage —{" "}
                <span className="text-zinc-400">
                  {coverageLabel(report.coverageScore)}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {report.coveredSymbols ?? 0} of {report.stats.symbolsExtracted}{" "}
                exported symbols mentioned in docs
              </div>
            </div>
          </div>
        )}

        {/* Deprecated symbols */}
        {(report.deprecatedSymbols ?? []).length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3">
            <div className="text-xs font-medium text-amber-300">
              {report.deprecatedSymbols.length} deprecated API
              {report.deprecatedSymbols.length === 1 ? "" : "s"} detected in
              code
            </div>
            <ul className="mt-2 space-y-0.5">
              {report.deprecatedSymbols.map((s) => (
                <li
                  key={`${s.file}-${s.name}`}
                  className="flex items-center gap-2 text-xs text-zinc-400"
                >
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-amber-300">
                    {s.name}
                  </span>
                  <span className="truncate text-zinc-500">{s.file}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
