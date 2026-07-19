import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Get Funded" },
      { name: "description", content: "Configure your investment thesis and workspace." },
    ],
  }),
  component: Settings,
});

const sectorOptions = ["AI Infra", "Healthcare AI", "Fintech", "DevTools", "Bio × AI", "Robotics", "Climate"];
const geoOptions = ["North America", "Europe", "LatAm", "SEA", "India", "Africa"];
const stageOptions = ["Pre-seed", "Seed", "Series A"];

function Settings() {
  const [sectors, setSectors] = useState(new Set(["AI Infra", "DevTools"]));
  const [geos, setGeos] = useState(new Set(["North America", "Europe"]));
  const [stages, setStages] = useState(new Set(["Seed"]));
  const [check, setCheck] = useState("3");
  const [ownership, setOwnership] = useState("10");
  const [risk, setRisk] = useState(60);

  const toggle = (s: Set<string>, set: (v: Set<string>) => void, v: string) => {
    const n = new Set(s);
    n.has(v) ? n.delete(v) : n.add(v);
    set(n);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Settings</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Workspace & thesis</h1>

      <Section title="Investment thesis" subtitle="Every recommendation respects these parameters.">
        <Field label="Preferred sectors">
          <div className="flex flex-wrap gap-2">
            {sectorOptions.map((s) => (
              <Chip key={s} active={sectors.has(s)} onClick={() => toggle(sectors, setSectors, s)}>{s}</Chip>
            ))}
          </div>
        </Field>
        <Field label="Preferred geography">
          <div className="flex flex-wrap gap-2">
            {geoOptions.map((s) => (
              <Chip key={s} active={geos.has(s)} onClick={() => toggle(geos, setGeos, s)}>{s}</Chip>
            ))}
          </div>
        </Field>
        <Field label="Preferred stage">
          <div className="flex flex-wrap gap-2">
            {stageOptions.map((s) => (
              <Chip key={s} active={stages.has(s)} onClick={() => toggle(stages, setStages, s)}>{s}</Chip>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Check size (USD, millions)">
            <Input value={check} onChange={(e) => setCheck(e.target.value)} className="bg-surface" />
          </Field>
          <Field label="Ownership target (%)">
            <Input value={ownership} onChange={(e) => setOwnership(e.target.value)} className="bg-surface" />
          </Field>
        </div>
        <Field label={`Risk tolerance · ${risk}/100`}>
          <input
            type="range"
            min={0}
            max={100}
            value={risk}
            onChange={(e) => setRisk(Number(e.target.value))}
            className="w-full accent-[color:var(--primary)]"
          />
        </Field>
      </Section>

      <Section title="Notifications" subtitle="Delivered to your inbox and workspace.">
        <ToggleRow label="New founder matches your thesis" />
        <ToggleRow label="Interview reminders (24h before)" />
        <ToggleRow label="Memo ready for IC" defaultOn />
        <ToggleRow label="Weekly pipeline digest" defaultOn />
      </Section>

      <Section title="AI & models" subtitle="Choose the default model for evaluation.">
        <Field label="Default AI model">
          <select className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
            <option>Get Funded default (auto)</option>
            <option>High-fidelity (long-context)</option>
            <option>Fast (throughput)</option>
          </select>
        </Field>
      </Section>

      <Section title="Organization" subtitle="Your workspace details.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Organization name">
            <Input defaultValue="Sequoia Alpha Fund IV" className="bg-surface" />
          </Field>
          <Field label="Team members">
            <Input defaultValue="12 members · 4 partners" className="bg-surface" readOnly />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm">{label}</span>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}
