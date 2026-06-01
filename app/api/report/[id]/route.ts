import { getReport } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    return Response.json({ error: "Report not found." }, { status: 404 });
  }
  return Response.json(report, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
