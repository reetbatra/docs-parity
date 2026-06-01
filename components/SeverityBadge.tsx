import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Severity, string> = {
  high: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
  low: "bg-zinc-500/15 text-zinc-300 ring-1 ring-inset ring-zinc-500/30",
};

const DOT: Record<Severity, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-zinc-400",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
        STYLES[severity],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[severity])} />
      {severity}
    </span>
  );
}
