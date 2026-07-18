"""
Semantic Scholar ingestion — deterministic, free, no API key required for this usage.

Used as a stand-in for Google Scholar: Scholar itself has no official API and blocks
scraping with captchas quickly, whereas Semantic Scholar exposes the same publication /
citation / h-index data through a clean, documented API.

Caller's responsibility: only invoke `gather_scholar_data` when
`scoring.deep_tech.is_deep_tech(...)` returns True. This module doesn't gate itself,
it just does the fetch + score once asked.

Known limitation, documented rather than hidden: author search here is by name only,
with no disambiguation (no affiliation/topic cross-check). A common name can match the
wrong "J. Smith". We flag this by capping confidence and labeling the match "unverified"
rather than silently trusting it — real fix would be cross-referencing affiliation
against the pitch deck, left as a future improvement.
"""
from __future__ import annotations

import json
import math

import requests

API_BASE = "https://api.semanticscholar.org/graph/v1"


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
        params={"fields": "name,affiliations,paperCount,citationCount,hIndex"},
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

    return {
        "found": True,
        "name": founder_name,
        "matched_name": detail.get("name"),
        "affiliations": detail.get("affiliations", []),
        "paper_count": detail.get("paperCount", 0) or 0,
        "citation_count": detail.get("citationCount", 0) or 0,
        "h_index": detail.get("hIndex", 0) or 0,
        "profile_url": f"https://www.semanticscholar.org/author/{match['authorId']}",
    }


# ---------------------------------------------------------------------------
# Scoring (pure — no network, no DB)
# ---------------------------------------------------------------------------

def compute_scholar_score(scholar_data: dict) -> dict:
    """Publication count 35%, citation impact 40%, h-index 25%.

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

    papers = scholar_data["paper_count"]
    citations = scholar_data["citation_count"]
    h_index = scholar_data["h_index"]

    paper_score = min(10.0, papers * 1.5)
    citation_score = min(10.0, math.log10(citations + 1) * 3.3)
    hindex_score = min(10.0, h_index * 1.2)

    overall = round(paper_score * 0.35 + citation_score * 0.40 + hindex_score * 0.25, 2)

    # Name-match disambiguation risk caps confidence even with strong numbers.
    confidence = 0.6 if papers > 0 or citations > 0 else 0.3

    return {
        "source": "scholar",
        "score": overall,
        "confidence": confidence,
        "sub_scores": {
            "publication_count": round(paper_score, 2),
            "citation_impact": round(citation_score, 2),
            "h_index": round(hindex_score, 2),
        },
        "note": f"Matched \"{scholar_data.get('matched_name')}\" by name only — unverified, "
                "no affiliation cross-check performed.",
        "profile_url": scholar_data.get("profile_url"),
    }


# ---------------------------------------------------------------------------
# DB-writing entrypoint
# ---------------------------------------------------------------------------

def ingest_scholar(db, founder_id: int, company_id: int | None, founder_name: str) -> dict:
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

    return compute_scholar_score(scholar_data)
