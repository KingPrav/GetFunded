"""
Semantic Scholar ingestion — deterministic, free, no API key required for this usage.

Used as a stand-in for Google Scholar: Scholar itself has no official API and blocks
scraping with captchas quickly, whereas Semantic Scholar exposes the same publication /
citation / h-index data — plus per-paper year and field-of-study — through a clean,
documented API.

Caller's responsibility: only invoke `gather_scholar_data` when
`scoring.deep_tech.is_deep_tech(...)` returns True. This module doesn't gate itself,
it just does the fetch + score once asked.

Disambiguation: author search here is by name only. A common name can match the wrong
"J. Smith". Rather than a flat guessed confidence, we now check whether the matched
author's papers are topically relevant to the founder's sector (title/fields-of-study
overlap with sector keywords) — a real match tends to publish in a relevant field, a
wrong-person collision usually doesn't. This is the same strength-vs-trust separation
used everywhere else in the system: publication count/citations/h-index/recency are
*quality* (what gets scored), topical relevance is *trust* (how sure we are this is the
right person) — they're computed independently and only combined at the very end.
"""
from __future__ import annotations

import json
import math
from datetime import date

import requests

from scoring.deep_tech import DEEP_TECH_KEYWORDS

API_BASE = "https://api.semanticscholar.org/graph/v1"

AUTHOR_DETAIL_FIELDS = (
    "name,affiliations,paperCount,citationCount,hIndex,"
    "papers.title,papers.year,papers.fieldsOfStudy"
)


def _get(url: str, params: dict | None = None) -> tuple[int, dict | None]:
    try:
        resp = requests.get(url, params=params, timeout=15)
    except requests.RequestException:
        return 0, None
    try:
        body = resp.json()
    except ValueError:
        body = None
    return resp.status_code, body


def search_author(name: str) -> dict | None:
    """Top name match only — see module docstring on the disambiguation limitation."""
    if not name:
        return None
    status, body = _get(f"{API_BASE}/author/search", params={"query": name, "limit": 1})
    if status != 200 or not body or not body.get("data"):
        return None
    return body["data"][0]


def fetch_author_detail(author_id: str) -> dict | None:
    status, body = _get(
        f"{API_BASE}/author/{author_id}",
        params={"fields": AUTHOR_DETAIL_FIELDS},
    )
    if status == 200 and isinstance(body, dict):
        return body
    return None


def gather_scholar_data(founder_name: str) -> dict:
    """Pure fetch, no DB, no scoring — easy to unit test with a fixture in place of a
    live call, matching the pattern used for GitHub."""
    match = search_author(founder_name)
    if not match or not match.get("authorId"):
        return {"found": False, "name": founder_name}

    detail = fetch_author_detail(match["authorId"])
    if not detail:
        return {"found": False, "name": founder_name}

    papers = []
    for p in detail.get("papers", []) or []:
        papers.append({
            "title": p.get("title") or "",
            "year": p.get("year"),
            "fields_of_study": p.get("fieldsOfStudy") or [],
        })

    return {
        "found": True,
        "name": founder_name,
        "matched_name": detail.get("name"),
        "affiliations": detail.get("affiliations", []),
        "paper_count": detail.get("paperCount", 0) or 0,
        "citation_count": detail.get("citationCount", 0) or 0,
        "h_index": detail.get("hIndex", 0) or 0,
        "papers": papers,
        "profile_url": f"https://www.semanticscholar.org/author/{match['authorId']}",
    }


# ---------------------------------------------------------------------------
# Scoring (pure — no network, no DB)
# ---------------------------------------------------------------------------

def _score_recency(papers: list[dict]) -> float:
    """0-10. Based on the most recent paper's year — rewards a founder who is
    currently active, not just one who published a lot at some point in the past."""
    years = [p["year"] for p in papers if p.get("year")]
    if not years:
        return 0.0
    years_ago = date.today().year - max(years)
    if years_ago <= 1:
        return 10.0
    if years_ago <= 2:
        return 8.0
    if years_ago <= 3:
        return 6.0
    if years_ago <= 5:
        return 3.0
    return 1.0


