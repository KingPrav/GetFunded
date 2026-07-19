import { createFileRoute } from "@tanstack/react-router";
import { Users, TrendingUp, MessageSquare, FileText, Activity, Shield, GitBranch, Layers } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Pipeline } from "@/components/pipeline";
import { FounderCard } from "@/components/founder-card";
import { founders, kpis } from "@/features/founders/data";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Get Funded" },
      { name: "description", content: "Mission control for your investment pipeline." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const recent = founders.slice(0, 6);
  const { firstName } = useCurrentUser();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Mission control
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nine memos queued for this week's IC. Two founders moved to Decision overnight.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Founders tracked" value={kpis.foundersTracked} delta="+47 this week" positive icon={Users} />
        <KpiCard label="New this week" value={kpis.newThisWeek} delta="+12% vs last" positive icon={TrendingUp} />
        <KpiCard label="Interviews completed" value={kpis.interviewsCompleted} delta="4 scheduled today" icon={MessageSquare} />
        <KpiCard label="Memos ready" value={kpis.memosReady} delta="IC on Thursday" icon={FileText} />
        <KpiCard label="Avg founder score" value={kpis.avgFounderScore} suffix="/100" icon={Activity} />
        <KpiCard label="Avg trust score" value={kpis.avgTrustScore} suffix="/100" icon={Shield} />
        <KpiCard label="Pipeline health" value={kpis.pipelineHealth} suffix="/100" icon={GitBranch} />
        <KpiCard label="Portfolio capacity" value={kpis.portfolioCapacity} suffix="%" delta="3 slots remaining in fund IV" icon={Layers} />
      </div>

      <div className="mt-6">
        <Pipeline />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Recent founders</h2>
          <span className="text-xs text-muted-foreground">6 of {founders.length}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((f) => (
            <FounderCard key={f.id} founder={f} />
          ))}
        </div>
      </div>
    </div>
  );
}
