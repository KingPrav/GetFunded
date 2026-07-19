"""
/api/founders — read-only endpoints purpose-built for external dashboards to consume
(specifically: the teammate's Lovable-built investor dashboard, getfundedvc). Kept
separate from /api/sourcing because that router's job is *running* the pipeline
(scanning, scoring); this one's job is exposing already-computed results in a shape
convenient for a header widget and a founder profile page that live in a different
codebase entirely.

No CORS handling here on purpose: the intended caller is a server-side fetch (a
TanStack Start server function running in the dashboard's own Node/nitro process),
not a browser making a cross-origin request directly, so CORS headers are moot.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.pipeline import (
    _reload_linkedin_breakdown,
    _reload_scholarly_breakdown,
    build_evidence_list,
)
from db.database import get_db
from db.models import Application, Founder, FounderScoreHistory, Score

router = APIRouter(prefix="/api/founders", tags=["founders"])


@router.get("/summary")
def founders_summary(db: Session = Depends(get_db)):
    """Aggregate pipeline-health numbers — meant for a small header widget on another
    dashboard, not for anything that needs per-founder detail."""
    scored = db.query(Founder).filter(Founder.founder_score.isnot(None)).all()
    count = len(scored)
    avg = round(sum(f.founder_score for f in scored) / count, 1) if count else None

    last_history = (
        db.query(FounderScoreHistory)
        .order_by(FounderScoreHistory.created_at.desc())
        .first()
    )

    return {
        "candidatesScored": count,
        "avgFounderScore": avg,
        "lastScanAt": last_history.created_at.isoformat() if last_history else None,
    }


def _find_founder_by_handle(db: Session, handle: str) -> Founder | None:
    """Founders are stored with their full GitHub profile URL, not the bare handle —
    matching on a trailing '/handle' segment (case-insensitive) so callers can pass
    just the handle, same as they would to github.com/<handle>."""
    normalized = handle.strip().lstrip("@")
    return (
        db.query(Founder)
        .filter(Founder.github_url.ilike(f"%/{normalized}"))
        .first()
    )


@router.get("/by-handle")
def founder_by_handle(handle: str = Query(...), db: Session = Depends(get_db)):
    """Looks up one founder by their GitHub handle and returns the same score
    breakdown/evidence shape the main dashboard shows — this is what lets the
    Lovable dashboard's founder page show a *real* Founder Score instead of its
    current hardcoded mock number, for any founder we've actually scanned.
    """
    founder = _find_founder_by_handle(db, handle)
    if founder is None or founder.founder_score is None:
        return {"found": False}

    score_row = (
        db.query(Score)
        .join(Application, Score.application_id == Application.id)
        .filter(Application.founder_id == founder.id, Score.axis == "founder")
        .order_by(Score.created_at.desc())
        .first()
    )

    return {
        "found": True,
        "name": founder.name,
        "founderScore": founder.founder_score,
        "founderAxisScore": score_row.value if score_row else None,
        "coveragePct": round(score_row.confidence * 100) if score_row and score_row.confidence is not None else None,
        "coldStart": bool(score_row.cold_start) if score_row else None,
        "scoreBreakdown": {
            # matches the same reload-path recomputation used by the Memory tab on
            # our own dashboard (api/pipeline.py) — real GitHub axis contribution
            # isn't separately recomputable from stored signals today (a pre-existing
            # gap, not introduced here), so it falls back to the founder axis value.
            "github": round(score_row.value) if score_row and score_row.value is not None else 0,
            "linkedin": _reload_linkedin_breakdown(db, founder.id),
            "scholarly": _reload_scholarly_breakdown(db, founder.id),
        },
        "evidence": build_evidence_list(db, founder.id),
    }
