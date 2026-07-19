"""
Axis scoring engine — adopted from the team's VSP-rubric dataset generator, faithfully
reproducing its score_axis() logic so our output can be validated against their
ground-truth axis_scores.csv rather than just asserted to look reasonable.

    quality         = strength_0_100 x (0.55 + 0.45 x confidence)
    confidence      = trust_factor(evidence_state) x (trust_score / 100)
    component_score = mean of quality across a single component's observed claims
    axis_score      = weighted mean of component_score across observed components,
                       weight = component weight (see component_map.py)

Trust DISCOUNTS substance, it does not erase it: a fully verified claim keeps its full
strength; a self-asserted one keeps about 55% of it even at zero trust_score (the 0.55
floor). This matches the team's documented design intent exactly.

Claims are aggregated to one score per component before the component weight is
applied. This matters once more than one claim lands in the same component (e.g.
GitHub alone writes 3 claims into "Background & execution", and now Scholar/LinkedIn
add more on top) — without this aggregation step, a component's weight would silently
multiply by however many claims happen to be tagged to it, and the rubric's intended
30/20/20/15/15 split (component_map.py) would blow out toward whichever component
received the most claims instead of holding to its designed proportions. The team's
own ground-truth dataset never exercised this case (every founder in claims.csv has
exactly one claim per component), which is why per-claim and per-component weighting
validated identically there — but it isn't identical once N>1 claims share a
component, which is now the normal case for this pipeline.

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

    Aggregation is two-level: claims are first averaged into one quality score per
    component, then components are combined into the axis score weighted by
    component_map's fixed weights. This keeps a component's influence on the axis
    score equal to its designed weight regardless of how many claims (i.e. how many
    sources) happened to land in it.
    """
    axis_claims = [c for c in claims if c.get("axis") == axis]

    # Bucket claims by component, keeping only those actually observed as of `asof`.
    by_component: dict[str, list[dict]] = {}
    all_components: set[str] = set()
    for c in axis_claims:
        component = c["component"]
        all_components.add(component)
        if c.get("evidence_state") in NON_SCORING_STATES:
            continue
        observed_date = _claim_observed_date(c)
        if observed_date is None:
            continue
        if asof is not None and observed_date > asof:
            continue  # not yet known as of this snapshot
        by_component.setdefault(component, []).append(c)

    total_components = len(all_components)
    observed_components = len(by_component)
    coverage_pct = round(100 * observed_components / max(1, total_components))

    numerator = 0.0
    denominator = 0.0
    for component, component_claims in by_component.items():
        component_score = sum(claim_quality(c) for c in component_claims) / len(component_claims)
        w = weight_of(component)
        numerator += w * component_score
        denominator += w

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
