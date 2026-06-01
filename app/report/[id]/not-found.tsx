import Link from "next/link";

export default function ReportNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Report not found</h1>
      <p className="mt-2 text-sm text-zinc-400">
        This report doesn&apos;t exist or has expired. Reports are saved when a
        storage backend (Vercel Blob) is configured.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
      >
        Run a new analysis →
      </Link>
    </div>
  );
}
