"""
Axis scoring engine — adopted from the team's VSP-rubric dataset generator, faithfully
reproducing its score_axis() logic so our output can be validated against their
ground-truth axis_scores.csv rather than just asserted to look reasonable.

    quality    = strength_0_100 x (0.55 + 0.45 x confidence)
    confidence = trust_factor(evidence_state) x (trust_score / 100)
    axis_score = weighted mean of quality across observed claims, weight = component
                 weight (see component_map.py)

Trust DISCOUNTS substance, it does not erase it: a fully verified claim keeps its full
strength; a self-asserted one keeps about 55% of it even at zero trust_score (the 0.55
floor). This matches the team's documented design intent exactly.

This engine only ever scores one axis at a time and never combines axes into one
number — that stays true regardless of which formula computes each axis individually.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from .component_map import weight_of

TRUST_FACTOR = {"verified": 1.0, "self_asserted": 0.80, "contradicted": 0.35}
NON_SCORING_STATES = ("unobserved", "gap_flagged")


def _claim_observed_date(claim: dict) -> date | None:
    observed = claim.get("observed_at")
    if observed is None:
        return None
    if isinstance(observed, datetime):
        return observed.date()
    if isinstance(observed, date):
        return observed
    return date.fromisoformat(str(observed)[:10])


def claim_quality(claim: dict) -> float:
    trust_factor = TRUST_FACTOR.get(claim.get("evidence_state"), 0.0)
    trust_score = claim.get("trust_score") or 0.0
    confidence = trust_factor * (trust_score / 100.0)
    strength = claim.get("strength_0_100") or 0.0
    return strength * (0.55 + 0.45 * confidence)


def score_axis(claims: list[dict], axis: str, asof: date | None = None) -> dict:
    """claims: list of dicts with at least axis/component/evidence_state/trust_score/
    strength_0_100/observed_at. Returns {"score": float|None, "coverage_pct": int}.

    `score` is None when no claim in this axis has ever been observed (not merely low
    — genuinely no evidence yet), matching the team's dataset semantics: a None axis
    score is a Hold-triggering "insufficient coverage" signal downstream, not a 0.
    """
    axis_claims = [c for c in claims if c.get("axis") == axis]
    total = len(axis_claims)
    observed = 0
    numerator = 0.0
    denominator = 0.0

    for c in axis_claims:
        if c.get("evidence_state") in NON_SCORING_STATES:
            continue
        observed_date = _claim_observed_date(c)
        if observed_date is None:
            continue
        if asof is not None and observed_date > asof:
            continue  # not yet known as of this snapshot
        observed += 1
        w = weight_of(c["component"])
        numerator += w * claim_quality(c)
        denominator += w

    coverage_pct = round(100 * observed / max(1, total))
    if denominator == 0:
        return {"score": None, "coverage_pct": coverage_pct}
    return {"score": round(numerator / denominator), "coverage_pct": coverage_pct}


def compute_trend(claims: list[dict], axis: str, current_asof: date,
                   baseline_asof: date | None = None) -> dict:
    """Compares the axis score as of `current_asof` against a baseline snapshot.

    Default baseline is 120 days before current_asof, matching the team's generator
    (which compares today against the earliest of three fixed snapshots) — kept as the
    default specifically so this stays directly comparable to their dataset. The live
    pipeline instead passes an explicit baseline_asof (the founder's previous
    application date), since "improved since we last looked at this founder" is more
    operationally meaningful than a fixed 120-day window.
    """
    if baseline_asof is None:
        baseline_asof = current_asof - timedelta(days=120)

    current = score_axis(claims, axis, asof=current_asof)
    baseline = score_axis(claims, axis, asof=baseline_asof)

    if current["score"] is None or baseline["score"] is None:
        trend = "insufficient_history"
    else:
        delta = current["score"] - baseline["score"]
        trend = "improving" if delta > 4 else ("declining" if delta < -4 else "stable")

    return {**current, "trend": trend, "baseline_score": baseline["score"]}
