"use client";

import { useState } from "react";
import type { DriftReport } from "@/lib/types";
import { buildIssueUrl, reportToIssueMarkdown } from "@/lib/github-issue";

export function ShareActions({ report }: { report: DriftReport }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const shareUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/report/${report.id}`;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportToIssueMarkdown(report));
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
      >
        {copiedLink ? "Link copied ✓" : "Copy share link"}
      </button>
      <button
        type="button"
        onClick={copyReport}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
      >
        {copiedReport ? "Copied ✓" : "Copy full report"}
      </button>
      {report.mismatches.length > 0 && (
        <a
          href={buildIssueUrl(report)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
        >
          Open issue with all findings ↗
        </a>
      )}
    </div>
  );
}
