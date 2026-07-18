"""
Deep-tech gate.

Google Scholar / arXiv / patent signal is "high signal for a narrow founder type, low
signal otherwise" (per the team's source-tiering notes). Scoring every founder against it
would silently punish a normal SaaS/consumer founder for not having a publication record
that was never relevant to them in the first place.

This module decides, cheaply and before any Semantic Scholar/arXiv call is made, whether
that lookup is even worth attempting. Keyword match on company sector + GitHub repo
topics — simple and fast, matching the hackathon-time-budget tradeoff we agreed on
(an LLM classifier would be marginally more accurate but isn't worth the latency/cost
here; this is a pre-filter, not a scored claim itself).
"""

DEEP_TECH_KEYWORDS = {
    "ai", "ml", "machine-learning", "artificial-intelligence", "llm", "nlp",
    "deep-learning", "computer-vision", "robotics", "biotech", "bioinformatics",
    "computational-biology", "genomics", "chemistry", "materials-science",
    "quantum", "quantum-computing", "semiconductor", "chip-design", "hardware",
    "aerospace", "climate-tech", "energy", "battery", "fusion",
    "deep-tech", "deeptech", "ai-infra", "ai-infrastructure", "foundation-model",
}


def is_deep_tech(sector: str | None, github_topics: list[str] | None = None) -> bool:
    """True if the founder/company looks like a deep-tech or AI-infra play, based on
    the company's declared sector plus any topics pulled from their GitHub repos.
    Used purely as a gate for whether to run Scholar/arXiv lookups — not itself a score.
    """
    text_bag: set[str] = set()

    if sector:
        # split on non-alphanumeric so "AI infra" -> {"ai", "infra"}, "bio-tech" -> {"bio", "tech"}
        for token in sector.lower().replace("-", " ").replace("/", " ").split():
            text_bag.add(token)
        text_bag.add(sector.lower().strip())

    for topic in github_topics or []:
        text_bag.add(topic.lower())

    return bool(text_bag & DEEP_TECH_KEYWORDS)
