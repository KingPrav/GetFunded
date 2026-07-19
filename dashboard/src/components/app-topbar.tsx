import { useEffect, useState } from "react";
import { Activity, Bell, LogOut, Search, User } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getFounderScoreSummary } from "@/lib/founder-score.functions";

const today = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

/**
 * Live sub-heading under the main topbar row — pulls the real Founder Score engine's
 * aggregate stats from the VC Brain backend (see src/lib/founder-score.functions.ts).
 * Renders nothing at all when the backend isn't reachable (e.g. not running locally
 * right now) or hasn't scored anything yet, rather than showing a placeholder/error —
 * this is a bonus signal when available, not a load-bearing part of the layout.
 */
function FounderScoreStrip() {
  const summaryFn = useServerFn(getFounderScoreSummary);
  const { data: summary } = useQuery({
    queryKey: ["founder-score-summary"],
    queryFn: () => summaryFn(),
    refetchInterval: 30_000,
    retry: false,
  });

  if (!summary || summary.candidatesScored === 0) return null;

  return (
    <div className="flex h-8 items-center gap-4 border-b border-border bg-surface/60 px-3 text-xs text-muted-foreground sm:px-6">
      <div className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">Founder Score engine</span>
      </div>
      <span>
        <span className="font-semibold tabular-nums text-foreground">{summary.candidatesScored}</span> founders scored
      </span>
      {summary.avgFounderScore !== null && (
        <span>
          avg <span className="font-semibold tabular-nums text-foreground">{summary.avgFounderScore}</span>/100
        </span>
      )}
      {summary.lastScanAt && (
        <span className="ml-auto hidden sm:inline">
          updated {formatDistanceToNow(new Date(summary.lastScanAt), { addSuffix: true })}
        </span>
      )}
    </div>
  );
}

export function AppTopbar() {
  const [profile, setProfile] = useState<{ email: string; name: string; initials: string } | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const name =
        (u.user_metadata?.name as string | undefined) ||
        (u.user_metadata?.full_name as string | undefined) ||
        u.email?.split("@")[0] ||
        "Investor";
      const initials = name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      setProfile({ email: u.email ?? "", name, initials });
    });
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  return (
    <div className="sticky top-0 z-30">
      <header className="flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur sm:px-6">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="hidden text-xs text-muted-foreground sm:block">{today}</div>

        <div className="relative ml-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search founders, companies, memos..."
            className="h-9 border-border bg-surface pl-9 text-sm placeholder:text-muted-foreground focus-visible:ring-primary/40"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ⌘K
          </kbd>
        </div>

        <button className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary transition-opacity hover:opacity-90 sm:grid">
              {profile?.initials ?? <User className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{profile?.name ?? "Investor"}</div>
              <div className="text-xs font-normal text-muted-foreground">{profile?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <FounderScoreStrip />
    </div>
  );
}
