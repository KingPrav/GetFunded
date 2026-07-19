import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * AI Scoring Engine — 8-layer Founder Scorecard.
 *
 * Weighted composite:
 *   Founder 40  (Identity/Background 15 + Execution 15 + Team 10, Traits modifier)
 *   Market  30
 *   Idea    20
 *   Trust   10  (claim-level quality; also acts as a gate: <70 => flagged)
 *
 * Axes are scored SEPARATELY and never averaged blindly — composite is the
 * weighted sum, and Trust <70 pins `gate_passed=false` regardless.
 */

const FounderSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  role: z.string().optional(),
  industry: z.string().optional(),
  stage: z.string().optional(),
  country: z.string().optional(),
  bio: z.string().optional(),
  research: z.record(z.string(), z.unknown()).optional(),
  radar: z.record(z.string(), z.number()).optional(),
});

const AnalyzeInput = z.object({
  founder_key: z.string().min(1),
  snapshot: FounderSnapshot,
});

const GetInput = z.object({ founder_key: z.string().min(1) });

type AxisResult = {
  score: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  evidence: string[];
  reason: string;
};

type FounderAxisResult = AxisResult & {
  slices: {
    identity_background: { value: number; reason: string };
    execution_signals: { value: number; reason: string };
    traits: { value: number; reason: string };
    team_structure: { value: number; reason: string };
  };
};

type TrustAxisResult = AxisResult & {
  gate_passed: boolean;
  gaps_disclosed: string[];
  contradictions: string[];
};

type AnalysisResult = {
  sourcing_route: "social" | "non_social" | "mixed";
  founder_axis: FounderAxisResult;
  market_axis: AxisResult;
  idea_axis: AxisResult;
  trust_axis: TrustAxisResult;
  composite: {
    total: number;
    weights: { founder: 0.4; market: 0.3; idea: 0.2; trust: 0.1 };
    reason: string;
    components: Record<string, { value: number; reason: string }>;
  };
  claims: {
    claim: string;
    source: string;
    source_type: "first_party" | "third_party" | "self_reported";
    confidence: number;
    verified: "Verified" | "Needs Verification" | "Unverified";
  }[];
};

const SYSTEM_PROMPT = `You are the reasoning layer of VC Brain. Produce an 8-layer Founder Scorecard.

AXES (score each SEPARATELY 0-100, never blend into one hidden number):
 - Founder axis (weight 40) — composed of four sub-slices:
     identity_background (weight 15 of overall): prior roles, exits, domain fit, education, public footprint.
     execution_signals   (weight 15 of overall): shipped products, OSS/repos, velocity, hiring, external validation.
     team_structure      (weight 10 of overall): co-founder complementarity, cap table sanity, early hires, red flags.
     traits (modifier): resilience, integrity, clarity, coachability — derived from tone/consistency of written+public content and any interview memory.
 - Market axis (weight 30): problem clarity, TAM/SAM/SOM, traction/KPIs, unit economics, competition/SWOT.
 - Idea-vs-market axis (weight 20): USP, defensibility, moats, fit with buyer behaviour/timing/regulation, expansion paths.
 - Trust axis (weight 10): claim-level data quality. For each important claim assess source_type (first_party | third_party | self_reported), cross-channel consistency, and confidence. Trust score MUST reflect verification coverage. Set gate_passed=true only if trust score >= 70.

SOURCING ROUTE: decide "social" (LinkedIn/X/GitHub/Substack/podcasts present), "non_social" (only website/press/patents/filings), or "mixed".

RULES:
 - Never invent facts for gaps — call them "Not disclosed" and list them under trust_axis.gaps_disclosed.
 - Penalise hidden gaps, not honestly disclosed ones.
 - Weight self_reported/contradicted claims down and flag them in trust_axis.contradictions.
 - Cite specific evidence for every strength and weakness ("GitHub: 4.2k stars on repo X", "Website: claims 20 paying customers, unverified").
 - Composite total = round(0.4*founder + 0.3*market + 0.2*idea + 0.1*trust).

Return ONLY valid JSON matching this exact schema:
{
  "sourcing_route": "social|non_social|mixed",
  "founder_axis": {
    "score": 0-100, "confidence": 0-100,
    "strengths": ["..."], "weaknesses": ["..."], "evidence": ["source: fact"],
    "reason": "one paragraph explaining WHY this axis score",
    "slices": {
      "identity_background": {"value": 0-100, "reason": "..."},
      "execution_signals":   {"value": 0-100, "reason": "..."},
      "traits":              {"value": 0-100, "reason": "..."},
      "team_structure":      {"value": 0-100, "reason": "..."}
    }
  },
  "market_axis": { "score": 0-100, "confidence": 0-100, "strengths": [], "weaknesses": [], "evidence": [], "reason": "" },
  "idea_axis":   { "score": 0-100, "confidence": 0-100, "strengths": [], "weaknesses": [], "evidence": [], "reason": "" },
  "trust_axis": {
    "score": 0-100, "confidence": 0-100,
    "strengths": [], "weaknesses": [], "evidence": [], "reason": "",
    "gate_passed": true,
    "gaps_disclosed": ["..."],
    "contradictions": ["..."]
  },
  "composite": {
    "total": 0-100,
    "weights": { "founder": 0.4, "market": 0.3, "idea": 0.2, "trust": 0.1 },
    "reason": "one paragraph explaining the weighted composite and the primary drivers",
    "components": {
      "identity_background": {"value": 0-100, "reason": "..."},
      "execution_signals":   {"value": 0-100, "reason": "..."},
      "team_structure":      {"value": 0-100, "reason": "..."},
      "traits":              {"value": 0-100, "reason": "..."},
      "market":              {"value": 0-100, "reason": "..."},
      "idea_usp":            {"value": 0-100, "reason": "..."},
      "trust":               {"value": 0-100, "reason": "..."}
    }
  },
  "claims": [
    {
      "claim": "...",
      "source": "GitHub|Scholar|Website|Interview|News|Memory|LinkedIn|Filing|Patent",
      "source_type": "first_party|third_party|self_reported",
      "confidence": 0-100,
      "verified": "Verified|Needs Verification|Unverified"
    }
  ]
}`;

