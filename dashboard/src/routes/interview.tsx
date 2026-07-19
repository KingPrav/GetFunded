import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { founders as allFounders, type Founder } from "@/features/founders/data";
import {
  Video, Mic, MicOff, Calendar, Clock, Sparkles, Play, Pause, Square,
  CheckCircle2, Circle, ChevronRight, FileText, Brain, Target, ShieldAlert,
  Lightbulb, Users, TrendingUp, Search, Download, Copy, Plus, MessageSquare,
  Volume2, Radio, ListChecks, Wand2, Github, Trophy,
} from "lucide-react";

const founders = [...allFounders].sort(
  (a, b) => b.founderScore + b.opportunityScore - (a.founderScore + a.opportunityScore),
);

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "AI Interviews · Get Funded" },
      { name: "description", content: "Run AI-assisted founder interviews with live transcription, coverage tracking, and post-session synthesis." },
    ],
  }),
  component: InterviewPage,
});

/* ---------- Types ---------- */
type Section = "Background" | "Motivation" | "Skill" | "Market" | "Risk" | "Vision";
type Q = {
  id: string;
  section: Section;
  question: string;
  rationale: string;
  linkedClaim?: string;
  priority: "Critical" | "High" | "Medium";
  covered?: boolean;
};
type Turn = { id: string; speaker: "Founder" | "Investor" | "AI"; text: string; t: string; qId?: string };
type Tab = "prep" | "live" | "transcript" | "synthesis";

const sectionMeta: Record<Section, { icon: typeof Brain; color: string }> = {
  Background: { icon: FileText, color: "text-sky-600" },
  Motivation: { icon: Lightbulb, color: "text-amber-600" },
  Skill: { icon: Target, color: "text-emerald-600" },
  Market: { icon: TrendingUp, color: "text-violet-600" },
  Risk: { icon: ShieldAlert, color: "text-rose-600" },
  Vision: { icon: Sparkles, color: "text-primary" },
};

/* ---------- AI Interview guide generator (deterministic per-founder mock) ---------- */
function buildGuide(f: Founder): Q[] {
  const gaps = f.claims.filter((c) => c.verified !== "Verified").map((c) => c.claim);
  const weak = [
    ...f.screening.founder.weaknesses,
    ...f.screening.market.weaknesses,
    ...f.screening.fit.weaknesses,
  ];
  return [
    { id: "q1", section: "Background", priority: "High",
      question: `Walk me through the moment you decided to leave ${f.research.linkedin.summary.split(".")[0].split("+")[0].trim() || "your last role"} to start ${f.company}.`,
      rationale: "Origin story reveals conviction depth and opportunity cost willingness." },
    { id: "q2", section: "Motivation", priority: "Critical",
      question: `What is the emotional core of why you specifically must build ${f.company}?`,
      rationale: "Founder-market fit signal. Distinguish mission-driven vs. opportunistic." },
    { id: "q3", section: "Skill", priority: "High",
      question: `Describe the hardest technical or operational problem you personally solved in the last 90 days.`,
      rationale: "Probe execution velocity and hands-on depth beyond LinkedIn." },
    ...(gaps[0] ? [{ id: "q4", section: "Risk" as Section, priority: "Critical" as const,
      question: `Can you walk me through the numbers behind "${gaps[0]}"? I'd like to see the underlying data.`,
      rationale: "Verify unverified claim from screening. Confidence currently below threshold.",
      linkedClaim: gaps[0] }] : []),
    { id: "q5", section: "Market", priority: "High",
      question: `Who is your worst-case competitor in 18 months, and what do they do that you can't?`,
      rationale: "Tests self-awareness and competitive strategic thinking." },
    ...(weak[0] ? [{ id: "q6", section: "Risk" as Section, priority: "High" as const,
      question: `Screening flagged: "${weak[0]}". How do you disagree with that assessment — or how are you actively addressing it?`,
      rationale: "Directly confront known weakness. Look for coachability + specificity." }] : []),
    { id: "q7", section: "Skill", priority: "Medium",
      question: `Tell me about a hire that didn't work out. What did you learn?`,
      rationale: "Post-mortem thinking, self-awareness, hiring judgment." },
    { id: "q8", section: "Vision", priority: "High",
      question: `If ${f.company} succeeds beyond your wildest dreams in 10 years, what does the world look like?`,
      rationale: "Vision ceiling. Ambition calibration." },
    { id: "q9", section: "Motivation", priority: "Medium",
      question: `What would make you shut this company down?`,
      rationale: "Values, integrity, and grit signal. Watch for evasion." },
    { id: "q10", section: "Market", priority: "Medium",
      question: `Which customer conversation this quarter most changed your roadmap, and how?`,
      rationale: "Customer proximity + willingness to update priors." },
  ];
}

