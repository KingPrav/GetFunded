import { createFileRoute } from "@tanstack/react-router";
import { founders } from "@/features/founders/data";
import { Gavel } from "lucide-react";

export const Route = createFileRoute("/committee")({
  head: () => ({
    meta: [
      { title: "Investment Committee · Get Funded" },
      { name: "description", content: "Memos ready for the next investment committee." },
    ],
  }),
  component: Committee,
});

function Committee() {
  const ready = founders.filter((f) => f.recommendation === "Strong Invest" || f.recommendation === "Invest");
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Investment Committee</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Thursday, July 24 · IC #142</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ready.length} memos on the agenda. Voting opens 24h in advance.
      </p>

      <div className="mt-6 space-y-3">
        {ready.map((f, i) => (
          <div key={f.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Item {String(i + 1).padStart(2, "0")} · {f.industry}
                </div>
                <div className="mt-1 text-lg font-semibold">{f.company} — Series Seed</div>
                <div className="text-sm text-muted-foreground">Led by {f.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-primary/25 bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary">
                  {f.recommendation}
                </span>
                <button className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  <Gavel className="h-3.5 w-3.5" /> Cast vote
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Cell k="Check" v="$3.0M" />
              <Cell k="Round" v="$6.0M" />
              <Cell k="Post" v="$32M" />
              <Cell k="Ownership" v="9.4%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{v}</div>
    </div>
  );
}
