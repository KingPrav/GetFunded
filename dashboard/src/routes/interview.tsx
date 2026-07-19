import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Interview Scores · Get Funded" },
      {
        name: "description",
        content: "AI-run founder interviews with live liveness scoring, transcripts, and investor scoring — synthetic demo data.",
      },
    ],
  }),
  component: InterviewScoresPage,
});

/**
 * The old mock "Interview Scores" workspace has been fully replaced by the
 * team's standalone AI-interview + scoring tool (founder-facing AI interview
 * with camera/liveness signal, investor-facing interview scoring view — two
 * products in one file, same as the source build). It's a self-contained
 * HTML/CSS/JS app, so it's embedded here full-bleed rather than ported into
 * this app's component tree — same "same tool, same shell nav slot" pattern
 * as the Founder Score integration, just embedded instead of re-fetched.
 */
function InterviewScoresPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col">
      <iframe
        title="VC Brain — Interview Scores"
        src="/vc-brain-interview.html"
        className="h-full w-full flex-1 border-0"
        allow="camera; microphone; clipboard-write"
      />
    </div>
  );
}