async function callGateway(apiKey: string, userPrompt: string): Promise<AnalysisResult> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.4-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit — please retry in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted — top up in workspace billing.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = json.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as AnalysisResult;
  } catch {
    throw new Error("AI returned non-JSON output");
  }
}

export const analyzeFounder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const [memoryRes, claimsRes] = await Promise.all([
      context.supabase
        .from("founder_memory")
        .select("category, source, content, summary, confidence, created_at")
        .eq("founder_key", data.founder_key)
        .order("created_at", { ascending: false })
        .limit(40),
      context.supabase
        .from("claims")
        .select("claim, source, confidence, verified, source_url")
        .eq("founder_key", data.founder_key)
        .limit(40),
    ]);

    const record = {
      founder: data.snapshot,
      memory: memoryRes.data ?? [],
      existing_claims: claimsRes.data ?? [],
    };

    const userPrompt = `Founder record:\n${JSON.stringify(record, null, 2)}\n\nProduce the 8-layer scorecard. Score every axis independently, cite evidence for every strength/weakness, and enforce the trust gate.`;
    const result = await callGateway(apiKey, userPrompt);

    // Recompute composite deterministically so we can trust it downstream.
    const founder = clamp(result.founder_axis?.score);
    const market = clamp(result.market_axis?.score);
    const idea = clamp(result.idea_axis?.score);
    const trust = clamp(result.trust_axis?.score);
    const compositeTotal = Math.round(0.4 * founder + 0.3 * market + 0.2 * idea + 0.1 * trust);
    result.composite = {
      ...result.composite,
      total: compositeTotal,
      weights: { founder: 0.4, market: 0.3, idea: 0.2, trust: 0.1 },
    };
    if (result.trust_axis) result.trust_axis.gate_passed = trust >= 70;

    // Persist — one opportunity_scores row per axis (founder/market/idea/trust).
    const axes: [string, AxisResult][] = [
      ["founder", result.founder_axis],
      ["market", result.market_axis],
      ["idea", result.idea_axis],
      ["trust", result.trust_axis],
    ];

    const opportunityRows = axes
      .filter(([, a]) => !!a)
      .map(([panel, a]) => ({
        user_id: context.userId,
        founder_key: data.founder_key,
        panel,
        score: clamp(a.score),
        confidence: clamp(a.confidence),
        strengths: a.strengths ?? [],
        weaknesses: a.weaknesses ?? [],
        evidence: a.evidence ?? [],
        reason: a.reason ?? "",
      }));

    await context.supabase.from("opportunity_scores").insert(opportunityRows);

    await context.supabase.from("founder_scores").insert({
      user_id: context.userId,
      founder_key: data.founder_key,
      total: compositeTotal,
      components: {
        ...(result.composite.components ?? {}),
        _slices: result.founder_axis?.slices,
        _trust: {
          gate_passed: result.trust_axis?.gate_passed,
          gaps_disclosed: result.trust_axis?.gaps_disclosed ?? [],
          contradictions: result.trust_axis?.contradictions ?? [],
        },
        _sourcing_route: result.sourcing_route,
      } as never,
      reason: result.composite.reason,
    });

    if (result.claims?.length) {
      await context.supabase.from("claims").insert(
        result.claims.slice(0, 24).map((c) => ({
          user_id: context.userId,
          founder_key: data.founder_key,
          claim: c.claim,
          source: c.source,
          confidence: clamp(c.confidence),
          verified: c.verified,
          evidence_urls: [],
        })),
      );
    }

    await context.supabase.from("activities").insert({
      user_id: context.userId,
      founder_key: data.founder_key,
      kind: "ai.analysis",
      meta: {
        total: compositeTotal,
        founder,
        market,
        idea,
        trust,
        gate_passed: result.trust_axis?.gate_passed ?? false,
        sourcing_route: result.sourcing_route,
      },
    });

    return result;
  });

export const getLatestAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GetInput.parse(data))
  .handler(async ({ data, context }) => {
    const [opp, fs] = await Promise.all([
      context.supabase
        .from("opportunity_scores")
        .select("panel, score, confidence, strengths, weaknesses, evidence, reason, created_at")
        .eq("founder_key", data.founder_key)
        .order("created_at", { ascending: false })
        .limit(40),
      context.supabase
        .from("founder_scores")
        .select("total, components, reason, created_at")
        .eq("founder_key", data.founder_key)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const latestByPanel = new Map<string, NonNullable<typeof opp.data>[number]>();
    for (const row of opp.data ?? []) {
      if (!latestByPanel.has(row.panel)) latestByPanel.set(row.panel, row);
    }

    return {
      composite: fs.data ?? null,
      axes: {
        founder: latestByPanel.get("founder") ?? null,
        market: latestByPanel.get("market") ?? null,
        idea: latestByPanel.get("idea") ?? null,
        trust: latestByPanel.get("trust") ?? null,
      },
    };
  });

function clamp(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
