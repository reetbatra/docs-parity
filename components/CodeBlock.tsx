import { cn } from "@/lib/utils";

export function CodeBlock({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: string;
  tone?: "neutral" | "code" | "docs" | "fix";
}) {
  const toneClasses = {
    neutral: "border-zinc-800 bg-zinc-900/60",
    code: "border-zinc-800 bg-zinc-900/60",
    docs: "border-zinc-800 bg-zinc-900/40",
    fix: "border-emerald-500/30 bg-emerald-500/[0.06]",
  }[tone];

  const labelClasses = {
    neutral: "text-zinc-500",
    code: "text-sky-400/80",
    docs: "text-amber-400/80",
    fix: "text-emerald-400/90",
  }[tone];

  return (
    <div className={cn("rounded-lg border", toneClasses)}>
      <div
        className={cn(
          "border-b border-zinc-800/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider",
          labelClasses,
        )}
      >
        {label}
      </div>
      <pre className="thin-scroll overflow-x-auto px-3 py-2.5 text-[13px] leading-relaxed text-zinc-200">
        <code className="font-mono whitespace-pre-wrap break-words">
          {children || "—"}
        </code>
      </pre>
    </div>
  );
}
