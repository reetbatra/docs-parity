"use client";

import { useRef, useState } from "react";
import {
  PIPELINE_STEPS,
  type DriftReport,
  type PipelineStep,
  type StreamEvent,
} from "@/lib/types";
import { EXAMPLE_REPOS } from "@/lib/examples";
import { ProgressSteps, type StepState } from "./ProgressSteps";
import { ReportView } from "./ReportView";

type Status = "idle" | "running" | "done" | "error";

function initialStates(): Record<PipelineStep, StepState> {
  return Object.fromEntries(
    PIPELINE_STEPS.map((s) => [s, "pending"]),
  ) as Record<PipelineStep, StepState>;
}

export function DriftForm() {
  const [repoUrl, setRepoUrl] = useState("");
  const [docsUrl, setDocsUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [states, setStates] = useState(initialStates);
  const [details, setDetails] = useState<
    Partial<Record<PipelineStep, string>>
  >({});
  const [report, setReport] = useState<DriftReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const running = status === "running";

  async function run(repo: string, docs: string) {
    setStatus("running");
    setStates(initialStates());
    setDetails({});
    setReport(null);
    setError(null);

    setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repo, docsUrl: docs }),
      });

      if (!res.body) {
        throw new Error("No response stream from the server.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handle = (event: StreamEvent) => {
        if (event.type === "progress") {
          setStates((prev) => ({
            ...prev,
            [event.step]: event.status === "done" ? "done" : "active",
          }));
          if (event.detail) {
            setDetails((prev) => ({ ...prev, [event.step]: event.detail }));
          }
        } else if (event.type === "report") {
          setReport(event.report);
          setStatus("done");
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              `/report/${event.report.id}`,
            );
          }
          setTimeout(
            () => resultsRef.current?.scrollIntoView({ behavior: "smooth" }),
            50,
          );
        } else if (event.type === "error") {
          setError(event.message);
          setStatus("error");
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            handle(JSON.parse(trimmed) as StreamEvent);
          } catch {
            /* ignore malformed partial line */
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          handle(JSON.parse(tail) as StreamEvent);
        } catch {
          /* ignore */
        }
      }

      setStatus((s) => (s === "running" ? "done" : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    run(repoUrl, docsUrl);
  }

  function runExample(repo: string, docs: string) {
    setRepoUrl(repo);
    setDocsUrl(docs);
    if (!running) run(repo, docs);
  }

  return (
    <div className="w-full">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-lg backdrop-blur"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="repoUrl"
            label="GitHub repo URL"
            placeholder="https://github.com/vercel/ai"
            value={repoUrl}
            onChange={setRepoUrl}
            disabled={running}
          />
          <Field
            id="docsUrl"
            label="Documentation URL"
            placeholder="https://ai-sdk.dev/docs"
            value={docsUrl}
            onChange={setDocsUrl}
            disabled={running}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={running || !repoUrl || !docsUrl}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (
              <>
                <span className="size-4 animate-spin-slow rounded-full border-2 border-emerald-900/40 border-t-emerald-900" />
                Analyzing…
              </>
            ) : (
              "Check parity"
            )}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Or try:</span>
            {EXAMPLE_REPOS.map((ex) => (
              <button
                key={ex.name}
                type="button"
                disabled={running}
                onClick={() => runExample(ex.repoUrl, ex.docsUrl)}
                title={ex.description}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40"
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div ref={resultsRef} className="scroll-mt-8">
        {status === "running" && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <ProgressSteps states={states} details={details} />
          </div>
        )}

        {status === "error" && error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-6">
            <p className="font-semibold text-red-300">Analysis failed</p>
            <p className="mt-1 text-sm text-zinc-300">{error}</p>
            <button
              type="button"
              onClick={() => run(repoUrl, docsUrl)}
              className="mt-3 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Try again
            </button>
          </div>
        )}

        {report && (
          <div className="mt-8">
            <ReportView report={report} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-zinc-400"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
      />
    </div>
  );
}
