import { promises as fs } from "node:fs";
import path from "node:path";
import type { DriftReport } from "./types";

/**
 * Report persistence with a pluggable backend:
 *  - If BLOB_READ_WRITE_TOKEN is present (Vercel Blob), reports are stored as
 *    public JSON blobs under `reports/<id>.json` — durable and shareable.
 *  - Otherwise we fall back to the local filesystem under `.reports/`, so the
 *    app works end-to-end in local dev with zero external setup.
 */

const PREFIX = "reports";

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function localDir(): string {
  return path.join(process.cwd(), ".reports");
}

export async function saveReport(report: DriftReport): Promise<void> {
  const json = JSON.stringify(report);
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    await put(`${PREFIX}/${report.id}.json`, json, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return;
  }

  const dir = localDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${report.id}.json`), json, "utf8");
}

export async function getReport(id: string): Promise<DriftReport | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;

  if (hasBlob()) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({
        prefix: `${PREFIX}/${id}.json`,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const match = blobs.find((b) => b.pathname === `${PREFIX}/${id}.json`);
      if (!match) return null;
      const res = await fetch(match.url, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as DriftReport;
    } catch {
      return null;
    }
  }

  try {
    const file = path.join(localDir(), `${id}.json`);
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data) as DriftReport;
  } catch {
    return null;
  }
}
