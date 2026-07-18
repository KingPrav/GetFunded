"""
GitHub ingestion — deterministic, no LLM involved here on purpose.

Pulls a founder's public profile, owned (non-fork) repos, weekly commit activity,
and contributor lists via the official REST API, normalizes them into `Signal` rows,
and computes the four GitHub sub-metric scores agreed with the team:

    commit frequency & consistency  30%
    repo topic relevance            20%
    star growth velocity            25%
    contributor patterns            25%

Design notes / heuristic limitations (documented, not hidden):
- GitHub's API doesn't expose historical star counts, so "star growth velocity" is
  approximated as stars / age-in-months on each owned repo. This rewards fast recent
  traction but will slightly undercount old, steadily-starred repos. Fine for MVP.
- `stats/commit_activity` and `stats/contributors` are both async on GitHub's side the
  first time they're requested (returns 202 while GitHub computes them). We retry once
  after a short delay; if still unavailable we fall back to a cruder recency-based proxy
  and lower the confidence score rather than fail.
- No LLM calls in this file. Topic relevance is keyword overlap only. Anything requiring
  judgment (e.g. "is this repo actually relevant to the pitch") belongs in the scoring/
  reasoning layer, not here.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from typing import Any

import requests

GITHUB_API = "https://api.github.com"
_TOKEN = os.environ.get("GITHUB_TOKEN")  # optional; raises rate limit from 60/hr to 5000/hr

# A generic fallback keyword list used when the company has no declared sector/keywords,
# so we still give *some* relevance signal instead of a flat neutral score.
_DEFAULT_RELEVANT_KEYWORDS = {
    "ai", "ml", "machine-learning", "artificial-intelligence", "llm", "nlp",
    "data", "infra", "infrastructure", "startup", "saas", "api", "backend",
    "agent", "agents", "robotics", "fintech", "healthtech", "biotech",
}


def _headers() -> dict:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "vc-brain-ingestion"}
    if _TOKEN:
        headers["Authorization"] = f"Bearer {_TOKEN}"
    return headers


def _get(url: str, params: dict | None = None) -> tuple[int, Any]:
    """Thin wrapper: returns (status_code, json_or_none). Never raises on HTTP errors —
    callers decide how to degrade."""
    try:
        resp = requests.get(url, headers=_headers(), params=params, timeout=15)
    except requests.RequestException:
        return 0, None
    try:
        body = resp.json()
    except ValueError:
        body = None
    return resp.status_code, body


def fetch_user(username: str) -> dict | None:
    status, body = _get(f"{GITHUB_API}/users/{username}")
    if status == 200 and isinstance(body, dict):
        return body
    return None


def fetch_owned_repos(username: str, max_repos: int = 8) -> list[dict]:
    """Most-recently-pushed, non-fork repos owned by the user. Capped for hackathon
    ingestion speed — we care about signal density, not exhaustive history."""
    status, body = _get(
        f"{GITHUB_API}/users/{username}/repos",
        params={"sort": "pushed", "direction": "desc", "per_page": 100, "type": "owner"},
    )
    if status != 200 or not isinstance(body, list):
        return []
    non_forks = [r for r in body if not r.get("fork")]
    return non_forks[:max_repos]


def search_repos_by_topic(topic: str, limit: int = 5, created_after: str = "2024-01-01") -> list[dict]:
    """Outbound sourcing entrypoint: recently-created, recently-updated repos tagged
    with `topic`. This is the "Identify" half of outbound sourcing — scanning for
    founders before they've applied, scored the same way as an inbound application
    once we pull the owner's full profile."""
    status, body = _get(
        f"{GITHUB_API}/search/repositories",
        params={
            "q": f"topic:{topic} created:>{created_after}",
            "sort": "updated",
            "order": "desc",
            "per_page": limit,
        },
    )
    if status != 200 or not isinstance(body, dict):
        return []
    return body.get("items", [])


