"""
Shared glue between the ingestion/scoring modules and the API layer.

Nothing in here does its own scoring math — it calls into ingestion.github,
ingestion.semanticscholar, scoring.deep_tech, and scoring.founder_score, and shapes
the results into the JSON the dashboard expects. Keeping this thin means the scoring
logic stays testable in isolation (as we already did for each module) while the API
stays a straightforward adapter.
"""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from db.models import Application, Company, Founder, Score, Signal
from ingestion.github import ingest_github
from ingestion.semanticscholar import ingest_scholar
from scoring.deep_tech import is_deep_tech
from scoring.founder_score import update_founder_score

FOUNDER_SCORE_DISPLAY_SCALE = 10  # internal scores are 0-10; dashboard displays 0-100


def get_or_create_founder(db: Session, github_username: str, github_html_url: str, display_name: str | None) -> Founder:
    founder = db.query(Founder).filter_by(github_url=github_html_url).first()
    if founder:
        return founder
    founder = Founder(name=display_name or github_username, github_url=github_html_url)
    db.add(founder)
    db.flush()
    return founder


def create_company(db: Session, name: str, sector: str | None, stage: str | None, snapshot: str | None) -> Company:
    company = Company(name=name, sector=sector, stage=stage, snapshot=snapshot)
    db.add(company)
    db.flush()
    return company


def axis_from_score(score_0_100: float) -> dict:
    if score_0_100 >= 66:
        return {"label": "Bullish", "cls": "bull"}
    if score_0_100 >= 40:
        return {"label": "Neutral", "cls": "neutral"}
    return {"label": "Bear", "cls": "bear"}


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.7:
        return "high"
    if confidence >= 0.4:
        return "medium"
    return "low"


def build_evidence_list(db: Session, founder_id: int, limit: int = 6) -> list[dict]:
    """Every entry here traces back to a real `signals` row — this is what Agentic
    Traceability renders on the card."""
    signals = (
        db.query(Signal)
        .filter(Signal.founder_id == founder_id)
        .order_by(Signal.ingested_at.desc())
        .limit(limit)
        .all()
    )
    evidence = []
    for s in signals:
        try:
            data = json.loads(s.raw_content) if s.raw_content else {}
        except (json.JSONDecodeError, TypeError):
            data = {}

        if s.type == "github_profile":
            evidence.append({
                "claim": f"{data.get('public_repos', 0)} public repos, {data.get('followers', 0)} GitHub followers",
                "conf": "high",
                "note": f"fetched live from the GitHub API — {s.source_url}",
            })
        elif s.type == "github_repo":
            evidence.append({
                "claim": f"{data.get('stargazers_count', 0)} stars on {data.get('full_name', s.source_url)}",
                "conf": "high",
                "note": f"fetched live from the GitHub API — {s.source_url}",
            })
        elif s.type == "scholar_profile":
            evidence.append({
                "claim": f"{data.get('paper_count', 0)} papers, {data.get('citation_count', 0)} citations, "
                         f"h-index {data.get('h_index', 0)}",
                "conf": "medium",
                "note": f"Semantic Scholar match on \"{data.get('matched_name')}\" — unverified by affiliation, {s.source_url}",
            })
        elif s.type == "linkedin_self_reported":
            evidence.append({
                "claim": "Founder-provided LinkedIn career summary",
                "conf": "low",
                "note": "self-reported, not scraped — trust-discounted in scoring",
            })
    return evidence


def build_candidate_payload(
    db: Session,
    founder: Founder,
    company: Company,
    application: Application,
    fs_result: dict,
    github_score: dict | None,
    scholar_score: dict | None,
    source_label: str,
    live: bool,
) -> dict:
    founder_score_100 = round(fs_result["founder_score"] * FOUNDER_SCORE_DISPLAY_SCALE)
    prev_100 = (
        round(fs_result["previous_score"] * FOUNDER_SCORE_DISPLAY_SCALE)
        if fs_result.get("previous_score") is not None
        else None
    )

    breakdown = {
        "github": round(github_score["score"] * FOUNDER_SCORE_DISPLAY_SCALE) if github_score and github_score.get("score") is not None else 0,
        "linkedin": 0,
        "scholarly": round(scholar_score["score"] * FOUNDER_SCORE_DISPLAY_SCALE) if scholar_score and scholar_score.get("score") is not None else 0,
    }

    evidence = build_evidence_list(db, founder.id)

    return {
        "id": f"app-{application.id}",
        "name": founder.name,
        "handle": "@" + founder.github_url.rstrip("/").split("/")[-1] if founder.github_url else founder.name,
        "source": application.source,
        "sourceLabel": source_label,
        "sector": company.sector,
        "live": live,
        "newFounder": bool(fs_result.get("cold_start")),
        "headline": f"{company.name} — {company.snapshot or 'no description provided'}",
        "location": "See GitHub profile" if founder.github_url else "Not disclosed",
        "founderScore": founder_score_100,
        "scoreBreakdown": breakdown,
        "prevFounderScore": prev_100,
        "evidence": evidence,
        "axes": {
            "founder": {"score": founder_score_100, **axis_from_score(founder_score_100)},
            "market": {"score": 50, **axis_from_score(50), "note": "Market axis engine not built yet — placeholder, not a real assessment"},
            "ideaVsMarket": {"label": "Not yet scored — Idea-vs-Market engine not built yet", "cls": "neutral"},
        },
    }


