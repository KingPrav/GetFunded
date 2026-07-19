import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search, Sparkles, Github, BookOpen, RefreshCw, Star, Users, FileText,
  Quote, Pencil, ExternalLink, Loader2, CheckCircle2, AlertCircle, X,
} from "lucide-react";
import { FounderCard } from "@/components/founder-card";
import { founders, type Founder } from "@/features/founders/data";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { enrichFounder } from "@/lib/enrich.functions";
import type { EnrichResult } from "@/lib/enrich.functions";
import { discoverFoundersOnGitHub, type DiscoveredFounder } from "@/lib/discover.functions";
import { MapPin, Linkedin } from "lucide-react";

export const Route = createFileRoute("/sourcing")({
  head: () => ({
    meta: [
      { title: "Sourcing · Get Funded" },
      { name: "description", content: "Discover exceptional first-time founders with live GitHub + Semantic Scholar signals." },
    ],
  }),
  component: Sourcing,
});

const examples = [
  "AI infrastructure founder in Berlin",
  "Healthcare AI with no prior VC funding",
  "Technical founder building enterprise SaaS",
];

const industries = ["AI Infrastructure", "Healthcare AI", "Fintech Infrastructure", "Robotics", "DevTools", "Bio × AI"];
const stages = ["Pre-seed", "Seed", "Series A"];
const countries = ["United States", "Germany", "India", "United Kingdom", "Netherlands"];
const flags = ["Technical", "Accelerator", "Open Source", "Patent", "Research", "Prior Funding"];