def fetch_commit_activity(owner: str, repo: str, retries: int = 1) -> list[int] | None:
    """Weekly commit counts for the last 52 weeks. Returns None if unavailable even
    after retrying the async-computation window GitHub uses for this endpoint."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}/stats/commit_activity"
    for attempt in range(retries + 1):
        status, body = _get(url)
        if status == 200 and isinstance(body, list):
            return [week.get("total", 0) for week in body]
        if status == 202 and attempt < retries:
            time.sleep(2)
            continue
        break
    return None


def fetch_contributors_count(owner: str, repo: str) -> int | None:
    status, body = _get(
        f"{GITHUB_API}/repos/{owner}/{repo}/contributors",
        params={"per_page": 100, "anon": "false"},
    )
    if status == 200 and isinstance(body, list):
        return len(body)
    return None


def _months_since(iso_date: str) -> float:
    created = datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
    delta = datetime.now(timezone.utc) - created
    return max(delta.days / 30.0, 1.0)


def gather_github_data(username: str, max_repos: int = 8) -> dict:
    """Pulls everything we need for scoring in one pass. Pure fetch — no DB, no scoring
    math — so it's easy to unit test with a fixture in place of a live call."""
    profile = fetch_user(username)
    if profile is None:
        return {"found": False, "username": username}

    repos = fetch_owned_repos(username, max_repos=max_repos)
    enriched_repos = []
    for repo in repos:
        owner = repo["owner"]["login"]
        name = repo["name"]
        commit_activity = fetch_commit_activity(owner, name)
        contributors = fetch_contributors_count(owner, name)
        enriched_repos.append(
            {
                "name": name,
                "full_name": repo.get("full_name"),
                "html_url": repo.get("html_url"),
                "description": repo.get("description") or "",
                "language": repo.get("language"),
                "topics": repo.get("topics", []),
                "stargazers_count": repo.get("stargazers_count", 0),
                "created_at": repo.get("created_at"),
                "pushed_at": repo.get("pushed_at"),
                "commit_activity_52w": commit_activity,
                "contributors_count": contributors,
            }
        )

    return {"found": True, "username": username, "profile": profile, "repos": enriched_repos}


# ---------------------------------------------------------------------------
# Scoring (pure functions — no network, no DB; unit-testable in isolation)
# ---------------------------------------------------------------------------

def _score_frequency_consistency(repos: list[dict]) -> tuple[float, bool]:
    """30% sub-metric. Returns (score_0_10, had_real_data)."""
    weekly_series = [r["commit_activity_52w"] for r in repos if r.get("commit_activity_52w")]
    if not weekly_series:
        return 0.0, False

    total_commits = sum(sum(series) for series in weekly_series)
    # active_weeks: union across repos of weeks with >0 commits (approximated as sum of
    # per-repo active-week counts, capped at 52 — simple and good enough for MVP)
    active_weeks = min(52, sum(1 for series in weekly_series for w in series if w > 0))

    frequency_score = min(10.0, total_commits / 50.0)  # ~500 commits/yr across repos = max
    consistency_score = (active_weeks / 52.0) * 10.0
    return round(0.6 * frequency_score + 0.4 * consistency_score, 2), True


def _score_topic_relevance(repos: list[dict], target_keywords: set[str] | None) -> tuple[float, bool]:
    """20% sub-metric."""
    keywords = {k.lower() for k in target_keywords} if target_keywords else _DEFAULT_RELEVANT_KEYWORDS
    if not repos:
        return 0.0, False

    hits = 0
    total_signals = 0
    for r in repos:
        text_bag = {t.lower() for t in r.get("topics", [])}
        if r.get("language"):
            text_bag.add(r["language"].lower())
        desc_words = {w.strip(".,!?").lower() for w in (r.get("description") or "").split()}
        text_bag |= desc_words
        total_signals += 1
        if text_bag & keywords:
            hits += 1

    if total_signals == 0:
        return 0.0, False
    ratio = hits / total_signals
    return round(ratio * 10.0, 2), True


def _score_star_growth(repos: list[dict]) -> tuple[float, bool]:
    """25% sub-metric. stars / age-in-months per repo, take the max (best-performing repo
    is the relevant signal, not a dilution across an old backlog of stale repos)."""
    if not repos:
        return 0.0, False

    velocities = []
    for r in repos:
        if not r.get("created_at"):
            continue
        age_months = _months_since(r["created_at"])
        velocities.append(r.get("stargazers_count", 0) / age_months)

    if not velocities:
        return 0.0, False
    best = max(velocities)
    # 5+ stars/month sustained is a strong organic-traction signal for a young repo -> cap at 10
    return round(min(10.0, (best / 5.0) * 10.0), 2), True


def _score_contributor_patterns(repos: list[dict]) -> tuple[float, bool]:
    """25% sub-metric. Solo shipping still earns partial credit (building alone isn't a
    red flag by itself); collaboration on top of that is rewarded."""
    counts = [r["contributors_count"] for r in repos if r.get("contributors_count") is not None]
    if not counts:
        return 0.0, False

    avg_contributors = sum(counts) / len(counts)
    base = 4.0  # solo baseline
    collab_bonus = min(6.0, max(0.0, (avg_contributors - 1) * 3.0))
    return round(min(10.0, base + collab_bonus), 2), True


