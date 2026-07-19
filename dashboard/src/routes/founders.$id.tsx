import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft, MapPin, Globe, Mail, Github, GraduationCap, Newspaper,
  Rocket, Linkedin, CheckCircle2, AlertCircle, Clock, ExternalLink,
  Brain, Pin, Plus, Sparkles, Filter,
} from "lucide-react";
import { getFounder, getFounderMemory } from "@/features/founders/data";
import type { Founder, MemoryEntry, MemoryCategory, MemorySource } from "@/features/founders/data";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addMemory, listMemory, togglePinMemory, deleteMemory } from "@/lib/memory.functions";
import { analyzeFounder, getLatestAnalysis } from "@/lib/scoring.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { enrichFounder, type EnrichResult } from "@/lib/enrich.functions";
import { getFounderScoreByHandle, type FounderScoreByHandle } from "@/lib/founder-score.functions";


export const Route = createFileRoute("/founders/$id")({
  loader: ({ params }) => {
    const f = getFounder(params.id);
    if (!f) throw notFound();
    return { founder: f };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.founder.name} · Get Funded` : "Founder · Get Funded" },
      { name: "description", content: loaderData?.founder.bio ?? "Founder workspace" },
    ],
  }),
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Founder not found.</div>
  ),
  errorComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Failed to load founder.</div>
  ),
  component: FounderWorkspace,
});

const tabs = ["Overview", "Memory", "Research", "Evidence", "Interview", "Investment Memo", "Timeline"] as const;
type Tab = (typeof tabs)[number];

function FounderWorkspace() {
  const { founder } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        to="/founders"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All founders
      </Link>

      <FounderHeader founder={founder} />

      <div className="mt-6 border-b border-border">
        <div className="flex flex-wrap gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative px-3 py-2 text-sm font-medium transition-colors",
                tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "Overview" && <OverviewTab founder={founder} />}
        {tab === "Memory" && <MemoryTab founder={founder} />}
        {tab === "Research" && <ResearchTab founder={founder} />}
        {tab === "Evidence" && <EvidenceTab founder={founder} />}
        {tab === "Interview" && <InterviewTab founder={founder} />}
        {tab === "Investment Memo" && <MemoTab founder={founder} />}
        {tab === "Timeline" && <TimelineTab founder={founder} />}
      </div>

    </div>
  );
}

function FounderHeader({ founder }: { founder: Founder }) {
  // Live Founder Score from the VC Brain backend — only wired up for founders that
  // carry a githubHandle (see features/founders/data.ts). Falls back to the mock
  // founderScore below when there's no handle, or no real backend match for it, so
  // this never breaks for the demo founders that were never actually scanned.
  const scoreFn = useServerFn(getFounderScoreByHandle);
  const { data: liveScoreResult } = useQuery({
    queryKey: ["founder-score", founder.githubHandle],
    queryFn: () => scoreFn({ data: { handle: founder.githubHandle! } }),
    enabled: !!founder.githubHandle,
    retry: false,
  });
  const live =
    liveScoreResult && liveScoreResult.found === true
      ? (liveScoreResult as Extract<FounderScoreByHandle, { found: true }>)
      : null;
  const founderScoreValue = live ? live.founderScore : founder.founderScore;

  return (
    <div className="mt-3 grid gap-4 rounded-xl border border-border bg-card p-5 lg:grid-cols-[1fr_auto]">
      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
          {founder.initials}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{founder.name}</h1>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {founder.stage}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {founder.role} · <span className="text-foreground">{founder.company}</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{founder.bio}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {founder.location}</span>
            <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> {founder.website}</span>
            <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {founder.email}</span>
            <span className="inline-flex items-center gap-1"><Linkedin className="h-3 w-3" /> LinkedIn</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:min-w-[420px]">
        <ScoreBig label="Founder" value={founderScoreValue} live={!!live} />
        <ScoreBig label="Opportunity" value={founder.opportunityScore} />
        <ScoreBig label="Trust" value={founder.trustScore} />
      </div>
    </div>
  );
}

function ScoreBig({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {live && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-primary"
            title="Live from the VC Brain Founder Score engine"
          >
            <span className="h-1 w-1 rounded-full bg-primary" /> Live
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-border">
        <div
          className="h-1 rounded-full bg-primary"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function OverviewTab({ founder }: { founder: Founder }) {
  const data = Object.entries(founder.radar).map(([k, v]) => ({
    dim: k.charAt(0).toUpperCase() + k.slice(1),
    value: v,
  }));

  return (
    <div className="space-y-4">
      <AIAnalysisCard founder={founder} />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-sm font-semibold tracking-tight">Founder profile radar</div>
          <div className="mt-3 h-[340px]">
            <ResponsiveContainer>
              <RadarChart data={data}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="dim" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.25}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-sm font-semibold tracking-tight">Recommendation</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-primary">{founder.recommendation}</span>
              <span className="text-xs text-muted-foreground">{founder.confidence}% confidence</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Every recommendation is backed by evidence collected across {founder.claims.length} verified claims. See the Evidence tab for provenance.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-sm font-semibold tracking-tight">Investment thesis fit</div>
            <div className="mt-3 space-y-2 text-sm">
              <Row k="Industry" v={founder.industry} />
              <Row k="Stage" v={founder.stage} />
              <Row k="Geography" v={founder.country} />
              <Row k="Accelerator" v={founder.research.accelerator ?? "None"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIAnalysisCard({ founder }: { founder: Founder }) {
  const qc = useQueryClient();
  const analyzeFn = useServerFn(analyzeFounder);
  const getFn = useServerFn(getLatestAnalysis);

  const { data: latest, isLoading } = useQuery({
    queryKey: ["analysis", founder.id],
    queryFn: () => getFn({ data: { founder_key: founder.id } }),
  });

  const mut = useMutation({
    mutationFn: () =>
      analyzeFn({
        data: {
          founder_key: founder.id,
          snapshot: {
            id: founder.id,
            name: founder.name,
            company: founder.company,
            role: founder.role,
            industry: founder.industry,
            stage: founder.stage,
            country: founder.country,
            bio: founder.bio,
            research: founder.research as unknown as Record<string, unknown>,
            radar: founder.radar as unknown as Record<string, number>,
          },
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["analysis", founder.id] });
      toast.success("AI analysis complete");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasResults = latest?.composite || latest?.axes.founder || latest?.axes.market || latest?.axes.idea;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold tracking-tight">AI Analysis</div>
            <div className="text-xs text-muted-foreground">
              GPT-5.4-mini · 3-axis scoring · never averaged
            </div>
          </div>
        </div>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {mut.isPending ? "Analyzing…" : hasResults ? "Re-analyze" : "Run AI Analysis"}
        </button>
      </div>

      {isLoading && !hasResults && (
        <div className="mt-4 text-xs text-muted-foreground">Loading previous analysis…</div>
      )}

      {!isLoading && !hasResults && !mut.isPending && (
        <p className="mt-4 text-sm text-muted-foreground">
          No analysis yet. Click <span className="font-medium text-foreground">Run AI Analysis</span> to score this founder across
          Founder, Market, and Idea-vs-market — with cited evidence and an explanation for every score.
        </p>
      )}

      {hasResults && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <AxisTile label="Founder" axis={latest?.axes.founder} />
            <AxisTile label="Market" axis={latest?.axes.market} />
            <AxisTile label="Idea vs Market" axis={latest?.axes.idea} />
          </div>

          {latest?.composite && (
            <div className="rounded-lg border border-border bg-background/50 p-4">
              <div className="flex items-baseline justify-between">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Composite score
                </div>
                <div className="text-2xl font-semibold text-primary">
                  {latest.composite.total}
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {latest.composite.reason}
              </p>
              {latest.composite.components && (
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(latest.composite.components as Record<string, { value: number; reason: string }>).map(
                    ([k, v]) => (
                      <div key={k} className="flex items-start gap-2 text-xs">
                        <span className="mt-0.5 shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono font-semibold text-primary">
                          {v.value}
                        </span>
                        <div>
                          <span className="font-medium capitalize text-foreground">{k}</span>
                          <span className="text-muted-foreground"> — {v.reason}</span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AxisTile({
  label,
  axis,
}: {
  label: string;
  axis:
    | {
        score: number;
        confidence: number;
        strengths: string[] | null;
        weaknesses: string[] | null;
        evidence: string[] | null;
        reason: string | null;
      }
    | null
    | undefined;
}) {
  if (!axis) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        {label}: not scored yet
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold text-foreground">
          {axis.score}
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">Confidence {axis.confidence}%</div>
      {axis.reason && <p className="mt-2 text-xs leading-relaxed text-foreground/90">{axis.reason}</p>}
      {axis.evidence && axis.evidence.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {axis.evidence.slice(0, 4).map((e, i) => (
            <span
              key={i}
              className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground"
              title={e}
            >
              {e.length > 40 ? `${e.slice(0, 40)}…` : e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
}

function ResearchTab({ founder }: { founder: Founder }) {
  const r = founder.research;
  const { data: live, isFetching, error, refetch } = useQuery<EnrichResult>({
    queryKey: ["enrich", founder.id, founder.name],
    queryFn: async () => {
      let handles: { githubHandle?: string; scholarId?: string } = {};
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("vc-brain:handles") : null;
        if (raw) {
          const all = JSON.parse(raw) as Record<string, { githubHandle?: string; scholarId?: string }>;
          handles = all[founder.id] ?? {};
        }
      } catch {}
      return enrichFounder({ data: { name: founder.name, ...handles } });
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const gh = live?.github;
  const sc = live?.scholar;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {isFetching
            ? "Fetching live signals from GitHub & Semantic Scholar…"
            : error
              ? "Live enrichment failed — showing cached research."
              : live
                ? `Live signals updated · GitHub ${gh ? "matched" : "no match"} · Scholar ${sc ? "matched" : "no match"}`
                : "Live signals ready."}
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border bg-card px-2 py-1 font-medium hover:bg-surface"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-surface">
                <Github className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold">GitHub {gh && <span className="ml-1 rounded bg-primary/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">Live</span>}</div>
                <div className="text-[11px] text-muted-foreground">
                  {gh
                    ? `${gh.aggregateStars.toLocaleString()} stars · ${gh.publicRepos} repos · ${gh.followers} followers`
                    : `${r.github.stars.toLocaleString()} stars · ${r.github.repos} repos (cached)`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
              <div className="text-sm font-semibold tabular-nums">{gh?.matchConfidence ?? r.github.score}%</div>
            </div>
          </div>
          {gh ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                {gh.bio ?? `@${gh.login}${gh.company ? ` · ${gh.company}` : ""}`}
              </p>
              {gh.topRepos.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {gh.topRepos.slice(0, 3).map((repo) => (
                    <li key={repo.name} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-xs">
                      <a href={repo.url} target="_blank" rel="noreferrer" className="truncate font-medium text-foreground hover:text-primary">
                        {repo.name}
                      </a>
                      <span className="shrink-0 tabular-nums text-muted-foreground">★ {repo.stars.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
              <a href={gh.profileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                View profile <ExternalLink className="h-3 w-3" />
              </a>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{r.github.summary}</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-surface">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold">Semantic Scholar {sc && <span className="ml-1 rounded bg-primary/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">Live</span>}</div>
                <div className="text-[11px] text-muted-foreground">
                  {sc
                    ? `${sc.paperCount} papers · ${sc.citationCount.toLocaleString()} citations · h-index ${sc.hIndex}`
                    : `${r.scholar.papers} papers · ${r.scholar.citations.toLocaleString()} citations (cached)`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
              <div className="text-sm font-semibold tabular-nums">{sc?.matchConfidence ?? r.scholar.score}%</div>
            </div>
          </div>
          {sc ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                {sc.affiliations.length > 0 ? sc.affiliations.join(" · ") : "No affiliations listed."}
              </p>
              {sc.topPapers.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {sc.topPapers.slice(0, 3).map((p) => (
                    <li key={p.title} className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs">
                      <div className="line-clamp-2 font-medium text-foreground">{p.title}</div>
                      <div className="mt-0.5 text-muted-foreground">
                        {p.year ?? "—"} · {p.venue ?? "—"} · {p.citationCount.toLocaleString()} cites
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <a href={sc.profileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                View profile <ExternalLink className="h-3 w-3" />
              </a>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{r.scholar.summary}</p>
          )}
        </div>

        {[
          { icon: Linkedin, name: "LinkedIn", summary: r.linkedin.summary, score: r.linkedin.score, extra: "Employment verified" },
          { icon: Rocket, name: "Product Hunt", summary: r.productHunt.summary, score: r.productHunt.score, extra: "" },
          { icon: Newspaper, name: "News", summary: r.news.summary, score: r.news.score, extra: "" },
        ].map((s) => (
          <div key={s.name} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-surface">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{s.name}</div>
                  {s.extra && <div className="text-[11px] text-muted-foreground">{s.extra}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
                <div className="text-sm font-semibold tabular-nums">{s.score}%</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{s.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceTab({ founder }: { founder: Founder }) {
  return (
    <div className="space-y-3">
      {founder.claims.map((c) => {
        const Icon = c.verified === "Verified" ? CheckCircle2 : c.verified === "Needs Verification" ? AlertCircle : Clock;
        const color =
          c.verified === "Verified"
            ? "text-[color:var(--success)]"
            : c.verified === "Needs Verification"
              ? "text-[color:var(--warning)]"
              : "text-muted-foreground";
        return (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", color)} />
                  <div className="text-sm font-semibold">{c.claim}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.evidence.map((e) => (
                    <span key={e} className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                      {e}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Source: <span className="text-foreground">{c.source}</span> · Collected {c.date}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
                <div className="text-lg font-semibold tabular-nums">{c.confidence}%</div>
                <div className={cn("mt-1 text-[11px] font-medium", color)}>{c.verified}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InterviewTab({ founder }: { founder: Founder }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-sm font-semibold">Structured interview — draft questions</div>
        <ol className="mt-3 space-y-3 text-sm">
          {[
            "Walk me through the 90 days that led to founding " + founder.company + ".",
            "What's the sharpest customer objection you've heard, and how did you address it?",
            "Where does the wedge break in 18 months if you don't raise?",
            "Which hire is currently blocking your roadmap most?",
            "Tell me about a decision you reversed in the last quarter.",
          ].map((q, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
              <span className="text-xs font-semibold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span>{q}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-semibold">Scheduled</div>
          <div className="mt-2 text-sm text-muted-foreground">Thu, Jul 25 · 10:00 · Zoom</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm font-semibold">Prep signals</div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div>· 4 unresolved claims to probe</div>
            <div>· 2 reference checks pending</div>
            <div>· Deck v3 in data room</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoTab({ founder }: { founder: Founder }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Investment memo · Draft
      </div>
      <h2 className="mt-1 text-xl font-semibold">{founder.company} — Series Seed</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Prepared for Investment Committee · {new Date().toLocaleDateString()}
      </p>
      <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
        {[
          ["Recommendation", `${founder.recommendation} · ${founder.confidence}% confidence`],
          ["Check size", "$3.0M lead"],
          ["Round", "$6.0M seed at $32M post"],
          ["Ownership target", "9.4%"],
          ["Board", "Observer with pro-rata"],
          ["Key risks", "First-time CEO · Enterprise sales motion unproven"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-surface p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="mt-1">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Thesis.</span> {founder.name} is building the retrieval layer for enterprise AI agents at a moment when every Fortune 500 has an internal agent mandate. The technical wedge is defensible on latency and evaluation.
        </p>
        <p>
          <span className="font-semibold text-foreground">Why now.</span> Vector search primitives have commoditized; the differentiated layer is orchestration, evaluation, and continuous learning — where {founder.company} focuses.
        </p>
        <p>
          <span className="font-semibold text-foreground">Team.</span> {founder.bio}
        </p>
        <p>
          <span className="font-semibold text-foreground">Risk & mitigation.</span> Hyperscaler bundling risk is real; the design-partner motion suggests {founder.company} is winning on developer experience rather than pricing. See Evidence tab for provenance.
        </p>
      </div>
    </div>
  );
}

function TimelineTab({ founder }: { founder: Founder }) {
  return (
    <div className="relative pl-6">
      <div className="absolute inset-y-0 left-2 w-px bg-border" />
      <div className="space-y-4">
        {founder.timeline.map((e) => (
          <div key={e.id} className="relative">
            <div className="absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {e.type}
                  </span>
                  <div className="text-sm font-semibold">{e.title}</div>
                </div>
                <div className="text-[11px] text-muted-foreground">{e.date}</div>
              </div>
              {e.description && (
                <p className="mt-1.5 text-sm text-muted-foreground">{e.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3" /> All timestamps normalized to founder's local timezone.
      </div>
    </div>
  );
}

// ================= Memory Tab =================

const MEMORY_CATEGORIES: MemoryCategory[] = [
  "Background", "Skill", "Motivation", "Risk", "Network", "Preference", "Milestone", "Signal",
];

const MEMORY_SOURCES: MemorySource[] = [
  "Interview", "Research", "Evidence", "Email", "Manual", "Memo", "Meeting",
];

const CATEGORY_STYLE: Record<MemoryCategory, string> = {
  Background: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Skill: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Motivation: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Risk: "bg-red-500/10 text-red-600 border-red-500/20",
  Network: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  Preference: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Milestone: "bg-primary/10 text-primary border-primary/20",
  Signal: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type DbMemory = {
  id: string;
  category: string;
  source: string;
  content: string;
  summary: string | null;
  confidence: number;
  pinned: boolean;
  created_at: string;
};

function toDisplay(rows: DbMemory[]): MemoryEntry[] {
  const cap = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)) as MemoryCategory;
  return rows.map((r) => ({
    id: r.id,
    category: cap(r.category) as MemoryCategory,
    source: cap(r.source) as MemorySource,
    sourceRef: r.summary ?? undefined,
    content: r.content,
    confidence: r.confidence,
    pinned: r.pinned,
    createdAt: r.created_at,
  }));
}

function MemoryTab({ founder }: { founder: Founder }) {
  const qc = useQueryClient();
  const seed = useMemo(() => getFounderMemory(founder.id), [founder.id]);
  const listFn = useServerFn(listMemory);
  const addFn = useServerFn(addMemory);
  const togglePinFn = useServerFn(togglePinMemory);
  const deleteFn = useServerFn(deleteMemory);

  const query = useQuery({
    queryKey: ["memory", founder.id],
    queryFn: () => listFn({ data: { founder_key: founder.id } }),
  });

  const dbEntries = query.data ? toDisplay(query.data as DbMemory[]) : [];
  const entries: MemoryEntry[] = dbEntries.length > 0 ? dbEntries : seed;

  const [filter, setFilter] = useState<MemoryCategory | "All">("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [draftCategory, setDraftCategory] = useState<MemoryCategory>("Signal");
  const [draftSource, setDraftSource] = useState<MemorySource>("Manual");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => (filter === "All" ? true : e.category === filter))
      .filter((e) => (search ? e.content.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (b.createdAt.localeCompare(a.createdAt)));
  }, [entries, filter, search]);

  const stats = useMemo(() => {
    const total = entries.length;
    const pinned = entries.filter((e) => e.pinned).length;
    const avgConfidence = Math.round(entries.reduce((s, e) => s + e.confidence, 0) / Math.max(1, total));
    const risks = entries.filter((e) => e.category === "Risk").length;
    return { total, pinned, avgConfidence, risks };
  }, [entries]);

  const handleAdd = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      await addFn({
        data: {
          founder_key: founder.id,
          category: draftCategory.toLowerCase() as "background",
          source: draftSource.toLowerCase(),
          content: draft.trim(),
          confidence: 80,
          metadata: {},
          pinned: false,
        },
      });
      setDraft("");
      await qc.invalidateQueries({ queryKey: ["memory", founder.id] });
      toast.success("Memory saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (id: string) => {
    const entry = dbEntries.find((e) => e.id === id);
    if (!entry) return; // seed entries aren't persisted yet
    try {
      await togglePinFn({ data: { id, pinned: !entry.pinned } });
      await qc.invalidateQueries({ queryKey: ["memory", founder.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const removeEntry = async (id: string) => {
    if (!dbEntries.find((e) => e.id === id)) return;
    try {
      await deleteFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["memory", founder.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };
  void removeEntry;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Add to founder memory</div>
              <div className="text-xs text-muted-foreground">
                Anything captured here is retrieved during scoring, screening, and interviews.
              </div>
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`What did you just learn about ${founder.name}?`}
            className="min-h-[80px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value as MemoryCategory)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              {MEMORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={draftSource}
              onChange={(e) => setDraftSource(e.target.value as MemorySource)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              {MEMORY_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={handleAdd}
              disabled={!draft.trim()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Save memory
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filter
          </div>
          <button
            onClick={() => setFilter("All")}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              filter === "All" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All · {entries.length}
          </button>
          {MEMORY_CATEGORIES.map((c) => {
            const n = entries.filter((e) => e.category === c).length;
            if (!n) return null;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  filter === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c} · {n}
              </button>
            );
          })}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memory…"
            className="ml-auto w-48 rounded-md border border-border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No memories match this filter yet.
            </div>
          )}
          {filtered.map((entry) => (
            <div key={entry.id} className="group rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", CATEGORY_STYLE[entry.category])}>
                  {entry.category}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground">{entry.content}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Brain className="h-3 w-3" /> {entry.source}{entry.sourceRef ? ` · ${entry.sourceRef}` : ""}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(entry.createdAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full bg-primary" style={{ width: `${entry.confidence}%` }} />
                      </span>
                      {entry.confidence}% confidence
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => togglePin(entry.id)}
                  className={cn(
                    "shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100",
                    entry.pinned && "text-primary opacity-100",
                  )}
                  aria-label={entry.pinned ? "Unpin" : "Pin"}
                >
                  <Pin className={cn("h-3.5 w-3.5", entry.pinned && "fill-current")} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Memory index</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Entries" value={stats.total} />
            <Stat label="Pinned" value={stats.pinned} />
            <Stat label="Avg confidence" value={`${stats.avgConfidence}%`} />
            <Stat label="Risk flags" value={stats.risks} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> AI synthesis
          </div>
          <p className="mt-2 text-sm text-foreground/90">
            {founder.name} shows strong signal on domain depth and execution velocity. The dominant risk pattern is first-time-CEO GTM. Recommend probing pricing conviction and hiring plan in the next interview.
          </p>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Synthesized from {stats.total} memory entries · updated {fmtDate(new Date().toISOString())}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Sources</div>
          <div className="mt-3 space-y-1.5 text-xs">
            {MEMORY_SOURCES.map((s) => {
              const n = entries.filter((e) => e.source === s).length;
              if (!n) return null;
              return (
                <div key={s} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{s}</span>
                  <span className="font-medium text-foreground">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
