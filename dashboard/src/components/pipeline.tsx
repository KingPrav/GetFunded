import { foundersByStage } from "@/features/founders/data";
import { ChevronRight } from "lucide-react";

const stages = ["Discovery", "Screening", "Diligence", "Interview", "Decision"] as const;

export function Pipeline() {
  const buckets = foundersByStage();

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Pipeline overview</h2>
        <span className="text-xs text-muted-foreground">Updated 2 min ago</span>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {stages.map((s, i) => {
          const count = buckets[s].length;
          return (
            <div key={s} className="flex flex-1 items-stretch gap-2">
              <div className="flex flex-1 flex-col justify-between rounded-lg border border-border bg-surface p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s}
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tabular-nums">{count}</span>
                  <span className="text-[11px] text-muted-foreground">founders</span>
                </div>
              </div>
              {i < stages.length - 1 && (
                <div className="hidden items-center text-muted-foreground lg:flex">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
