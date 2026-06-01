import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport } from "@/lib/storage";
import { ReportView } from "@/components/ReportView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    return { title: "Report not found · docsParity" };
  }
  const title = `${report.repo.fullName} — drift ${report.driftScore}/10`;
  const description =
    report.summary ||
    `${report.mismatches.length} documentation mismatches found between the code and the docs.`;
  return {
    title: `${title} · docsParity`,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  return (
    <div className="space-y-6">
      <ReportView report={report} />
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
        >
          Check your own repo →
        </Link>
      </div>
    </div>
  );
}
