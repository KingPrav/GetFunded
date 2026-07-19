import { createFileRoute } from "@tanstack/react-router";
import { FounderCard } from "@/components/founder-card";
import { founders } from "@/features/founders/data";

export const Route = createFileRoute("/founders/")({
  head: () => ({
    meta: [
      { title: "Founder Workspace · Get Funded" },
      { name: "description", content: "Every founder in your pipeline." },
    ],
  }),
  component: FoundersIndex,
});

function FoundersIndex() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Founder Workspace
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        All founders
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {founders.length} founders across the pipeline. Open a workspace to review evidence, interviews, and memos.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {founders.map((f) => (
          <FounderCard key={f.id} founder={f} />
        ))}
      </div>
    </div>
  );
}
