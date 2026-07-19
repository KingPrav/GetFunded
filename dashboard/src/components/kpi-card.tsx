import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: number;
  suffix?: string;
  delta?: string;
  positive?: boolean;
  icon?: LucideIcon;
}

function useCount(target: number, duration = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

export function KpiCard({ label, value, suffix, delta, positive, icon: Icon }: KpiCardProps) {
  const n = useCount(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {n.toLocaleString()}
        </div>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-2 text-xs font-medium",
            positive ? "text-[color:var(--success)]" : "text-muted-foreground",
          )}
        >
          {delta}
        </div>
      )}
    </motion.div>
  );
}
