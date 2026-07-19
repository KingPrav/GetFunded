import { createFileRoute } from "@tanstack/react-router";
import { founders } from "@/features/founders/data";
import { FileSearch, ShieldCheck, Users, DollarSign } from "lucide-react";

export const Route = createFileRoute("/diligence")({
  head: () => ({
    meta: [
      { title: "Diligence · Get Funded" },
      { name: "description", content: "Structured diligence with evidence-backed conclusions." },
    ],
  }),
  component: Diligence,
});

function Diligence() {
  const active = founders.filter((f) => f.stage === "Diligence" || f.stage === "Interview");
  const checks = [
    { icon: ShieldCheck, name: "Background & references", status: "In progress", pct: 60 },
    { icon: FileSearch, name: "Data room review", status: "Complete", pct: 100 },
    { icon: DollarSign, name: "Financial diligence", status: "In progress", pct: 45 },
    { icon: Users, name: "Customer calls", status: "Scheduled", pct: 20 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Diligence</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Active diligence</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {active.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">{f.company}</div>
                  <div className="text-xs text-muted-foreground">{f.name} · {f.industry}</div>
                </div>
                <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.stage}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {checks.map((c) => (
                  <div key={c.name} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center gap-1.5">
                      <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {c.name}
                      </div>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-border">
                      <div className="h-1 rounded-full bg-primary" style={{ width: `${c.pct}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{c.status}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-sm font-semibold">Open questions</div>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>1. Confirm ARR reconciliation with Stripe export.</li>
            <li>2. Reference two former direct reports.</li>
            <li>3. Verify enterprise LOI signatories.</li>
            <li>4. Legal review of IP assignment.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