/* ---------- Simulated live transcript ---------- */
function buildTranscript(f: Founder, guide: Q[]): Turn[] {
  const first = f.name.split(" ")[0];
  return [
    { id: "s1", speaker: "Investor", t: "00:00", text: `Thanks for making the time, ${first}. Let's start wide — walk me through the origin of ${f.company}.`, qId: "q1" },
    { id: "s2", speaker: "Founder", t: "00:12", text: `Yeah, of course. So the honest version is I hit a wall on the retrieval team where I could see exactly what enterprises needed, but the roadmap was optimized for consumer surface area. I gave myself six weekends to prototype what I would build, and by week four I had three design partners asking to pay.` },
    { id: "s3", speaker: "AI", t: "00:38", text: `↳ Detected: converts intent → prototype → paying design partners in <30 days. Strong bias-to-action signal. Auto-logged to Founder Memory (Skill).` },
    { id: "s4", speaker: "Investor", t: "00:52", text: `On the emotional core — why does this specifically have to be you?`, qId: "q2" },
    { id: "s5", speaker: "Founder", t: "01:04", text: `Because I've watched extraordinary models be crippled by mediocre retrieval, and there are maybe 30 people on the planet who've built this at real scale. If I don't do it, the second-best team will ship something adequate and everyone loses two years.` },
    { id: "s6", speaker: "AI", t: "01:24", text: `↳ Mission-driven + credibility-anchored. Compare to prior founders: 87th percentile conviction score.` },
    { id: "s7", speaker: "Investor", t: "01:41", text: `The deck shows $1.4M ARR from 12 design partners — can you show me the underlying revenue?`, qId: "q4" },
    { id: "s8", speaker: "Founder", t: "01:52", text: `Yes — I can share the Stripe dashboard live. Eight of the twelve are on annual contracts averaging $140k, three are on monthly at $8-12k, and one is a paid pilot converting in Q4.` },
    { id: "s9", speaker: "AI", t: "02:18", text: `↳ Verifiable in-session. Marking claim "$1.4M ARR from 12 enterprise design partners" as Pending Live Verification. Requires Stripe screenshot artifact.` },
    { id: "s10", speaker: "Investor", t: "02:31", text: `Worst-case competitor 18 months from now?`, qId: "q5" },
    { id: "s11", speaker: "Founder", t: "02:38", text: `Honestly? Not Pinecone — it's an AWS Bedrock feature bundle. If they ship native hybrid retrieval with per-tenant isolation, our wedge shrinks. Our answer is to be 10x faster at the eval loop and own the enterprise agent framework layer.` },
    { id: "s12", speaker: "AI", t: "03:02", text: `↳ Named specific competitive risk + articulated defensible response. Coachability signal: HIGH.` },
    { id: "s13", speaker: "Investor", t: "03:20", text: `Screening flagged "First-time CEO, limited GTM history." How are you addressing it?`, qId: "q6" },
    { id: "s14", speaker: "Founder", t: "03:32", text: `Fair. I'm closing a VP Sales next week — Priya Rao, ex-Databricks first enterprise AE. I'm also spending 40% of my week in customer calls; I don't think I can outsource that until we're at $10M ARR.` },
    { id: "s15", speaker: "AI", t: "03:58", text: `↳ Named specific hire + retention of founder-led sales through PMF. Strong. Suggest verifying Priya Rao reference in follow-up.` },
    { id: "s16", speaker: "Investor", t: "04:15", text: `Last one — 10 years from now, ${f.company} succeeds wildly. What does the world look like?`, qId: "q8" },
    { id: "s17", speaker: "Founder", t: "04:24", text: `Every enterprise agent — whether it's inside SAP, Salesforce, or a startup — runs on our retrieval fabric. We become the Postgres of the agent era. Boring, ubiquitous, indispensable.` },
    { id: "s18", speaker: "AI", t: "04:48", text: `↳ Vision framing: platform, not product. Analogy is deliberately understated (positive signal for realism).` },
  ];
}

