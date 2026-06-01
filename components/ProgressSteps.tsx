import { PIPELINE_STEPS, type PipelineStep } from "@/lib/types";
import { cn } from "@/lib/utils";

export const STEP_LABELS: Record<PipelineStep, string> = {
  parse: "Validating input",
  code: "Fetching source from GitHub",
  extract: "Extracting API surface",
  docs: "Crawling documentation",
  analyze: "Analyzing with Claude",
  save: "Saving report",
};

export type StepState = "pending" | "active" | "done";

export function ProgressSteps({
  states,
  details,
}: {
  states: Record<PipelineStep, StepState>;
  details: Partial<Record<PipelineStep, string>>;
}) {
  return (
    <ol className="space-y-3">
      {PIPELINE_STEPS.map((step) => {
        const state = states[step];
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                state === "done" &&
                  "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
                state === "active" && "border-emerald-500/40 text-emerald-300",
                state === "pending" && "border-zinc-800 text-zinc-600",
              )}
            >
              {state === "done" ? (
                "✓"
              ) : state === "active" ? (
                <span className="size-3 animate-spin-slow rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
              ) : (
                "•"
              )}
            </span>
            <span
              className={cn(
                "text-sm",
                state === "pending" ? "text-zinc-600" : "text-zinc-200",
              )}
            >
              {STEP_LABELS[step]}
            </span>
            {details[step] && (
              <span className="text-xs text-zinc-500">— {details[step]}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
