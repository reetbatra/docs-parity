import { scoreTone } from "@/lib/drift";
import { cn } from "@/lib/utils";

const TONE = {
  green: { ring: "stroke-emerald-400", text: "text-emerald-300" },
  amber: { ring: "stroke-amber-400", text: "text-amber-300" },
  orange: { ring: "stroke-orange-400", text: "text-orange-300" },
  red: { ring: "stroke-red-400", text: "text-red-300" },
} as const;

export function DriftScore({
  score,
  label,
  size = 160,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const tone = TONE[scoreTone(score)];
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, score / 10));
  const offset = c * (1 - pct);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Drift score ${score} out of 10: ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-all duration-700", tone.ring)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline">
          <span className={cn("text-5xl font-bold tabular-nums", tone.text)}>
            {score}
          </span>
          <span className="text-lg font-medium text-zinc-500">/10</span>
        </div>
        <span className={cn("mt-1 text-sm font-medium", tone.text)}>
          {label}
        </span>
      </div>
    </div>
  );
}
