import { runAnalysis } from "@/lib/pipeline";
import type { AnalyzeInput, StreamEvent } from "@/lib/types";

// The pipeline does real network work (GitHub + Firecrawl + Claude) and uses
// the TypeScript compiler, so it must run on the Node.js runtime, not edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error during analysis.";
}

export async function POST(req: Request): Promise<Response> {
  let body: Partial<AnalyzeInput>;
  try {
    body = (await req.json()) as Partial<AnalyzeInput>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input: AnalyzeInput = {
    repoUrl: body.repoUrl ?? "",
    docsUrl: body.docsUrl ?? "",
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        const report = await runAnalysis(input, (progress) =>
          send({ type: "progress", ...progress }),
        );
        send({ type: "report", report });
      } catch (error) {
        send({ type: "error", message: errorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
