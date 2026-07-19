import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { founders } from "@/features/founders/data";
import type { Founder, PanelEval } from "@/features/founders/data";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/screening")({
  head: () => ({
    meta: [
      { title: "Screening · Get Funded" },
      { name: "description", content: "Three independent panels: Founder, Market, Idea-Market fit." },
    ],
  }),
  component: Screening,
});

function Screening() {
  const [id, setId] = useState(founders[0].id);
  const f = founders.find((x) => x.id === id)!;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Screening
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        Independent evaluation
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Three panels evaluated in isolation. Scores are never averaged — each frames a different bet.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {founders.map((x) => (
          <button
            key={x.id}
            onClick={() => setId(x.id)}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (x.id === id
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground")
            }
          >
            {x.name} · {x.company}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Founder" eval={f.screening.founder} founder={f} />
        <Panel title="Market" eval={f.screening.market} founder={f} />
        <Panel title="Idea vs Market" eval={f.screening.fit} founder={f} />
      </div>
    </div>
  );
}

function Panel({ title, eval: e, founder }: { title: string; eval: PanelEval; founder: Founder }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title} panel
        </div>
        <div className="text-[11px] text-muted-foreground">{founder.company}</div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{e.score}</span>
        <span className="text-xs text-muted-foreground">/100 · {e.confidence}% confidence</span>
      </div>
      <div className="mt-3 h-1 rounded-full bg-border">
        <div className="h-1 rounded-full bg-primary" style={{ width: `${e.score}%` }} />
      </div>

      <div className="mt-5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--success)]">
          Strengths
        </div>
        <ul className="mt-1.5 space-y-1.5">
          {e.strengths.map((s) => (
            <li key={s} className="flex gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--success)]" />
              <span className="text-muted-foreground">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--warning)]">
          Weaknesses
        </div>
        <ul className="mt-1.5 space-y-1.5">
          {e.weaknesses.map((s) => (
            <li key={s} className="flex gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
              <span className="text-muted-foreground">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Evidence
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {e.evidence.map((ev) => (
            <span key={ev} className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
              {ev}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
