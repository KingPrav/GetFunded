"""
Founder Score — the persistent, cross-application score that lives in Memory
(FAQ Q6: distinct from the per-opportunity Founder axis; this is one input into that
axis, not a substitute for it).

Combines the four source scores agreed with the team:
    GitHub          45%   (richest, hardest to fake, free API)
    Product Hunt    25%   (real market pull signal — deferred pending API token)
    LinkedIn        15%   (self-reported, trust-discounted)
    Scholar/arXiv   15%   (gated: only counts for deep-tech founders at all)

Same renormalization pattern used inside github.py's sub-metrics: any source with no
data (or, for Scholar, gated out as inapplicable) is dropped rather than zero-filled,
and the remaining weights are renormalized proportionally. Confidence reflects how much
of the full weight was actually backed by real data — this is what should drive the
`cold_start` flag on a per-application Score row upstream.
"""
from __future__ import annotations

from datetime import datetime, timezone

SOURCE_WEIGHTS = {
    "github": 0.45,
    "product_hunt": 0.25,
    "linkedin": 0.15,
    "scholar": 0.15,
}

# Below this combined confidence, the founder should be scored in cold-start mode
# (wider confidence interval, explicit UI flag) rather than treated like a founder with
# a full evidentiary record.
COLD_START_CONFIDENCE_THRESHOLD = 0.5


def compute_founder_score(
    source_scores: dict[str, dict | None],
    deep_tech: bool,
    previous_score: float | None = None,
) -> dict:
    """
    source_scores: dict keyed by "github" | "product_hunt" | "linkedin" | "scholar",
    each value either None (source not attempted) or the dict shape produced by that
    source's compute_*_score() function: {"score": float|None, "confidence": float, ...}.

    deep_tech: from scoring.deep_tech.is_deep_tech(...) — if False, "scholar" is
    excluded from weighting entirely regardless of what's in source_scores, rather than
    just being treated as missing. This is the difference between "irrelevant" and
    "absent": absence of a Scholar profile shouldn't cost a SaaS founder anything.

    previous_score: the founder's existing persistent score, if any. When present, the
    new score is blended (40% old / 60% new) rather than overwritten — the Founder Score
    accumulates evidence over time instead of resetting on every re-scan.
    """
    applicable_sources = dict(SOURCE_WEIGHTS)
    if not deep_tech:
        applicable_sources.pop("scholar", None)

    used_weight = 0.0
    weighted_sum = 0.0
    weighted_confidence_sum = 0.0
    breakdown: dict[str, dict] = {}

    for source, weight in applicable_sources.items():
        data = source_scores.get(source)
        has_score = bool(data) and data.get("score") is not None
        breakdown[source] = {
            "weight_available": weight,
            "used": has_score,
            "score": data.get("score") if data else None,
            "confidence": data.get("confidence") if data else 0.0,
        }
        if has_score:
            used_weight += weight
            weighted_sum += data["score"] * weight
            weighted_confidence_sum += (data.get("confidence") or 0.0) * weight

    if used_weight == 0:
        new_score = 0.0
        confidence = 0.0
    else:
        new_score = round(weighted_sum / used_weight, 2)
        confidence = round(weighted_confidence_sum / used_weight, 2)

    if previous_score is not None and used_weight > 0:
        blended_score = round(previous_score * 0.4 + new_score * 0.6, 2)
    else:
        blended_score = new_score

    return {
        "founder_score": blended_score,
        "raw_new_evidence_score": new_score,
        "previous_score": previous_score,
        "confidence": confidence,
        "cold_start": confidence < COLD_START_CONFIDENCE_THRESHOLD,
        "deep_tech_gate_applied": not deep_tech,
        "source_breakdown": breakdown,
    }


def update_founder_score(db, founder_id: int, source_scores: dict[str, dict | None],
                          deep_tech: bool, reason: str) -> dict:
    """Computes the new Founder Score and persists it: updates `founders.founder_score`
    (recomputed, never simply replaced-and-forgotten) and appends a
    `founder_score_history` row so the dashboard can show the trend, not just the
    latest snapshot — per the brief's Memory requirements.
    """
    from db.models import Founder, FounderScoreHistory

    founder = db.query(Founder).filter_by(id=founder_id).first()
    if founder is None:
        raise ValueError(f"No founder with id={founder_id}")

    result = compute_founder_score(
        source_scores, deep_tech=deep_tech, previous_score=founder.founder_score or None
    )

    founder.founder_score = result["founder_score"]
    founder.updated_at = datetime.now(timezone.utc)

    db.add(
        FounderScoreHistory(
            founder_id=founder_id,
            score=result["founder_score"],
            reason=reason,
        )
    )
    db.commit()

    return result
