"""
Translates each source's raw data + computed sub-scores into component-tagged Claim
rows, feeding the axis_engine (scoring/axis_engine.py) instead of the old per-source
composite score.

Design principles carried over from each source module's own docstring:
- GitHub is API-verified and objective -> high trust_score, evidence_state="verified".
- Semantic Scholar matches by name with no disambiguation -> verified but trust-capped.
- LinkedIn is founder-self-pasted text, not scraped -> evidence_state="self_asserted",
  trust discounted, same reasoning as before just expressed as an evidence_state now
  rather than a separate multiplier.
- `value_numeric` is only set on claims that represent a genuinely countable, shipped
  thing (commit volume, star velocity, contributor count, paper count) — this is what
  the Founder Score formula's `shipped_artifacts` term counts. LinkedIn claims
  deliberately carry no value_numeric: career narrative isn't a shipped artifact.

Each function returns plain dicts (no ORM, no DB) — the caller (api/pipeline.py)
attaches application_id/signal_id and does the actual insert, keeping this module
testable in isolation like the rest of the ingestion layer.
"""
from __future__ import annotations

from datetime import datetime, timezone

from scoring.component_map import vsp_code_of

_NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


def github_claims(github_score: dict) -> list[dict]:
    if github_score.get("score") is None:
        return []

    sub = github_score["sub_scores"]
    raw = github_score.get("raw_metrics", {})
    now = _NOW()
    claims = []

    claims.append({
        "text": f"{raw.get('total_commits_52w', 0)} commits across "
                f"{raw.get('repos_considered_count', 0)} owned repos in the last 52 weeks",
        "axis": "Founder", "component": "Background & execution",
        "vsp_code": vsp_code_of("Background & execution"),
        "value_numeric": raw.get("total_commits_52w"), "unit": "commits/year",
        "strength_0_100": round(sub["commit_frequency_consistency"] * 10, 1),
        "evidence_state": "verified", "trust_score": 95, "source_tier": 1,
        "observed_at": now,
    })
    claims.append({
        "text": f"Best-performing repo gaining {raw.get('best_star_velocity_per_month', 0)} stars/month",
        "axis": "Founder", "component": "Background & execution",
        "vsp_code": vsp_code_of("Background & execution"),
        "value_numeric": raw.get("best_star_velocity_per_month"), "unit": "stars/month",
        "strength_0_100": round(sub["star_growth"] * 10, 1),
        "evidence_state": "verified", "trust_score": 95, "source_tier": 1,
        "observed_at": now,
    })
    claims.append({
        "text": f"Repo topics/language overlap with the stated sector "
                f"(relevance score {round(sub['topic_relevance'] * 10)}/100)",
        "axis": "Founder", "component": "Background & execution",
        "vsp_code": vsp_code_of("Background & execution"),
        "value_numeric": None, "unit": None,
        "strength_0_100": round(sub["topic_relevance"] * 10, 1),
        "evidence_state": "verified", "trust_score": 90, "source_tier": 1,
        "observed_at": now,
    })
    if raw.get("avg_contributors") is not None:
        claims.append({
            "text": f"Average of {raw['avg_contributors']} contributors across owned repos",
            "axis": "Founder", "component": "Team role clarity",
            "vsp_code": vsp_code_of("Team role clarity"),
            "value_numeric": raw["avg_contributors"], "unit": "contributors",
            "strength_0_100": round(sub["contributor_patterns"] * 10, 1),
            "evidence_state": "verified", "trust_score": 85, "source_tier": 1,
            "observed_at": now,
        })
    return claims


def scholar_claims(scholar_score: dict) -> list[dict]:
    if scholar_score.get("score") is None:
        return []

    raw = scholar_score.get("raw_metrics", {})
    now = _NOW()
    relevance = raw.get("match_relevance_ratio", 0.0)
    recent_year = raw.get("most_recent_paper_year")
    recent_note = f", most recent {recent_year}" if recent_year else ""

    # trust_score scales with how topically relevant the matched author's papers are
    # to this founder's sector — a strong relevance match is trusted closer to a
    # verified GitHub claim, a weak/no match stays capped low. See
    # ingestion/semanticscholar.py for how relevance is computed.
    trust_score = round(50 + 40 * relevance)

    return [{
        "text": f"{raw.get('paper_count', 0)} papers, {raw.get('citation_count', 0)} citations, "
                f"h-index {raw.get('h_index', 0)}{recent_note} (matched \"{raw.get('matched_name')}\", "
                f"topical relevance {round(relevance * 100)}%)",
        "axis": "Founder", "component": "Background & execution",
        "vsp_code": vsp_code_of("Background & execution"),
        "value_numeric": raw.get("paper_count"), "unit": "papers",
        # use the properly-weighted overall score directly (publication 25% / citation
        # 30% / h-index 20% / recency 25%) instead of re-averaging the sub-scores
        "strength_0_100": round(scholar_score["score"] * 10, 1),
        # verified via API, but trust reflects the disambiguation risk documented in
        # ingestion/semanticscholar.py — scaled by topical relevance, not flat.
        "evidence_state": "verified", "trust_score": trust_score, "source_tier": 2,
        "observed_at": now,
    }]


def linkedin_claims(pasted_text: str | None, linkedin_score: dict) -> list[dict]:
    if not pasted_text or linkedin_score.get("score") is None:
        return []

    sub = linkedin_score["sub_scores"]
    now = _NOW()
    return [
        {
            "text": "Founder-provided LinkedIn career summary (career relevance + tenure)",
            "axis": "Founder", "component": "Background & execution",
            "vsp_code": vsp_code_of("Background & execution"),
            "value_numeric": None, "unit": None,
            "strength_0_100": round((sub["career_relevance"] + sub["tenure_stability"]) / 2 * 10, 1),
            "evidence_state": "self_asserted", "trust_score": 70, "source_tier": 3,
            "observed_at": now,
        },
        {
            "text": "Founder-provided LinkedIn text shows engagement with AI/Finance/Entrepreneurship content",
            "axis": "Founder", "component": "Traits",
            "vsp_code": vsp_code_of("Traits"),
            "value_numeric": None, "unit": None,
            "strength_0_100": round(sub["content_engagement"] * 10, 1),
            "evidence_state": "self_asserted", "trust_score": 60, "source_tier": 3,
            "observed_at": now,
        },
    ]
