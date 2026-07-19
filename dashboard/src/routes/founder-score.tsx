import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, ExternalLink, Github, Loader2, RefreshCw } from "lucide-react";
import {
  getFounderScoreCandidates,
  type FounderScoreAxis,
  type FounderScoreCandidate,
} from "@/lib/founder-score.functions";

export const Route = createFileRoute("/founder-score")({
  head: () => ({
    meta: [
      { title: "Founder Score · Get Funded" },
      {
        name: "description",
        content: "Live Founder Score results from the VC Brain scoring engine.",
      },
    ],
  }),
  component: FounderScorePage,
});

const AXIS_COLOR: Record<FounderScoreAxis["cls"], string> = {
  bull: "var(--success)",
  neutral: "var(--warning)",
  bear: "var(--danger)",
};

function FounderScorePage() {
  const candidatesFn = useServerFn(getFounderScoreCandidates);
  const {
    data: candidates,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["founder-score-candidates"],
    queryFn: () => candidatesFn(),
    refetchInterval: 30_000,
  });

  const list = candidates ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Activity className="h-6 w-6 text-primary" /> Founder Score
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every candidate the VC Brain scoring engine has actually run — real GitHub data,
            component-weighted against the team's ground-truth rubric. Same backend, same numbers as
            the VC Brain dashboard itself.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40 disabled:opacity-60"
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading candidates from the VC Brain backend…
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No candidates yet. Make sure the VC Brain backend is running locally (
          <code className="rounded bg-surface px-1 py-0.5 text-xs">uvicorn main:app --reload</code>{" "}
          from its <code className="rounded bg-surface px-1 py-0.5 text-xs">backend/</code> folder),
          then run a GitHub scan from its own dashboard or via the sourcing API.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {list.map((c) => (
          <CandidateCard key={c.id} candidate={c} />
        ))}
      </div>
    </div>
  );
}

function CandidateCard({ candidate: c }: { candidate: FounderScoreCandidate }) {
  const tags: { label: string; tone: "primary" | "muted" }[] = [];
  if (c.live) tags.push({ label: c.sourceLabel.toUpperCase(), tone: "primary" });
  if (c.newFounder) tags.push({ label: "NEW FOUNDER", tone: "primary" });
  if (c.coldStart) tags.push({ label: "COLD START", tone: "muted" });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold tracking-tight text-foreground">{c.name}</div>
          <a
            href={`https://github.com/${c.handle.replace(/^@/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Github className="h-3 w-3" /> {c.handle} · See GitHub profile
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-primary/40 text-center">
          <div>
            <div className="text-xl font-bold leading-none tabular-nums text-foreground">
              {Math.round(c.founderScore)}
            </div>
            <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
              Founder
              <br />
              Score
            </div>
          </div>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t.label}
              className={
                t.tone === "primary"
                  ? "rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary"
                  : "rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground"
              }
            >
              {t.label}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground">{c.headline}</p>

      <div className="mt-3 text-xs text-muted-foreground">
        Founder Score weighting · GitHub{" "}
        <span className="font-medium text-foreground">{c.scoreBreakdown.github}</span> · LinkedIn{" "}
        <span className="font-medium text-foreground">{c.scoreBreakdown.linkedin}</span> · Scholarly{" "}
        <span className="font-medium text-foreground">{c.scoreBreakdown.scholarly}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <AxisBox label="Founder" axis={c.axes.founder} />
        <AxisBox label="Market" axis={c.axes.market} />
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Idea × Market
          </div>
          <div className="mt-1.5 text-xs font-medium text-muted-foreground">
            {c.axes.ideaVsMarket.label}
          </div>
        </div>
      </div>
    </div>
  );
}

function AxisBox({ label, axis }: { label: string; axis: FounderScoreAxis }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold" style={{ color: AXIS_COLOR[axis.cls] }}>
        {axis.label}
      </div>
    </div>
  );
}
