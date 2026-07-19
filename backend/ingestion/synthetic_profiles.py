"""
Synthetic Scholar + LinkedIn profiles — single source of truth.

Used in two places: `eval/synthetic_scholar_linkedin.py` (sanity-checks the scoring
math against a spread of hand-crafted archetypes) and `api/pipeline.py`'s demo-mode
fallback (fills in Scholar/LinkedIn signal for candidates where no real Scholar match
or LinkedIn intake text exists, so a live "Scan GitHub repos" click produces a
complete 3-source Founder Score for the demo instead of scholarly/linkedin sitting at
zero for almost every outbound-sourced candidate).

Every place this data reaches the dashboard, it must be clearly labeled as synthetic —
see `SCHOLAR_DEMO_SIGNAL_TYPE` / `LINKEDIN_DEMO_SIGNAL_TYPE` and the "[DEMO DATA]"
text prefix applied in pipeline.py. This is fabricated data standing in for a real
API/intake response shape — never present it as verified evidence.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Semantic Scholar — shape matches ingestion.semanticscholar.gather_scholar_data()
# ---------------------------------------------------------------------------

SCHOLAR_PROFILES = {
    "A_star_researcher_active_relevant": {
        "found": True,
        "matched_name": "Ananya Sharma",
        "paper_count": 24,
        "citation_count": 1850,
        "h_index": 14,
        "papers": [
            {"title": "Scalable reinforcement learning for robotic manipulation", "year": 2025, "fields_of_study": ["Computer Science"]},
            {"title": "Foundation models for embodied AI", "year": 2024, "fields_of_study": ["Machine Learning"]},
            {"title": "Sim-to-real transfer in robotics", "year": 2023, "fields_of_study": ["Robotics"]},
            {"title": "Deep learning survey", "year": 2021, "fields_of_study": ["Computer Science"]},
        ],
    },
    "B_solid_midcareer_relevant": {
        "found": True,
        "matched_name": "David Chen",
        "paper_count": 9,
        "citation_count": 210,
        "h_index": 6,
        "papers": [
            {"title": "Battery chemistry for grid-scale storage", "year": 2023, "fields_of_study": ["Materials Science"]},
            {"title": "Solid-state electrolytes review", "year": 2020, "fields_of_study": ["Chemistry"]},
        ],
    },
    "C_early_academic_but_relevant_and_recent": {
        "found": True,
        "matched_name": "Priya Natarajan",
        "paper_count": 3,
        "citation_count": 12,
        "h_index": 2,
        "papers": [
            {"title": "Quantum error correction on near-term hardware", "year": 2025, "fields_of_study": ["Quantum Computing"]},
        ],
    },
    "D_dormant_once_prolific": {
        "found": True,
        "matched_name": "Robert Kim",
        "paper_count": 18,
        "citation_count": 900,
        "h_index": 11,
        "papers": [
            {"title": "Genomic sequencing pipelines", "year": 2012, "fields_of_study": ["Genomics"]},
            {"title": "Bioinformatics tooling", "year": 2010, "fields_of_study": ["Bioinformatics"]},
        ],
    },
    "E_name_collision_irrelevant_field": {
        "found": True,
        "matched_name": "John Smith",
        "paper_count": 15,
        "citation_count": 400,
        "h_index": 8,
        "papers": [
            {"title": "Medieval trade routes and monetary policy", "year": 2018, "fields_of_study": ["History", "Economics"]},
            {"title": "Renaissance art patronage", "year": 2015, "fields_of_study": ["Art History"]},
        ],
    },
    "F_thin_match_low_everything": {
        "found": True,
        "matched_name": "Sam Patel",
        "paper_count": 1,
        "citation_count": 0,
        "h_index": 0,
        "papers": [
            {"title": "Undergraduate thesis on local optimization heuristics", "year": 2019, "fields_of_study": ["Computer Science"]},
        ],
    },
    "G_no_match_found": {
        "found": False,
        "name": "Alex Founder",
    },
}

# ---------------------------------------------------------------------------
# LinkedIn — raw pasted text, matches what the founder intake form would collect
# ---------------------------------------------------------------------------

LINKEDIN_PROFILES = {
    "A_serial_founder_ai_active": (
        "Co-founder & CEO, building an AI infrastructure startup (2023 - present). "
        "Previously Senior Machine Learning Engineer at a fintech company (2018 - 2023), "
        "5 years leading applied ML teams. Frequently posted about LLMs and venture capital "
        "trends, spoke on a panel about AI and entrepreneurship, hosted a podcast episode on "
        "GenAI in finance."
    ),
    "B_solid_operator_stable_tenure": (
        "VP of Engineering (2019 - present). Head of Product before that (2015 - 2019). "
        "10+ years building software products. Occasionally wrote about engineering "
        "leadership."
    ),
    "C_early_career_first_time_founder": (
        "Founder, working on a new startup idea (2024 - present). Previously a software "
        "engineer for 2 years."
    ),
    "D_job_hopper_no_engagement": (
        "Software Engineer (2022 - 2023). Software Engineer (2021 - 2022). Software "
        "Engineer (2020 - 2021)."
    ),
    "E_vague_no_dates_no_signal": (
        "Passionate about building things and working with great teams. Interested in "
        "technology and innovation."
    ),
    "F_embellished_buzzword_stuffed": (
        "Visionary thought leader and serial entrepreneur disrupting AI, fintech, and "
        "venture capital. Posted, wrote, and spoke about GenAI, LLMs, and startups "
        "constantly."
    ),
    "G_no_text_provided": None,
}

# Archetypes excluded from the demo-mode rotation because they represent "no signal at
# all" — including them would make the demo pipeline sometimes silently contribute
# nothing, which defeats the point of the fallback. They're kept in the dicts above
# for the eval harness, which specifically wants to test the "nothing found" case.
SCHOLAR_ROTATION = [k for k in SCHOLAR_PROFILES if k != "G_no_match_found"]
LINKEDIN_ROTATION = [k for k in LINKEDIN_PROFILES if k != "G_no_text_provided"]

SCHOLAR_DEMO_SIGNAL_TYPE = "scholar_profile_demo"
LINKEDIN_DEMO_SIGNAL_TYPE = "linkedin_self_reported_demo"


def pick_scholar_profile(seed: int) -> tuple[str, dict]:
    """Deterministic (not random) so repeated scans of the same founder are
    reproducible — same spirit as the rest of this codebase's "no LLM, no
    randomness" ingestion design."""
    label = SCHOLAR_ROTATION[seed % len(SCHOLAR_ROTATION)]
    return label, SCHOLAR_PROFILES[label]


def pick_linkedin_text(seed: int) -> tuple[str, str]:
    label = LINKEDIN_ROTATION[seed % len(LINKEDIN_ROTATION)]
    return label, LINKEDIN_PROFILES[label]
