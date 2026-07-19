"""
Shared glue between the ingestion/scoring modules and the API layer.

Nothing in here does its own scoring math — it calls into ingestion.github,
ingestion.semanticscholar, ingestion.claims, scoring.deep_tech, and
scoring.founder_score/axis_engine, and shapes the results into the JSON the dashboard
expects. Keeping this thin means the scoring logic stays testable in isolation (as we
already did for each module, and validated axis_engine against the team's ground-truth
dataset) while the API stays a straightforward adapter.

Scores are natively 0-100 throughout this module now (matching the team's dataset
scale) — no display-scale conversion needed anywhere below.
"""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from db.models import Application, Claim, Company, Founder, Score, Signal
from ingestion.claims import github_claims, scholar_claims
from ingestion.github import ingest_github
from ingestion.semanticscholar import ingest_scholar
from scoring.axis_engine import score_axis
from scoring.component_map import components_for_axis, vsp_code_of
from scoring.deep_tech import is_deep_tech
from scoring.founder_score import update_founder_score


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


def is_low_footprint(github_score: dict | None) -> bool:
    """"New/undiscovered founder" for the dashboard filter — deliberately independent
    of `cold_start` (which is about our confidence in the SCORE, not about who the
    person is). A founder can have thin data coverage while already being GitHub-famous
    (high followers/stars, just few components covered), or have rich data covering a
    small, genuinely early footprint. Conflating the two caused a real bug: real
    high-signal candidates were disappearing from the default filtered view the moment
    scoring actually succeeded, because "confident score" was wrongly read as
    "established founder." This checks the actual footprint-size numbers instead —
    same thresholds as the team's original prototype heuristic.
    """
    if not github_score:
        return True  # no GitHub data at all -> definitely not "established"
    raw = github_score.get("raw_metrics", {})
    followers = raw.get("followers", 0) or 0
    public_repos = raw.get("public_repos", 0) or 0
    max_stars = raw.get("max_stars", 0) or 0
    return followers < 600 and public_repos < 50 and max_stars < 4000


def axis_from_score(score_0_100: float) -> dict:
    if score_0_100 >= 66:
        return {"label": "Bullish", "cls": "bull"}
    if score_0_100 >= 40:
        return {"label": "Neutral", "cls": "neutral"}
    return {"label": "Bear", "cls": "bear"}


def _insert_claims(db: Session, application_id: int, claim_dicts: list[dict]) -> None:
    for c in claim_dicts:
        db.add(Claim(application_id=application_id, **c))
    db.commit()


def _fill_unobserved_components(claim_dicts: list[dict], axis: str) -> list[dict]:
    """Mirrors the team's generator: every applicable component gets a row, even when
    we have nothing — as an explicit "unobserved" claim, not a silent absence. Without
    this, coverage_pct only reflects the claims we happened to create (which for our
    current sources is just Background & execution + Team role clarity), reading as
    100% covered when really 3 of 5 Founder components have zero evidence. That's
    exactly the kind of false confidence the brief asks the system to avoid — coverage
    should honestly reflect what's known vs not, not just what we bothered to check.
    """
    covered = {c["component"] for c in claim_dicts if c.get("axis") == axis}
    for component in components_for_axis(axis):
        if component in covered:
            continue
        claim_dicts.append({
            "text": "No observation available",
            "axis": axis, "component": component, "vsp_code": vsp_code_of(component),
            "value_numeric": None, "unit": None, "strength_0_100": None,
            "evidence_state": "unobserved", "trust_score": None, "source_tier": None,
            "observed_at": None,
        })
    return claim_dicts


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
    prev_founder_score: float | None,
) -> dict:
    founder_score = fs_result["founder_score"]
    founder_axis = fs_result["founder_axis_score"]

    breakdown = {
        "github": round(github_score["score"] * 10) if github_score and github_score.get("score") is not None else 0,
        "linkedin": 0,
        "scholarly": round(scholar_score["score"] * 10) if scholar_score and scholar_score.get("score") is not None else 0,
    }

    evidence = build_evidence_list(db, founder.id)
    founder_axis_display = founder_axis if founder_axis is not None else founder_score

    return {
        "id": f"app-{application.id}",
        "name": founder.name,
        "handle": "@" + founder.github_url.rstrip("/").split("/")[-1] if founder.github_url else founder.name,
        "source": application.source,
        "sourceLabel": source_label,
        "sector": company.sector,
        "live": live,
        "newFounder": is_low_footprint(github_score),
        "headline": f"{company.name} — {company.snapshot or 'no description provided'}",
        "location": "See GitHub profile" if founder.github_url else "Not disclosed",
        "founderScore": founder_score,
        "scoreBreakdown": breakdown,
        "prevFounderScore": prev_founder_score,
        "evidence": evidence,
        "coldStart": bool(fs_result.get("cold_start")),  # data-confidence flag, kept separate from newFounder
        "axes": {
            "founder": {"score": founder_axis_display, **axis_from_score(founder_axis_display),
                        "coverage_pct": fs_result.get("founder_axis_coverage_pct")},
            "market": {"score": 50, **axis_from_score(50), "note": "Market axis engine not built yet — placeholder, not a real assessment"},
            "ideaVsMarket": {"label": "Not yet scored — Idea-vs-Market engine not built yet", "cls": "neutral"},
        },
    }


