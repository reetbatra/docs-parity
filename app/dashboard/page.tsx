import Link from "next/link";
import { listReports } from "@/lib/storage";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const reports = await listReports();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            All previously analyzed reports
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-emerald-500 hover:text-emerald-300"
        >
          + New analysis
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <p className="text-zinc-400">No reports yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm text-emerald-400 hover:underline"
          >
            Analyze a repo →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-zinc-800 bg-zinc-900/60 px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <span>Report ID</span>
            <span>Date</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/report/${r.id}`}
                className="grid grid-cols-[1fr_auto] gap-4 px-6 py-4 transition-colors hover:bg-zinc-800/50"
              >
                <span className="font-mono text-sm text-zinc-100">{r.id}</span>
                <span className="text-xs text-zinc-500 tabular-nums">
                  {formatDate(r.uploadedAt)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
