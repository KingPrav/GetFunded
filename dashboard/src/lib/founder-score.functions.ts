/**
 * Bridge to the VC Brain backend (github.com/KingPrav/VC_Mind) — the actual Founder
 * Score engine: GitHub/Scholar/LinkedIn claims run through a component-weighted axis
 * engine, validated against the team's ground-truth dataset. Everything in
 * features/founders/data.ts is still mock data; this is the first real connection to
 * that scoring logic instead of a hardcoded number.
 *
 * These are TanStack Start server functions (same pattern as enrich.functions.ts) so
 * the fetch to the VC Brain backend happens server-side — no CORS handling needed on
 * either end, and the backend URL never has to be exposed to the browser.
 *
 * Requires the VC Brain backend running locally (`uvicorn main:app` from its
 * `backend/` folder) and reachable at VC_BRAIN_API_URL (defaults to
 * http://127.0.0.1:8000, i.e. same machine, default port). In production this only
 * works if that backend is deployed somewhere reachable from wherever this app's
 * server runs — for now this is built for local side-by-side dev, matching how the
 * backend itself has been run throughout this project.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API_BASE = process.env.VC_BRAIN_API_URL || "http://127.0.0.1:8000";

export type FounderScoreSummary = {
  candidatesScored: number;
  avgFounderScore: number | null;
  lastScanAt: string | null;
};

export const getFounderScoreSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<FounderScoreSummary | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/founders/summary`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      return (await res.json()) as FounderScoreSummary;
    } catch {
      // VC Brain backend isn't running locally right now — fail soft. The header
      // widget hides itself rather than showing an error for what's an expected
      // state (backend not started) rather than an exceptional one.
      return null;
    }
  },
);

export type FounderScoreEvidence = { claim: string; conf: string; note: string };

export type FounderScoreByHandle =
  | { found: false }
  | {
      found: true;
      name: string;
      founderScore: number;
      founderAxisScore: number | null;
      coveragePct: number | null;
      coldStart: boolean | null;
      scoreBreakdown: { github: number; linkedin: number; scholarly: number };
      evidence: FounderScoreEvidence[];
    };

const HandleInput = z.object({ handle: z.string().min(1) });

export const getFounderScoreByHandle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => HandleInput.parse(input))
  .handler(async ({ data }): Promise<FounderScoreByHandle> => {
    try {
      const res = await fetch(
        `${API_BASE}/api/founders/by-handle?handle=${encodeURIComponent(data.handle)}`,
        { signal: AbortSignal.timeout(4000) },
      );
      if (!res.ok) return { found: false };
      return (await res.json()) as FounderScoreByHandle;
    } catch {
      return { found: false };
    }
  });

/**
 * Full candidate list, same shape the VC Brain dashboard itself renders
 * (api/pipeline.py's build_candidate_payload / list_all_candidates) -- this is what
 * powers the new "Founder Score" workspace page: same backend, same cards, same
 * numbers, just restyled to this dashboard's fonts/colors.
 */
export type FounderScoreAxis = {
  score: number | null;
  label: string;
  cls: "bull" | "neutral" | "bear";
  coverage_pct?: number | null;
  note?: string;
};

export type FounderScoreCandidate = {
  id: string;
  name: string;
  handle: string;
  source: string;
  sourceLabel: string;
  sector: string | null;
  live: boolean;
  newFounder: boolean;
  headline: string;
  location: string;
  founderScore: number;
  scoreBreakdown: { github: number; linkedin: number; scholarly: number };
  prevFounderScore: number | null;
  evidence: FounderScoreEvidence[];
  coldStart: boolean;
  axes: {
    founder: FounderScoreAxis;
    market: FounderScoreAxis;
    ideaVsMarket: { label: string; cls: string };
  };
};

export const getFounderScoreCandidates = createServerFn({ method: "GET" }).handler(
  async (): Promise<FounderScoreCandidate[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/sourcing/candidates`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { candidates?: FounderScoreCandidate[] };
      return body.candidates ?? [];
    } catch {
      // Backend not running -- the page shows an empty state rather than an error.
      return [];
    }
  },
);
