"""
Founder Score — the persistent, cross-application score that lives in Memory
(FAQ Q6: distinct from the per-opportunity Founder axis; this is one input into that
axis's neighborhood, not a substitute for it — see note below).

Formula adopted from the team's VSP-rubric evaluation dataset (validated exactly
against their founder_scores.csv — 60/60 rows matched):

    founder_score = min(99, round(founder_axis * 0.75 + prior_ventures * 9 + shipped_artifacts * 3))

where founder_axis is this founder's current Founder-axis score (from axis_engine,
across ALL their claims to date, not scoped to one application — that's what makes it
persistent), prior_ventures is self-reported, and shipped_artifacts counts claims in the
"Background & execution" component that carry a concrete value_numeric (a shipped,
countable thing — commits, launches, papers — not just an assertion).

Superseded design note: the previous version of this module aggregated GitHub/Product
Hunt/LinkedIn/Scholar as separately-weighted sources (45/25/15/15). That approach is
retired in favor of this one — sources now feed claims (see ingestion/claims.py),
claims feed the axis engine, and the axis engine is what's actually validated against
ground truth. The old per-source weighting had no ground truth to check it against;
this one does.
"""
from __future__ import annotations

from datetime import date, timezone, datetime

from .axis_engine import score_axis

COLD_START_COVERAGE_THRESHOLD = 50  # below this Founder-axis coverage_pct, flag cold_start
FALLBACK_BASE_SCORE = 45  # matches the team's generator: used when the axis has never been observed


def _claim_to_dict(claim) -> dict:
    return {
        "axis": claim.axis,
        "component": claim.component,
        "evidence_state": claim.evidence_state,
        "trust_score": claim.trust_score,
        "strength_0_100": claim.strength_0_100,
        "value_numeric": claim.value_numeric,
        "observed_at": claim.observed_at,
    }


def compute_founder_score(claims: list[dict], prior_ventures: int, asof: date | None = None) -> dict:
    """claims: list of claim dicts (axis/component/evidence_state/trust_score/
    strength_0_100/value_numeric/observed_at) for this founder across ALL their
    applications — that's the persistence: the axis score isn't scoped to one company.
    """
    axis_result = score_axis(claims, "Founder", asof=asof)
    base = axis_result["score"] if axis_result["score"] is not None else FALLBACK_BASE_SCORE

    shipped_artifacts = sum(
        1 for c in claims
        if c.get("component") == "Background & execution" and c.get("value_numeric") is not None
    )

    founder_score = min(99, round(base * 0.75 + prior_ventures * 9 + shipped_artifacts * 3))
    cold_start = axis_result["coverage_pct"] < COLD_START_COVERAGE_THRESHOLD

    return {
        "founder_score": founder_score,
        "founder_axis_score": axis_result["score"],
        "founder_axis_coverage_pct": axis_result["coverage_pct"],
        "prior_ventures": prior_ventures,
        "shipped_artifacts": shipped_artifacts,
        "cold_start": cold_start,
        "used_fallback_base": axis_result["score"] is None,
    }


def update_founder_score(db, founder_id: int, reason: str, asof: date | None = None) -> dict:
    """Loads every claim ever recorded for this founder (across all their
    applications — the whole point of the score being persistent), recomputes, and
    writes both `founders.founder_score` and a `founder_score_history` row so the
    dashboard can show the trend, not just the latest snapshot.
    """
    from db.models import Application, Claim, Founder, FounderScoreHistory

    founder = db.query(Founder).filter_by(id=founder_id).first()
    if founder is None:
        raise ValueError(f"No founder with id={founder_id}")

    claims = (
        db.query(Claim)
        .join(Application, Claim.application_id == Application.id)
        .filter(Application.founder_id == founder_id)
        .all()
    )
    claim_dicts = [_claim_to_dict(c) for c in claims]

    result = compute_founder_score(claim_dicts, founder.prior_ventures or 0, asof=asof)

    founder.founder_score = result["founder_score"]
    founder.updated_at = datetime.now(timezone.utc)

    db.add(FounderScoreHistory(
        founder_id=founder_id,
        score=result["founder_score"],
        reason=reason,
    ))
    db.commit()

    return result
