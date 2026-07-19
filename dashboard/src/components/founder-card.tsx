import { Link } from "@tanstack/react-router";
import { MapPin, ArrowUpRight, Github, Linkedin } from "lucide-react";
import type { Founder } from "@/features/founders/data";
import { cn } from "@/lib/utils";

const recColor: Record<Founder["recommendation"], string> = {
  "Strong Invest": "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/25",
  Invest: "bg-primary/15 text-primary border-primary/25",
  Track: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/25",
  Pass: "bg-[color:var(--danger)]/15 text-[color:var(--danger)] border-[color:var(--danger)]/25",
};

export function FounderCard({ founder }: { founder: Founder }) {
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {founder.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-semibold text-foreground">{founder.name}</div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                recColor[founder.recommendation],
              )}
            >
              {founder.recommendation}
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {founder.role} · {founder.company}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {founder.location}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
        <ScoreMini label="Founder" value={founder.founderScore} />
        <ScoreMini label="Opportunity" value={founder.opportunityScore} />
        <ScoreMini label="Trust" value={founder.trustScore} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          Confidence <span className="font-medium text-foreground">{founder.confidence}%</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`https://github.com/search?q=${encodeURIComponent(founder.name)}&type=users`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`Find ${founder.name} on GitHub`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
          <a
            href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(founder.name + " " + founder.company)}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`Find ${founder.name} on LinkedIn`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Linkedin className="h-3.5 w-3.5" />
            LinkedIn
          </a>
          <Link
            to="/founders/$id"
            params={{ id: founder.id }}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
          >
            Open workspace <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ScoreMini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