def source_and_score_github_candidate(db: Session, repo: dict, sector_label: str) -> dict:
    """Runs the full pipeline for one GitHub-sourced candidate: find-or-create Founder
    and Company, create an outbound Application, ingest GitHub (+ Scholar if the
    deep-tech gate allows it), aggregate the Founder Score, persist a Founder-axis
    Score row, and return the dashboard-shaped payload."""
    owner = repo["owner"]
    username = owner["login"]

    founder = get_or_create_founder(db, username, owner["html_url"], display_name=None)
    company = create_company(
        db,
        name=repo["name"],
        sector=sector_label,
        stage="pre-seed",
        snapshot=repo.get("description"),
    )
    application = Application(founder_id=founder.id, company_id=company.id, source="outbound")
    db.add(application)
    db.flush()
    db.commit()

    github_score = ingest_github(
        db, founder.id, company.id, username, target_keywords={sector_label.lower()}
    )

    deep_tech = is_deep_tech(sector_label, repo.get("topics", []))
    scholar_score = None
    if deep_tech:
        scholar_score = ingest_scholar(db, founder.id, company.id, founder.name)

    source_scores = {
        "github": github_score,
        "linkedin": None,
        "scholar": scholar_score,
        "product_hunt": None,
    }
    fs_result = update_founder_score(
        db, founder.id, source_scores, deep_tech=deep_tech,
        reason=f"Outbound GitHub scan — topic/sector '{sector_label}'",
    )

    prev = fs_result.get("previous_score")
    trend = "stable"
    if prev is not None:
        if fs_result["founder_score"] > prev:
            trend = "improving"
        elif fs_result["founder_score"] < prev:
            trend = "declining"

    db.add(Score(
        application_id=application.id,
        axis="founder",
        value=fs_result["founder_score"],
        trend=trend,
        confidence=fs_result["confidence"],
        rationale="Composite of GitHub" + (" + Scholar" if deep_tech else "") + " per the Founder Score model (LinkedIn/Product Hunt not sourced in this automated scan).",
        cold_start=fs_result["cold_start"],
    ))
    db.commit()

    return build_candidate_payload(
        db, founder, company, application, fs_result, github_score, scholar_score,
        source_label="GitHub · live", live=True,
    )


def list_all_candidates(db: Session) -> list[dict]:
    """Rebuilds the full candidate list from the database — this is what restores
    Memory on a page reload, unlike a purely in-browser store."""
    results = []
    applications = db.query(Application).order_by(Application.created_at.desc()).all()
    for application in applications:
        founder = application.founder
        company = application.company
        founder_score_row = (
            db.query(Score)
            .filter_by(application_id=application.id, axis="founder")
            .order_by(Score.created_at.desc())
            .first()
        )
        if not founder_score_row:
            continue
        founder_score_100 = round(founder_score_row.value * FOUNDER_SCORE_DISPLAY_SCALE)
        evidence = build_evidence_list(db, founder.id)
        results.append({
            "id": f"app-{application.id}",
            "name": founder.name,
            "handle": "@" + founder.github_url.rstrip("/").split("/")[-1] if founder.github_url else founder.name,
            "source": application.source,
            "sourceLabel": "GitHub · live" if application.source == "outbound" else "Inbound application",
            "sector": company.sector,
            "live": True,
            "newFounder": bool(founder_score_row.cold_start),
            "headline": f"{company.name} — {company.snapshot or 'no description provided'}",
            "location": "See GitHub profile" if founder.github_url else "Not disclosed",
            "founderScore": founder_score_100,
            "scoreBreakdown": {"github": founder_score_100, "linkedin": 0, "scholarly": 0},
            "prevFounderScore": None,
            "evidence": evidence,
            "axes": {
                "founder": {"score": founder_score_100, **axis_from_score(founder_score_100)},
                "market": {"score": 50, **axis_from_score(50), "note": "Market axis engine not built yet"},
                "ideaVsMarket": {"label": "Not yet scored", "cls": "neutral"},
            },
        })
    return results