def _match_relevance_ratio(papers: list[dict], target_keywords: set[str] | None) -> float:
    """Fraction of the matched author's papers whose title or fields-of-study overlap
    the founder's sector keywords (falls back to the deep-tech keyword list if no
    sector keywords were given). Used purely as a confidence signal, never as part of
    the quality score — a topically-relevant match is more likely to be the right
    person, but topical relevance itself says nothing about how good a founder they'd
    be."""
    if not papers:
        return 0.0
    keywords = {k.lower() for k in target_keywords} if target_keywords else DEEP_TECH_KEYWORDS

    hits = 0
    for p in papers:
        text_bag = {f.lower() for f in p.get("fields_of_study", [])}
        text_bag |= {w.strip(".,!?():;").lower() for w in (p.get("title") or "").split()}
        if text_bag & keywords:
            hits += 1
    return hits / len(papers)


def compute_scholar_score(scholar_data: dict, target_keywords: set[str] | None = None) -> dict:
    """Publication count 25%, citation impact 30%, h-index 20%, recency 25%.

    Patent filings were part of the original source design but require a separate
    PatentsView integration we haven't built yet — out of scope for this pass, noted
    as a gap rather than faked.
    """
    if not scholar_data.get("found"):
        return {
            "source": "scholar",
            "score": None,
            "confidence": 0.0,
            "sub_scores": {},
            "note": "No Semantic Scholar match found — absence of signal, not a penalty "
                     "by itself for a non-deep-tech founder; this source should not even "
                     "have been invoked otherwise.",
        }

    papers_list = scholar_data.get("papers", [])
    citations = scholar_data["citation_count"]
    papers_count = scholar_data["paper_count"]
    h_index = scholar_data["h_index"]

    paper_score = min(10.0, papers_count * 1.5)
    citation_score = min(10.0, math.log10(citations + 1) * 3.3)
    hindex_score = min(10.0, h_index * 1.2)
    recency_score = _score_recency(papers_list)

    weights = {
        "publication_count": 0.25,
        "citation_impact": 0.30,
        "h_index": 0.20,
        "recency": 0.25,
    }
    sub_scores = {
        "publication_count": round(paper_score, 2),
        "citation_impact": round(citation_score, 2),
        "h_index": round(hindex_score, 2),
        "recency": round(recency_score, 2),
    }
    overall = round(sum(sub_scores[k] * weights[k] for k in weights), 2)

    # Confidence: base guess from whether there's any real activity at all, boosted by
    # how topically relevant the matched author's actual papers are to this founder's
    # sector. A strong topical match can push confidence up toward "verified enough to
    # trust"; a name-only match with no topical signal stays capped low.
    base_confidence = 0.6 if (papers_count > 0 or citations > 0) else 0.3
    relevance = _match_relevance_ratio(papers_list, target_keywords)
    confidence = round(min(0.95, base_confidence + 0.30 * relevance), 2)

    most_recent_year = max((p["year"] for p in papers_list if p.get("year")), default=None)

    return {
        "source": "scholar",
        "score": overall,
        "confidence": confidence,
        "sub_scores": sub_scores,
        "note": f"Matched \"{scholar_data.get('matched_name')}\" by name only, "
                f"topical relevance {round(relevance * 100)}% of papers — "
                + ("reasonably confident this is the right person."
                   if relevance >= 0.3 else
                   "low topical overlap, treat this match with caution."),
        "profile_url": scholar_data.get("profile_url"),
        "raw_metrics": {
            "paper_count": papers_count, "citation_count": citations, "h_index": h_index,
            "matched_name": scholar_data.get("matched_name"),
            "most_recent_paper_year": most_recent_year,
            "match_relevance_ratio": round(relevance, 2),
            "papers_considered": len(papers_list),
        },
    }


# ---------------------------------------------------------------------------
# DB-writing entrypoint
# ---------------------------------------------------------------------------

def ingest_scholar(db, founder_id: int, company_id: int | None, founder_name: str,
                    target_keywords: set[str] | None = None) -> dict:
    from db.models import Signal

    scholar_data = gather_scholar_data(founder_name)

    if scholar_data.get("found"):
        db.add(
            Signal(
                founder_id=founder_id,
                company_id=company_id,
                type="scholar_profile",
                source_url=scholar_data.get("profile_url"),
                raw_content=json.dumps(scholar_data, default=str),
            )
        )
        db.commit()

    return compute_scholar_score(scholar_data, target_keywords=target_keywords)