def source_and_score_github_candidate(db: Session, repo: dict, sector_label: str) -> dict:
    """Runs the full pipeline for one GitHub-sourced candidate: find-or-create Founder
    and Company, create an outbound Application, ingest GitHub (+ Scholar if the
    deep-tech gate allows it), translate each source into component-tagged claims, run
    the axis engine, aggregate the Founder Score, persist a Founder-axis Score row, and
    return the dashboard-shaped payload."""
    owner = repo["owner"]
    username = owner["login"]

    founder = get_or_create_founder(db, username, owner["html_url"], display_name=None)
    prev_founder_score = founder.founder_score if founder.founder_score else None

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
    claim_dicts = github_claims(github_score)

    # GitHub's public display name, when set, is what actually stands a chance of
    # matching a Semantic Scholar author record — the raw username almost never will.
    real_name = (github_score or {}).get("raw_metrics", {}).get("real_name")
    if real_name and founder.name == username:
        founder.name = real_name
        db.commit()

    deep_tech = is_deep_tech(sector_label, repo.get("topics", []))
    scholar_score = None
    if deep_tech:
        scholar_score = ingest_scholar(
            db, founder.id, company.id, founder.name, target_keywords={sector_label.lower()}
        )
        claim_dicts += scholar_claims(scholar_score)

    claim_dicts = _fill_unobserved_components(claim_dicts, "Founder")
    _insert_claims(db, application.id, claim_dicts)

    fs_result = update_founder_score(
        db, founder.id,
        reason=f"Outbound GitHub scan — topic/sector '{sector_label}'"
               + (" + Scholar (deep-tech gate passed)" if deep_tech else ""),
    )

    trend = "stable"
    if prev_founder_score is not None:
        if fs_result["founder_score"] > prev_founder_score:
            trend = "improving"
        elif fs_result["founder_score"] < prev_founder_score:
            trend = "declining"
    else:
        trend = "insufficient_history"

    db.add(Score(
        application_id=application.id,
        axis="founder",
        value=fs_result["founder_axis_score"] if fs_result["founder_axis_score"] is not None else fs_result["founder_score"],
        trend=trend,
        confidence=fs_result["founder_axis_coverage_pct"] / 100.0,
        rationale="Component-weighted claims quality (GitHub"
                  + (" + Scholar" if deep_tech else "")
                  + f"), coverage {fs_result['founder_axis_coverage_pct']}% — axis_engine, validated against the team's ground-truth dataset.",
        cold_start=fs_result["cold_start"],
    ))
    db.commit()

    return build_candidate_payload(
        db, founder, company, application, fs_result, github_score, scholar_score,
        source_label="GitHub · live", live=True, prev_founder_score=prev_founder_score,
    )


def is_low_footprint_from_signals(db: Session, founder_id: int) -> bool:
    """Same footprint-size check as is_low_footprint(), but re-derived from stored
    `signals` rows instead of a fresh score dict — used on the Memory-reload path
    where we're rebuilding from the database, not from a just-computed result."""
    profile_signal = (
        db.query(Signal)
        .filter_by(founder_id=founder_id, type="github_profile")
        .order_by(Signal.ingested_at.desc())
        .first()
    )
    if not profile_signal:
        return True
    try:
        profile = json.loads(profile_signal.raw_content) if profile_signal.raw_content else {}
    except (json.JSONDecodeError, TypeError):
        profile = {}

    repo_signals = db.query(Signal).filter_by(founder_id=founder_id, type="github_repo").all()
    max_stars = 0
    for s in repo_signals:
        try:
            repo = json.loads(s.raw_content) if s.raw_content else {}
        except (json.JSONDecodeError, TypeError):
            repo = {}
        max_stars = max(max_stars, repo.get("stargazers_count", 0) or 0)

    followers = profile.get("followers", 0) or 0
    public_repos = profile.get("public_repos", 0) or 0
    return followers < 600 and public_repos < 50 and max_stars < 4000


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
        founder_axis_display = founder_score_row.value
        evidence = build_evidence_list(db, founder.id)
        results.append({
            "id": f"app-{application.id}",
            "name": founder.name,
            "handle": "@" + founder.github_url.rstrip("/").split("/")[-1] if founder.github_url else founder.name,
            "source": application.source,
            "sourceLabel": "GitHub · live" if application.source == "outbound" else "Inbound application",
            "sector": company.sector,
            "live": True,
            "newFounder": is_low_footprint_from_signals(db, founder.id),
            "headline": f"{company.name} — {company.snapshot or 'no description provided'}",
            "location": "See GitHub profile" if founder.github_url else "Not disclosed",
            "founderScore": founder.founder_score,
            "scoreBreakdown": {"github": founder_axis_display, "linkedin": 0, "scholarly": 0},
            "prevFounderScore": None,
            "evidence": evidence,
            "coldStart": bool(founder_score_row.cold_start),
            "axes": {
                "founder": {"score": founder_axis_display, **axis_from_score(founder_axis_display)},
                "market": {"score": 50, **axis_from_score(50), "note": "Market axis engine not built yet"},
                "ideaVsMarket": {"label": "Not yet scored", "cls": "neutral"},
            },
        })
    return results
