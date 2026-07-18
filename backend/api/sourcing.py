"""
/api/sourcing — outbound GitHub scanning (real) plus the Memory read endpoint that
restores candidates on a page reload, so the dashboard's "Memory never resets" claim
is actually true instead of living only in a JS variable that dies on refresh.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.pipeline import list_all_candidates, source_and_score_github_candidate
from db.database import get_db
from ingestion.github import search_repos_by_topic

router = APIRouter(prefix="/api/sourcing", tags=["sourcing"])

TOPIC_MAP = {
    "AI infrastructure": ["llm", "inference"],
    "Developer tools": ["developer-tools"],
    "Vertical AI agents": ["ai-agents"],
    "Robotics": ["robotics"],
    "Biotech": ["bioinformatics", "computational-biology"],
    "Climate": ["climate-tech"],
    "Fintech": ["fintech"],
}
REPOS_PER_TOPIC = 3


class ThesisPayload(BaseModel):
    sector: str = "All sectors"
    stage: str | None = None
    geo: str | None = None
    check: float | None = None
    ownership: float | None = None
    risk: int | None = None
    newFoundersOnly: bool = True


@router.post("/scan-github")
def scan_github(thesis: ThesisPayload, db: Session = Depends(get_db)):
    if thesis.sector == "All sectors":
        topics = [group[0] for group in TOPIC_MAP.values()]
        sector_for_topic = {group[0]: name for name, group in TOPIC_MAP.items()}
    else:
        topics = TOPIC_MAP.get(thesis.sector, ["ai"])
        sector_for_topic = {t: thesis.sector for t in topics}

    candidates = []
    errors = []
    for topic in topics:
        repos = search_repos_by_topic(topic, limit=REPOS_PER_TOPIC)
        sector_label = sector_for_topic.get(topic, thesis.sector)
        for repo in repos:
            try:
                candidate = source_and_score_github_candidate(db, repo, sector_label)
                candidates.append(candidate)
            except Exception as exc:  # keep scanning even if one candidate fails
                errors.append(f"{repo.get('full_name', '?')}: {exc}")

    return {"added": len(candidates), "candidates": candidates, "errors": errors}


@router.get("/candidates")
def get_candidates(db: Session = Depends(get_db)):
    return {"candidates": list_all_candidates(db)}
