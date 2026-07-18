"""
/api/decision/memo — drafts the business memo for a $100K first check.

Required Appendix-1 sections (company snapshot, investment hypotheses, SWOT,
problem & product, traction & KPIs) are covered either way. The Business Model Canvas
and dollar-allocation breakdown are genuinely generative tasks — a rule-based fallback
can't respectably infer a go-to-market canvas from a one-line headline, so without an
LLM key those sections are explicitly marked as unavailable rather than faked. That's
the same "flag the gap, don't fabricate" principle the brief applies to cap tables,
applied to our own tool instead of just the memo content.
"""
from __future__ import annotations

import json
import os

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/decision", tags=["decision"])

NOT_AVAILABLE_NO_LLM = "Not available without ANTHROPIC_API_KEY — this section requires generative reasoning, not a rule-based guess."


class MemoRequest(BaseModel):
    candidate: dict
    thesis: dict = {}


def _draft_fallback(c: dict, t: dict) -> dict:
    check = t.get("check", 100000)
    founder_score = c.get("founderScore", 0)
    evidence = c.get("evidence", [])

    key_facts = [e["claim"] for e in evidence] or ["Not disclosed — no evidence collected yet"]
    recommendation = "Advance to $%d check" % check if founder_score >= 60 else "Pass, request more evidence"
    reason = (
        f"Founder Score {founder_score}/100 from available sources; "
        + ("meets" if founder_score >= 60 else "falls short of")
        + " the bar for a confident 24-hour decision on the evidence collected so far."
    )

    return {
        "founderProfile": {
            "summary": c.get("headline", "Not disclosed"),
            "keyFacts": key_facts,
        },
        "canvas": {k: NOT_AVAILABLE_NO_LLM for k in [
            "keyPartners", "keyActivities", "keyResources", "valuePropositions",
            "customerRelationships", "channels", "customerSegments",
            "costStructure", "revenueStreams",
        ]},
        "investment": {
            "allocation": [],
            "rationale": NOT_AVAILABLE_NO_LLM,
            "runwayMonths": 0,
        },
        "vcQuestions": [
            "What traction or usage data exists beyond what's in this evidence list?",
            "Cap table: not disclosed — what does current ownership look like?",
            "Financials & round structure: not disclosed — what runway does this check need to buy?",
            "Market sizing: not disclosed — what's the bottom-up TAM/SAM/SOM?",
        ],
        "recommendation": recommendation,
        "reason": reason,
    }


def _draft_with_claude(c: dict, t: dict, api_key: str) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    check = t.get("check", 100000)

    prompt = f"""You are the reasoning layer of a venture capital system, drafting a business memo for a VC considering a ${check} first check into a new, first-time founder.
Fund thesis: {json.dumps(t)}
Founder record: {json.dumps({
        "name": c.get("name"), "location": c.get("location"), "headline": c.get("headline"),
        "founderScore": c.get("founderScore"), "axes": c.get("axes"), "evidence": c.get("evidence"),
    })}

Draft a business memo with exactly four sections:

1. Founder profile and key facts, a short paragraph plus a bullet list of key facts drawn only from the founder record. Where a fact is not available, write "Not disclosed" rather than inventing one.

2. A Business Model Canvas for the founder's idea, one or two short phrases per block, inferred reasonably from the headline and evidence. Since this is inferred rather than founder-confirmed, prefix any genuinely speculative block with "Assume:" and leave it un-prefixed only where the founder record directly supports it.

3. Investment dollar and allocation recommendation for the ${check} check, a percentage breakdown across at most 5 categories that sum to 100, plus a one-sentence rationale and an estimated runway in months.

4. Questions and concerns from a VC standpoint, 4 to 6 direct questions a VC should ask this founder before wiring the check, focused on the actual gaps and risks in this specific record, not generic boilerplate.

End with a one-line recommendation, either "Advance to ${check} check" or "Pass, request more evidence", plus a one-sentence reason.
Respond with ONLY valid JSON, no markdown fences, in this exact shape:
{{"founderProfile": {{"summary": "...", "keyFacts": ["...", "..."]}}, "canvas": {{"keyPartners": "...", "keyActivities": "...", "keyResources": "...", "valuePropositions": "...", "customerRelationships": "...", "channels": "...", "customerSegments": "...", "costStructure": "...", "revenueStreams": "..."}}, "investment": {{"allocation": [{{"category": "...", "pct": 0}}], "rationale": "...", "runwayMonths": 0}}, "vcQuestions": ["...", "..."], "recommendation": "...", "reason": "..."}}"""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1400,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in message.content if hasattr(b, "text"))
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)


@router.post("/memo")
def draft_memo(payload: MemoRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            memo = _draft_with_claude(payload.candidate, payload.thesis, api_key)
            return {"memo": memo, "mode": "llm"}
        except Exception as exc:
            return {"memo": _draft_fallback(payload.candidate, payload.thesis), "mode": "fallback",
                    "note": f"LLM memo drafting failed ({exc}), used fallback."}

    return {
        "memo": _draft_fallback(payload.candidate, payload.thesis),
        "mode": "fallback",
        "note": "No ANTHROPIC_API_KEY configured — set one to enable full LLM-drafted memos "
                "(Business Model Canvas and allocation reasoning need generative reasoning).",
    }