/* ---------- Main ---------- */
function InterviewPage() {
  const [selectedId, setSelectedId] = useState<string>(founders[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("prep");
  const founder = useMemo(() => founders.find((f) => f.id === selectedId) ?? founders[0], [selectedId]);
  const guide = useMemo(() => buildGuide(founder), [founder]);
  const transcript = useMemo(() => buildTranscript(founder, guide), [founder, guide]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> Interview Scores · Top-ranked founders
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Interview <span className="text-primary">{founder.name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by combined founder + opportunity score. Only the highest-scoring founders qualify for an AI-assisted interview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-card">
            <Calendar className="h-3.5 w-3.5" /> Schedule
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
            <Video className="h-3.5 w-3.5" /> Start session
          </button>
        </div>
      </div>

      {/* Founder selector — ranked by score */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {founders.map((f, i) => {
          const active = f.id === selectedId;
          const combined = f.founderScore + f.opportunityScore;
          const githubUrl = `https://github.com/search?q=${encodeURIComponent(f.name)}&type=users`;
          return (
            <div
              key={f.id}
              className={`flex shrink-0 items-center gap-1 rounded-full border pr-1 text-xs font-medium transition ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <button
                onClick={() => setSelectedId(f.id)}
                className="flex items-center gap-2 py-1.5 pl-3"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{f.name}</span>
                <span className="opacity-70">· {f.company}</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
                  {combined}
                </span>
              </button>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Open ${f.name} on GitHub`}
                className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <Github className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-border">
        {([
          { id: "prep", label: "Prep Briefing", icon: Brain },
          { id: "live", label: "Live Session", icon: Radio },
          { id: "transcript", label: "Transcript", icon: MessageSquare },
          { id: "synthesis", label: "AI Synthesis", icon: Wand2 },
        ] as { id: Tab; label: string; icon: typeof Brain }[]).map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === "prep" && <PrepTab founder={founder} guide={guide} />}
        {tab === "live" && <LiveTab founder={founder} guide={guide} transcript={transcript} />}
        {tab === "transcript" && <TranscriptTab transcript={transcript} guide={guide} />}
        {tab === "synthesis" && <SynthesisTab founder={founder} />}
      </div>
    </div>
  );
}

/* ---------- Prep tab ---------- */
function PrepTab({ founder, guide }: { founder: Founder; guide: Q[] }) {
  const [filter, setFilter] = useState<Section | "All">("All");
  const filtered = filter === "All" ? guide : guide.filter((q) => q.section === filter);
  const bySection = guide.reduce<Record<string, number>>((acc, q) => {
    acc[q.section] = (acc[q.section] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Chip active={filter === "All"} onClick={() => setFilter("All")}>All · {guide.length}</Chip>
          {(Object.keys(sectionMeta) as Section[]).map((s) => (
            <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {s} · {bySection[s] ?? 0}
            </Chip>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((q, i) => {
            const meta = sectionMeta[q.section];
            const Icon = meta.icon;
            return (
              <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span className="font-semibold">Q{i + 1}</span>
                      <span>·</span>
                      <span className={meta.color}>{q.section}</span>
                      <span>·</span>
                      <PriorityBadge priority={q.priority} />
                      {q.linkedClaim && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <ShieldAlert className="h-2.5 w-2.5" /> Verifies claim
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-foreground">{q.question}</div>
                    <div className="mt-2 flex items-start gap-2 rounded-md bg-surface p-2.5 text-xs text-muted-foreground">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <span>{q.rationale}</span>
                    </div>
                    {q.linkedClaim && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Linked:</span> {q.linkedClaim}
                      </div>
                    )}
                  </div>
                  <button className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground" title="Copy">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-3 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary">
          <Plus className="h-3.5 w-3.5" /> Add custom question
        </button>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session</div>
          <div className="mt-3 space-y-2 text-sm">
            <Row icon={Calendar} label="Thu, Jul 30" />
            <Row icon={Clock} label="10:00 AM · 45 min" />
            <Row icon={Video} label="Video · Google Meet" />
            <Row icon={Users} label={`${founder.name}, You, Priya (partner)`} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Brain className="h-3.5 w-3.5" /> AI Prep Focus
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <FocusItem>Verify <b>{founder.claims.filter(c => c.verified !== "Verified").length}</b> unverified claim(s) live in session</FocusItem>
            <FocusItem>Probe screening weakness: <i>"{founder.screening.founder.weaknesses[0] ?? "—"}"</i></FocusItem>
            <FocusItem>Confirm motivation depth beyond opportunistic signal</FocusItem>
            <FocusItem>Test coachability with direct competitive challenge</FocusItem>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coverage estimate</div>
          <div className="mt-3 space-y-2">
            {(Object.keys(sectionMeta) as Section[]).map((s) => {
              const n = bySection[s] ?? 0;
              const pct = Math.min(100, n * 22);
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={sectionMeta[s].color}>{s}</span>
                    <span className="text-muted-foreground">{n} q</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Live tab ---------- */
function LiveTab({ founder, guide, transcript }: { founder: Founder; guide: Q[]; transcript: Turn[] }) {
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [visibleTurns, setVisibleTurns] = useState<number>(3);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed((e) => e + 1);
      setVisibleTurns((v) => Math.min(transcript.length, v + (Math.random() > 0.5 ? 1 : 0)));
    }, 1200);
    return () => clearInterval(id);
  }, [running, transcript.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleTurns]);

  const shown = transcript.slice(0, visibleTurns);
  const coveredQs = new Set(shown.map((t) => t.qId).filter(Boolean) as string[]);
  const coveragePct = Math.round((coveredQs.size / guide.length) * 100);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Live transcript */}
      <div className="flex flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`relative grid h-9 w-9 place-items-center rounded-full ${running ? "bg-rose-500/15 text-rose-600" : "bg-surface text-muted-foreground"}`}>
              <Volume2 className="h-4 w-4" />
              {running && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/30" />}
            </div>
            <div>
              <div className="text-sm font-semibold">{running ? "Live — recording" : "Session ready"}</div>
              <div className="text-xs text-muted-foreground">Whisper v3 · realtime · English</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-surface px-2.5 py-1 font-mono text-xs tabular-nums text-muted-foreground">
              {mm}:{ss}
            </div>
            <button onClick={() => setMuted((m) => !m)}
              className="rounded-md border border-border bg-surface p-2 text-muted-foreground hover:text-foreground">
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button onClick={() => setRunning((r) => !r)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${
                running ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-primary text-primary-foreground hover:opacity-90"
              }`}>
              {running ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Start</>}
            </button>
            <button onClick={() => { setRunning(false); setElapsed(0); setVisibleTurns(3); }}
              className="rounded-md border border-border bg-surface p-2 text-muted-foreground hover:text-foreground">
              <Square className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="max-h-[540px] flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {shown.map((turn) => (
            <TurnBubble key={turn.id} turn={turn} founderName={founder.name} />
          ))}
          {running && visibleTurns < transcript.length && (
            <div className="flex items-center gap-2 pl-11 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
              <span className="ml-1">transcribing…</span>
            </div>
          )}
        </div>
      </div>

      {/* Coverage / Coach */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Coverage</span>
            <span className="text-primary">{coveragePct}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${coveragePct}%` }} />
          </div>
          <ul className="mt-4 space-y-2">
            {guide.map((q, i) => {
              const done = coveredQs.has(q.id);
              return (
                <li key={q.id} className="flex items-start gap-2 text-xs">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={`${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    Q{i + 1}. {q.question}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> AI Coach — next move
          </div>
          <p className="mt-2 text-sm text-foreground">
            Founder deflected on the GTM weakness. Push once more with:
          </p>
          <blockquote className="mt-2 rounded-md border-l-2 border-primary bg-card px-3 py-2 text-sm italic text-foreground">
            "Concretely — what's your plan if Priya doesn't sign, or ramps slowly?"
          </blockquote>
          <button className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            <ChevronRight className="h-3.5 w-3.5" /> Queue for next turn
          </button>
        </div>
      </div>
    </div>
  );
}

function TurnBubble({ turn, founderName }: { turn: Turn; founderName: string }) {
  if (turn.speaker === "AI") {
    return (
      <div className="ml-11 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" /> AI · {turn.t}
        </div>
        <div className="mt-1">{turn.text}</div>
      </div>
    );
  }
  const isFounder = turn.speaker === "Founder";
  const initials = isFounder ? founderName.split(" ").map((s) => s[0]).slice(0, 2).join("") : "YOU";
  return (
    <div className="flex items-start gap-3">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
        isFounder ? "bg-primary/15 text-primary" : "bg-surface text-muted-foreground border border-border"
      }`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{isFounder ? founderName : "You"}</span>
          <span>·</span>
          <span className="font-mono tabular-nums">{turn.t}</span>
        </div>
        <div className="mt-0.5 text-sm text-foreground">{turn.text}</div>
      </div>
    </div>
  );
}

/* ---------- Transcript tab ---------- */
function TranscriptTab({ transcript, guide }: { transcript: Turn[]; guide: Q[] }) {
  const [query, setQuery] = useState("");
  const filtered = transcript.filter((t) => t.text.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcript…"
              className="w-full rounded-md border border-border bg-surface pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:text-foreground">
              <Download className="h-3.5 w-3.5" /> Export .txt
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:text-foreground">
              <FileText className="h-3.5 w-3.5" /> Export .pdf
            </button>
          </div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((t) => (
            <div key={t.id} className="grid grid-cols-[80px_100px_1fr] gap-4 px-4 py-3 text-sm">
              <div className="font-mono text-xs tabular-nums text-muted-foreground">{t.t}</div>
              <div className={`text-xs font-semibold uppercase tracking-wider ${
                t.speaker === "AI" ? "text-primary" : t.speaker === "Founder" ? "text-emerald-700" : "text-muted-foreground"
              }`}>
                {t.speaker}
              </div>
              <div className={t.speaker === "AI" ? "italic text-muted-foreground" : "text-foreground"}>{t.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session stats</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Duration" value="04:48" />
            <Stat label="Turns" value={String(transcript.length)} />
            <Stat label="Questions" value={`${guide.length}`} />
            <Stat label="Founder talk" value="68%" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Highlights</div>
          <ul className="mt-3 space-y-2 text-xs text-foreground">
            <li className="flex gap-2"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Named specific competitive threat (Bedrock bundle)</li>
            <li className="flex gap-2"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Verified ARR claim in-session via Stripe</li>
            <li className="flex gap-2"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> Vision: "Postgres of the agent era" — realistic framing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- Synthesis tab ---------- */
function SynthesisTab({ founder }: { founder: Founder }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5 text-primary" /> Executive summary
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            {founder.name} delivered a high-conviction session with strong founder-market fit signals. Origin story
            demonstrated bias-to-action (design partners in &lt;30 days). Verified the previously unverified $1.4M ARR
            claim live via Stripe. Directly addressed the "first-time CEO" weakness with a concrete VP Sales hire and a
            defensible rationale for retaining founder-led sales through PMF. Vision framing ("Postgres of the agent era")
            was ambitious but grounded.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Bias to action", "Coachable", "Mission-driven", "Self-aware", "Verifiable claims"].map((t) => (
              <span key={t} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score deltas</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Delta label="Founder score" before={founder.founderScore - 3} after={founder.founderScore} />
            <Delta label="Coachability" before={founder.radar.coachability - 4} after={founder.radar.coachability} />
            <Delta label="Vision" before={founder.radar.vision - 2} after={founder.radar.vision} />
            <Delta label="Trust score" before={founder.trustScore - 2} after={founder.trustScore} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New Founder Memory entries ({4})
          </div>
          <div className="mt-3 space-y-2">
            {[
              { cat: "Skill", text: "Ships prototype-to-paying-design-partners in <30 days", conf: 92 },
              { cat: "Motivation", text: "Mission-driven: believes only ~30 people globally can build this", conf: 88 },
              { cat: "Signal", text: "Verified $1.4M ARR live via Stripe screenshot in session", conf: 99 },
              { cat: "Risk", text: "Retains founder-led sales through PMF; VP Sales starting Q3", conf: 84 },
            ].map((m, i) => (
              <div key={i} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
                <span className="mt-0.5 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {m.cat}
                </span>
                <div className="min-w-0 flex-1 text-sm text-foreground">{m.text}</div>
                <span className="text-xs text-muted-foreground">{m.conf}%</span>
              </div>
            ))}
          </div>
          <button className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Commit all to memory
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommendation</div>
          <div className="mt-3 text-2xl font-semibold text-emerald-700">{founder.recommendation}</div>
          <div className="mt-1 text-xs text-muted-foreground">Confidence {founder.confidence}%</div>
          <div className="mt-4 space-y-2 text-xs">
            <Row icon={CheckCircle2} label="Advance to partner meeting" />
            <Row icon={CheckCircle2} label="Reference: Priya Rao (VP Sales)" />
            <Row icon={CheckCircle2} label="Draft term sheet — 60d target close" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow-ups</div>
          <ul className="mt-3 space-y-2 text-xs text-foreground">
            <li className="flex gap-2"><Circle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" /> Request Stripe export (ARR verification artifact)</li>
            <li className="flex gap-2"><Circle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" /> Backchannel Priya Rao (via Databricks network)</li>
            <li className="flex gap-2"><Circle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" /> Technical deep-dive with CTO next week</li>
          </ul>
        </div>
        <button className="w-full rounded-xl border border-border bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
          Generate investment memo →
        </button>
      </div>
    </div>
  );
}

/* ---------- Small helpers ---------- */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
function PriorityBadge({ priority }: { priority: Q["priority"] }) {
  const map = {
    Critical: "bg-rose-500/10 text-rose-700",
    High: "bg-amber-500/10 text-amber-700",
    Medium: "bg-sky-500/10 text-sky-700",
  } as const;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${map[priority]}`}>{priority}</span>;
}
function Row({ icon: Icon, label }: { icon: typeof Brain; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{label}</span>
    </div>
  );
}
function FocusItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-foreground">
      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
function Delta({ label, before, after }: { label: string; before: number; after: number }) {
  const diff = after - before;
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-lg font-semibold tabular-nums">{after}</div>
        <div className={`text-xs font-semibold ${diff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
          {diff >= 0 ? "+" : ""}{diff}
        </div>
        <div className="ml-auto text-[10px] text-muted-foreground">was {before}</div>
      </div>
    </div>
  );
}