/* ---------- Handle overrides (localStorage) ---------- */
type Handles = Record<string, { github?: string; scholar?: string }>;
const HANDLES_KEY = "vc-brain:handles";
function loadHandles(): Handles {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(HANDLES_KEY) ?? "{}"); } catch { return {}; }
}
function saveHandles(h: Handles) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HANDLES_KEY, JSON.stringify(h));
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Sourcing() {
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<Set<string>>(new Set());
  const [country, setCountry] = useState<Set<string>>(new Set());
  const [flag, setFlag] = useState<Set<string>>(new Set());
  const [handles, setHandles] = useState<Handles>({});
  const [enriched, setEnriched] = useState<Record<string, EnrichResult>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const enrichFn = useServerFn(enrichFounder);
  const discoverFn = useServerFn(discoverFoundersOnGitHub);

  const discover = useMutation({
    mutationFn: (vars: { query: string; industries: string[]; countries: string[] }) =>
      discoverFn({ data: { query: vars.query, industries: vars.industries, countries: vars.countries, limit: 24 } }),
  });

  useEffect(() => { setHandles(loadHandles()); }, []);

  const toggle = (s: Set<string>, setter: (v: Set<string>) => void, v: string) => {
    const n = new Set(s);
    n.has(v) ? n.delete(v) : n.add(v);
    setter(n);
  };

  const results = useMemo(() => {
    return founders.filter((f) => {
      if (q && !`${f.name} ${f.company} ${f.industry} ${f.location} ${f.bio}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (industry.size && !industry.has(f.industry)) return false;
      if (country.size && !country.has(f.country)) return false;
      return true;
    });
  }, [q, industry, country]);

  const runEnrich = async (f: Founder) => {
    setLoadingIds((s) => new Set(s).add(f.id));
    try {
      const h = handles[f.id] ?? {};
      const data = await enrichFn({ data: { name: f.name, githubHandle: h.github, scholarId: h.scholar } });
      setEnriched((e) => ({ ...e, [f.id]: data }));
    } catch (err) {
      setEnriched((e) => ({ ...e, [f.id]: { github: null, scholar: null, githubCandidates: [], scholarCandidates: [], errors: { github: err instanceof Error ? err.message : "Failed" } } }));
    } finally {
      setLoadingIds((s) => { const n = new Set(s); n.delete(f.id); return n; });
    }
  };

  const bulkEnrich = async () => {
    setBulkProgress({ done: 0, total: results.length });
    // Serial to be polite to unauth APIs
    for (let i = 0; i < results.length; i++) {
      await runEnrich(results[i]);
      setBulkProgress({ done: i + 1, total: results.length });
    }
    setTimeout(() => setBulkProgress(null), 1500);
  };

  const updateHandle = (id: string, patch: { github?: string; scholar?: string }) => {
    setHandles((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      saveHandles(next);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sourcing</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Discover founders</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Live signals from <span className="font-medium text-foreground">GitHub</span> and <span className="font-medium text-foreground">Semantic Scholar</span> — no auth, public data only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => discover.mutate({ query: q, industries: Array.from(industry), countries: Array.from(country) })}
            disabled={discover.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-60"
          >
            {discover.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching GitHub…</>
            ) : (
              <><Github className="h-3.5 w-3.5" /> Find new founders</>
            )}
          </button>
          <button
            onClick={bulkEnrich}
            disabled={bulkProgress !== null}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {bulkProgress ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enriching {bulkProgress.done}/{bulkProgress.total}</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Bulk enrich {results.length}</>
            )}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="relative">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search founders naturally..."
            className="h-11 border-border bg-surface pl-9 text-sm"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Try:</span>
          {examples.map((e) => (
            <button key={e} onClick={() => setQ(e)}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:text-foreground">
              {e}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <FilterRow label="Industry">
            {industries.map((i) => <Chip key={i} label={i} active={industry.has(i)} onClick={() => toggle(industry, setIndustry, i)} />)}
          </FilterRow>
          <FilterRow label="Country">
            {countries.map((c) => <Chip key={c} label={c} active={country.has(c)} onClick={() => toggle(country, setCountry, c)} />)}
          </FilterRow>
          <FilterRow label="Stage">
            {stages.map((s) => <Chip key={s} label={s} active={false} onClick={() => {}} />)}
          </FilterRow>
          <FilterRow label="Signals">
            {flags.map((f) => <Chip key={f} label={f} active={flag.has(f)} onClick={() => toggle(flag, setFlag, f)} />)}
          </FilterRow>
        </div>
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight">
          {results.length} {results.length === 1 ? "match" : "matches"}
          {Object.keys(enriched).length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              · {Object.values(enriched).filter((e) => e.github).length} GitHub · {Object.values(enriched).filter((e) => e.scholar).length} Scholar
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" /> Sorted by founder score
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((f) => (
          <div key={f.id} className="flex flex-col gap-2">
            <FounderCard founder={f} />
            <EnrichPanel
              founder={f}
              handles={handles[f.id] ?? {}}
              result={enriched[f.id]}
              loading={loadingIds.has(f.id)}
              editing={editing === f.id}
              onEdit={() => setEditing(editing === f.id ? null : f.id)}
              onHandleChange={(patch) => updateHandle(f.id, patch)}
              onRefresh={() => runEnrich(f)}
            />
          </div>
        ))}
      </div>

      {(discover.data || discover.isPending || discover.error) && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              <Github className="mr-1.5 inline h-3.5 w-3.5" />
              Discovered on GitHub
              {discover.data && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {discover.data.founders.length} new profiles
                </span>
              )}
            </h2>
            {discover.data && (
              <div className="max-w-md truncate text-[10px] text-muted-foreground" title={discover.data.query}>
                query: <span className="font-mono">{discover.data.query}</span>
              </div>
            )}
          </div>

          {discover.error && (
            <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700">
              GitHub search failed: {String((discover.error as Error).message)}
            </div>
          )}

          {discover.isPending && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching real GitHub profiles matching your thesis…
            </div>
          )}

          {discover.data && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {discover.data.founders.map((d) => <DiscoveredCard key={d.id} f={d} />)}
              {discover.data.founders.length === 0 && (
                <div className="col-span-full rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No GitHub matches — try loosening filters or a broader query.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiscoveredCard({ f }: { f: DiscoveredFounder }) {
  const initials = f.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3">
        {f.avatarUrl ? (
          <img src={f.avatarUrl} alt={f.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{initials}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-semibold text-foreground">{f.name}</div>
            <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Discovered</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            @{f.login}{f.company ? ` · ${f.company}` : ""}
          </div>
          {f.location && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {f.location}
            </div>
          )}
        </div>
      </div>

      {f.bio && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{f.bio}</p>}

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded border border-border bg-surface px-2 py-1">
          <div className="flex items-center gap-1 text-muted-foreground"><Users className="h-2.5 w-2.5" /> Followers</div>
          <div className="mt-0.5 font-semibold tabular-nums text-foreground">{f.followers.toLocaleString()}</div>
        </div>
        <div className="rounded border border-border bg-surface px-2 py-1">
          <div className="flex items-center gap-1 text-muted-foreground"><FileText className="h-2.5 w-2.5" /> Repos</div>
          <div className="mt-0.5 font-semibold tabular-nums text-foreground">{f.publicRepos}</div>
        </div>
      </div>

      {f.topRepo && (
        <a href={f.topRepo.url} target="_blank" rel="noreferrer"
          className="mt-2 block rounded-md border border-border bg-surface p-2 hover:border-primary/40">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="truncate">{f.topRepo.name}</span>
            <span className="shrink-0 text-muted-foreground"><Star className="mr-0.5 inline h-2.5 w-2.5" />{f.topRepo.stars.toLocaleString()}</span>
          </div>
          {f.topRepo.description && <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{f.topRepo.description}</div>}
        </a>
      )}

      <div className="mt-2 flex gap-1.5">
        <a href={f.htmlUrl} target="_blank" rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-surface py-1.5 text-[10px] font-semibold hover:border-primary/40">
          <Github className="h-3 w-3" /> Profile <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(f.name + (f.company ? " " + f.company : ""))}`} target="_blank" rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-surface py-1.5 text-[10px] font-semibold hover:border-primary/40">
          <Linkedin className="h-3 w-3" /> LinkedIn <ExternalLink className="h-2.5 w-2.5" />
        </a>
        {f.blog && (
          <a href={f.blog.startsWith("http") ? f.blog : `https://${f.blog}`} target="_blank" rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-surface py-1.5 text-[10px] font-semibold hover:border-primary/40">
            Site <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* ---------- Enrich panel ---------- */
function EnrichPanel({
  founder, handles, result, loading, editing, onEdit, onHandleChange, onRefresh,
}: {
  founder: Founder;
  handles: { github?: string; scholar?: string };
  result?: EnrichResult;
  loading: boolean;
  editing: boolean;
  onEdit: () => void;
  onHandleChange: (patch: { github?: string; scholar?: string }) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> Live signals
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} title="Edit handles"
            className="rounded-md border border-border bg-surface p-1 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={onRefresh} disabled={loading} title="Refresh"
            className="rounded-md border border-border bg-surface p-1 text-muted-foreground hover:text-foreground disabled:opacity-50">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-2 space-y-2 rounded-md border border-border bg-surface p-2">
          <HandleField
            icon={Github}
            label="GitHub username"
            placeholder="e.g. torvalds"
            value={handles.github ?? ""}
            onChange={(v) => onHandleChange({ github: v })}
          />
          <HandleField
            icon={BookOpen}
            label="Semantic Scholar author ID"
            placeholder="e.g. 1741101"
            value={handles.scholar ?? ""}
            onChange={(v) => onHandleChange({ scholar: v })}
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={onEdit}
              className="rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
              Close
            </button>
            <button onClick={onRefresh}
              className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:opacity-90">
              Apply & fetch
            </button>
          </div>
        </div>
      )}

      {!result && !loading && !editing && (
        <button onClick={onRefresh}
          className="mt-2 w-full rounded-md border border-dashed border-border py-2 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary">
          Fetch GitHub + Scholar signals
        </button>
      )}

      {loading && !result && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Fetching public signals…
        </div>
      )}

      {result && (
        <div className="mt-2 space-y-2">
          <GithubBlock signal={result.github} error={result.errors.github} />
          <ScholarBlock signal={result.scholar} error={result.errors.scholar} />
          {(result.githubCandidates.length > 0 && !result.github) || (result.scholarCandidates.length > 0 && !result.scholar) ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-700">
              <div className="flex items-center gap-1 font-semibold"><AlertCircle className="h-3 w-3" /> Low-confidence match</div>
              <div className="mt-0.5">Use the pencil icon to set the exact handle for {founder.name}.</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function HandleField({ icon: Icon, label, value, placeholder, onChange }: {
  icon: typeof Github; label: string; value: string; placeholder: string; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-card px-2 py-1 pr-6 text-xs outline-none focus:border-primary"
        />
        {value && (
          <button onClick={() => onChange("")}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-surface">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </label>
  );
}

function GithubBlock({ signal, error }: { signal: EnrichResult["github"]; error?: string }) {
  if (error) return <SignalError icon={Github} label="GitHub" error={error} />;
  if (!signal) return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] text-muted-foreground">
      <Github className="h-3 w-3" /> No GitHub match
    </div>
  );
  return (
    <a href={signal.profileUrl} target="_blank" rel="noreferrer"
      className="block rounded-md border border-border bg-surface p-2 transition hover:border-primary/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <Github className="h-3 w-3" /> @{signal.login}
          {signal.matchConfidence < 80 && (
            <span className="rounded bg-amber-500/15 px-1 text-[9px] font-medium text-amber-700">
              {signal.matchConfidence}% match
            </span>
          )}
        </div>
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]">
        <Stat icon={Star} label="Stars" value={signal.aggregateStars.toLocaleString()} />
        <Stat icon={FileText} label="Repos" value={String(signal.publicRepos)} />
        <Stat icon={Users} label="Followers" value={signal.followers.toLocaleString()} />
      </div>
      {signal.topRepos[0] && (
        <div className="mt-1.5 truncate text-[10px] text-muted-foreground">
          Top: <span className="font-medium text-foreground">{signal.topRepos[0].name}</span> · {signal.topRepos[0].stars.toLocaleString()}★
          {signal.topRepos[0].language && <span> · {signal.topRepos[0].language}</span>}
        </div>
      )}
    </a>
  );
}

function ScholarBlock({ signal, error }: { signal: EnrichResult["scholar"]; error?: string }) {
  if (error) return <SignalError icon={BookOpen} label="Semantic Scholar" error={error} />;
  if (!signal) return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] text-muted-foreground">
      <BookOpen className="h-3 w-3" /> No Scholar match
    </div>
  );
  return (
    <a href={signal.profileUrl} target="_blank" rel="noreferrer"
      className="block rounded-md border border-border bg-surface p-2 transition hover:border-primary/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <BookOpen className="h-3 w-3" /> {signal.name}
          {signal.matchConfidence < 80 && (
            <span className="rounded bg-amber-500/15 px-1 text-[9px] font-medium text-amber-700">
              {signal.matchConfidence}% match
            </span>
          )}
        </div>
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]">
        <Stat icon={FileText} label="Papers" value={String(signal.paperCount)} />
        <Stat icon={Quote} label="Citations" value={signal.citationCount.toLocaleString()} />
        <Stat icon={CheckCircle2} label="h-index" value={String(signal.hIndex)} />
      </div>
      {signal.topPapers[0] && (
        <div className="mt-1.5 truncate text-[10px] text-muted-foreground">
          Top: <span className="font-medium text-foreground">{signal.topPapers[0].title}</span>
          {signal.topPapers[0].year && <span> · {signal.topPapers[0].year}</span>}
          <span> · {signal.topPapers[0].citationCount.toLocaleString()} cites</span>
        </div>
      )}
    </a>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-card px-1.5 py-1">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function SignalError({ icon: Icon, label, error }: { icon: typeof Github; label: string; error: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-2 py-1.5 text-[10px] text-rose-700">
      <Icon className="h-3 w-3" /> {label}: {error}
    </div>
  );
}

// keep tanstack-query import registered for future mutation upgrades