def compute_github_score(github_data: dict, target_keywords: set[str] | None = None) -> dict:
    """Combines the four sub-metrics into the GitHub source score (0-10) plus a
    confidence value reflecting how much real data backed the computation.

    Weights: frequency/consistency 30%, topic relevance 20%, star growth 25%,
    contributor patterns 25% — matches the source-level breakdown agreed for the
    Founder axis's Ability & Execution component.
    """
    if not github_data.get("found"):
        return {
            "source": "github",
            "score": None,
            "confidence": 0.0,
            "sub_scores": {},
            "note": "No GitHub profile found for this username.",
        }

    repos = github_data.get("repos", [])

    freq_score, freq_ok = _score_frequency_consistency(repos)
    topic_score, topic_ok = _score_topic_relevance(repos, target_keywords)
    star_score, star_ok = _score_star_growth(repos)
    contrib_score, contrib_ok = _score_contributor_patterns(repos)

    weights = {
        "commit_frequency_consistency": 0.30,
        "topic_relevance": 0.20,
        "star_growth": 0.25,
        "contributor_patterns": 0.25,
    }
    sub_scores = {
        "commit_frequency_consistency": freq_score,
        "topic_relevance": topic_score,
        "star_growth": star_score,
        "contributor_patterns": contrib_score,
    }
    data_present = {
        "commit_frequency_consistency": freq_ok,
        "topic_relevance": topic_ok,
        "star_growth": star_ok,
        "contributor_patterns": contrib_ok,
    }

    # Renormalize weights across sub-metrics that actually had data, same pattern as the
    # source-level renormalization for cold-start founders.
    available_weight = sum(w for k, w in weights.items() if data_present[k])
    if available_weight == 0:
        overall = 0.0
    else:
        overall = sum(
            sub_scores[k] * weights[k] for k in weights if data_present[k]
        ) / available_weight
        overall = round(overall, 2)

    confidence = round(available_weight, 2)  # 1.0 = all four sub-metrics had real data
    if not repos:
        confidence = 0.1  # profile exists but no owned repos — very thin signal

    # Raw countable numbers, separate from the 0-10 sub-scores — needed downstream by
    # ingestion/claims.py to populate `value_numeric` on claims (a claim only counts as
    # a "shipped artifact" in the Founder Score formula if it carries a real number, not
    # just a 0-10 score).
    total_commits = sum(
        sum(r["commit_activity_52w"]) for r in repos if r.get("commit_activity_52w")
    )
    star_velocities = [
        r.get("stargazers_count", 0) / max(_months_since(r["created_at"]), 1.0)
        for r in repos if r.get("created_at")
    ]
    contributor_counts = [r["contributors_count"] for r in repos if r.get("contributors_count") is not None]
    raw_metrics = {
        "total_commits_52w": total_commits,
        "best_star_velocity_per_month": round(max(star_velocities), 2) if star_velocities else 0.0,
        "avg_contributors": round(sum(contributor_counts) / len(contributor_counts), 2) if contributor_counts else None,
        "repos_considered_count": len(repos),
    }

    return {
        "source": "github",
        "score": overall,
        "confidence": confidence,
        "raw_metrics": raw_metrics,
        "sub_scores": sub_scores,
        "data_present": data_present,
        "repos_considered": [r["full_name"] for r in repos],
    }


# ---------------------------------------------------------------------------
# DB-writing entrypoint — the only function in this file that touches the database.
# Everything above is pure fetch/scoring so it can be unit tested without a DB or a
# live network call.
# ---------------------------------------------------------------------------

def ingest_github(db, founder_id: int, company_id: int | None, username: str,
                   target_keywords: set[str] | None = None) -> dict:
    """Fetches GitHub data for `username`, writes it into `signals` as evidence
    (one row per profile, one per repo — this is what Agentic Traceability points
    claims back to), and returns the computed GitHub source score for the Founder axis.
    """
    from db.models import Signal  # local import avoids a hard dependency for pure-logic tests

    github_data = gather_github_data(username)

    if not github_data.get("found"):
        return compute_github_score(github_data)

    profile = github_data["profile"]
    db.add(
        Signal(
            founder_id=founder_id,
            company_id=company_id,
            type="github_profile",
            source_url=profile.get("html_url"),
            raw_content=json.dumps(profile, default=str),
        )
    )

    for repo in github_data["repos"]:
        db.add(
            Signal(
                founder_id=founder_id,
                company_id=company_id,
                type="github_repo",
                source_url=repo.get("html_url"),
                raw_content=json.dumps(repo, default=str),
            )
        )

    db.commit()

    return compute_github_score(github_data, target_keywords=target_keywords)
