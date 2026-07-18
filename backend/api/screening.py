"""
/api/screening/query — Multi-Attribute Reasoning: resolve a compound natural-language
query against the current candidate pool in one pass (FAQ Q12), instead of five manual
filters.

Runs on Claude when ANTHROPIC_API_KEY is set in the environment (never sent to or read
by the browser — this was the whole point of moving these calls server-side). Without a
key, falls back to a deterministic keyword-overlap + Founder Score ranking so the
dashboard still works with zero configuration.
"""
from __future__ import annotations

import json
import os

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/screening", tags=["screening"])


class QueryPayload(BaseModel):
    query: str
    thesis: dict = {}
    candidates: list[dict] = []


def _rank_fallback(query: str, candidates: list[dict]) -> list[dict]:
    terms = {t for t in query.lower().replace(",", " ").split() if len(t) > 2}

    def relevance(c: dict) -> tuple:
        text = f"{c.get('headline', '')} {c.get('sector', '')} {c.get('location', '')}".lower()
        overlap = sum(1 for t in terms if t in text)
        return (overlap, c.get("founderScore", 0))

    ranked = sorted(candidates, key=relevance, reverse=True)
    for c in ranked:
        c["rationale"] = (
            "Deterministic fallback ranking (no ANTHROPIC_API_KEY configured): "
            "sorted by keyword overlap with the query, then Founder Score."
        )
    return ranked


def _rank_with_claude(query: str, thesis: dict, candidates: list[dict], api_key: str) -> list[dict]:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    payload = [
        {
            "id": c["id"], "name": c["name"], "headline": c["headline"],
            "location": c["location"], "founderScore": c["founderScore"],
            "evidence": [e["claim"] for e in c.get("evidence", [])],
        }
        for c in candidates
    ]
    prompt = f"""You are the screening layer of a venture capital sourcing system.
Thesis: {json.dumps(thesis)}
Query: "{query}"
Candidates: {json.dumps(payload)}

Rank the candidates against the query and thesis. Respond with ONLY valid JSON, no
markdown fences, no preamble, in this exact shape:
{{"ranked": [{{"id": "...", "rationale": "one sentence, under 25 words, citing a specific candidate fact"}}]}}
Order from best fit to worst fit. Include every candidate id exactly once."""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in message.content if hasattr(b, "text"))
    text = text.replace("```json", "").replace("```", "").strip()
    parsed = json.loads(text)

    by_id = {c["id"]: c for c in candidates}
    ranked = []
    for item in parsed.get("ranked", []):
        c = by_id.get(item["id"])
        if c:
            c = {**c, "rationale": item.get("rationale", "")}
            ranked.append(c)
    return ranked


@router.post("/query")
def query_candidates(payload: QueryPayload):
    if not payload.candidates:
        return {"ranked": [], "mode": "empty", "note": "No candidates to rank yet — run a sourcing scan first."}

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        try:
            ranked = _rank_with_claude(payload.query, payload.thesis, payload.candidates, api_key)
            return {"ranked": ranked, "mode": "llm"}
        except Exception as exc:
            ranked = _rank_fallback(payload.query, payload.candidates)
            return {"ranked": ranked, "mode": "fallback", "note": f"LLM ranking failed ({exc}), used fallback."}

    ranked = _rank_fallback(payload.query, payload.candidates)
    return {"ranked": ranked, "mode": "fallback", "note": "No ANTHROPIC_API_KEY configured — set one to enable LLM-based ranking."}
