"""
LinkedIn — self-pasted text only. No scraping.

Direct LinkedIn scraping violates their Terms of Service and is a real legal/ToS
exposure even for a hackathon demo (flagged and agreed with the team). Instead, the
founder pastes their own career summary / LinkedIn text into the intake form. Same
trust discount applies as would apply to any self-reported source — this module
applies it explicitly (0.7x) rather than pretending self-reported text is as reliable
as an API-verified signal.

Heuristic, not LLM-based, by design: this needs to run with zero external dependency
and zero added latency/cost during a live 24-hour-decision demo. Sub-metrics:
    career history relevance & seniority   40%
    tenure stability                       20%
    AI / Finance / Entrepreneurship content engagement   40%
"""
from __future__ import annotations

import re

TRUST_DISCOUNT = 0.7  # self-reported, easy to embellish — applied to the final blend

_SENIORITY_TERMS = {
    "founder", "co-founder", "cofounder", "ceo", "cto", "coo", "vp", "vice president",
    "director", "head of", "lead", "principal", "staff", "senior", "chief",
}
_RELEVANT_DOMAIN_TERMS = {
    "engineer", "engineering", "product", "research", "scientist", "data", "software",
    "founder", "startup", "venture", "investment", "analyst", "consultant",
}
_ENGAGEMENT_TOPIC_TERMS = {
    "ai", "artificial intelligence", "machine learning", "llm", "genai",
    "finance", "fintech", "venture capital", "vc", "investing",
    "entrepreneurship", "startup", "founder", "startups",
}
_ENGAGEMENT_VERB_TERMS = {
    "posted", "wrote", "published", "speaker", "spoke", "panelist", "panel",
    "newsletter", "keynote", "podcast", "hosted", "presented",
}

_YEARS_EXPERIENCE_RE = re.compile(r"(\d{1,2})\+?\s*years?", re.IGNORECASE)
_DATE_RANGE_RE = re.compile(
    r"(19|20)\d{2}\s*[-–—to]{1,4}\s*((19|20)\d{2}|present|current|now)",
    re.IGNORECASE,
)


def _score_career_relevance(text: str) -> float:
    lower = text.lower()
    seniority_hits = sum(1 for term in _SENIORITY_TERMS if term in lower)
    domain_hits = sum(1 for term in _RELEVANT_DOMAIN_TERMS if term in lower)

    years_match = _YEARS_EXPERIENCE_RE.search(lower)
    years_score = min(10.0, int(years_match.group(1)) * 1.2) if years_match else 0.0

    keyword_score = min(10.0, (seniority_hits * 1.8) + (domain_hits * 1.0))
    return round(max(keyword_score, years_score) if years_match else keyword_score, 2)


def _score_tenure_stability(text: str) -> tuple[float, bool]:
    """Average duration across detected date ranges. Early-career founders with little
    total history are scored neutrally (5.0) rather than penalized — a first-time
    founder shouldn't be marked down just for not having a decade of roles yet."""
    if not _DATE_RANGE_RE.search(text):
        return 5.0, False  # no dates found — neutral, not a penalty

    matches = _DATE_RANGE_RE.finditer(text)
    durations = []
    for m in matches:
        full = m.group(0)
        nums = [int(y) for y in re.findall(r"(?:19|20)\d{2}", full)]
        if len(nums) >= 2:
            durations.append(max(0, nums[1] - nums[0]))
        elif "present" in full.lower() or "current" in full.lower() or "now" in full.lower():
            if nums:
                from datetime import datetime
                durations.append(max(0, datetime.now().year - nums[0]))

    if not durations:
        return 5.0, False

    avg_years = sum(durations) / len(durations)
    total_years = sum(durations)
    if total_years < 2:
        return 5.0, True  # too little history to judge stability either way — neutral

    # 2+ years average tenure per role reads as stable; under that isn't automatically
    # penalized hard, just scored proportionally
    score = min(10.0, (avg_years / 2.0) * 10.0)
    return round(score, 2), True


def _score_content_engagement(text: str) -> float:
    lower = text.lower()
    topic_hits = sum(1 for term in _ENGAGEMENT_TOPIC_TERMS if term in lower)
    verb_hits = sum(1 for term in _ENGAGEMENT_VERB_TERMS if term in lower)
    # engagement requires both a relevant topic AND an engagement verb to score well —
    # just mentioning "AI" in a job title isn't "engaging with AI content"
    combined = min(10.0, (topic_hits * 1.2) + (verb_hits * 1.5))
    return round(combined, 2)


def compute_linkedin_score(pasted_text: str | None) -> dict:
    if not pasted_text or not pasted_text.strip():
        return {
            "source": "linkedin",
            "score": None,
            "confidence": 0.0,
            "sub_scores": {},
            "note": "No LinkedIn text provided by founder.",
        }

    career_score = _score_career_relevance(pasted_text)
    tenure_score, tenure_had_dates = _score_tenure_stability(pasted_text)
    engagement_score = _score_content_engagement(pasted_text)

    weights = {"career_relevance": 0.40, "tenure_stability": 0.20, "content_engagement": 0.40}
    sub_scores = {
        "career_relevance": career_score,
        "tenure_stability": tenure_score,
        "content_engagement": engagement_score,
    }

    raw = sum(sub_scores[k] * weights[k] for k in weights)
    discounted = round(raw * TRUST_DISCOUNT, 2)

    # confidence reflects self-reported nature (capped below 1.0 even with rich text)
    # plus whether we actually found parseable structure (dates) to base tenure on
    confidence = 0.6 if tenure_had_dates else 0.45

    return {
        "source": "linkedin",
        "score": discounted,
        "confidence": confidence,
        "sub_scores": sub_scores,
        "trust_discount_applied": TRUST_DISCOUNT,
        "note": "Self-reported text, not API-verified — trust discount applied.",
    }


def ingest_linkedin(db, founder_id: int, company_id: int | None, pasted_text: str | None) -> dict:
    from db.models import Signal

    if pasted_text and pasted_text.strip():
        db.add(
            Signal(
                founder_id=founder_id,
                company_id=company_id,
                type="linkedin_self_reported",
                source_url=None,
                raw_content=pasted_text,
            )
        )
        db.commit()

    return compute_linkedin_score(pasted_text)
