"""
Synthetic evaluation harness for the Semantic Scholar and LinkedIn scoring code.

Neither source can be evaluated against live data in this environment (Semantic
Scholar's API is blocked from the sandbox, and LinkedIn is never scraped at all —
by design, see ingestion/linkedin.py). So this builds a spread of hand-crafted
synthetic profiles, shaped exactly like the real data structures each module expects
(`gather_scholar_data()`'s return shape for Scholar, raw pasted text for LinkedIn),
and runs them through the real scoring functions unmodified.

This isn't a unit test with fixed pass/fail assertions on exact numbers — it's a
sanity/eval pass: does the code rank profiles in the order a human would expect?
Run directly: `python3 eval/synthetic_scholar_linkedin.py`
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingestion.linkedin import compute_linkedin_score
from ingestion.semanticscholar import compute_scholar_score
from ingestion.synthetic_profiles import LINKEDIN_PROFILES, SCHOLAR_PROFILES


def run_scholar_eval() -> list[dict]:
    rows = []
    for label, profile in SCHOLAR_PROFILES.items():
        result = compute_scholar_score(profile, target_keywords={
            "ai", "ml", "machine-learning", "robotics", "quantum", "battery",
            "materials-science", "chemistry",
        })
        rows.append({
            "profile": label,
            "score": result["score"],
            "confidence": result["confidence"],
            "sub_scores": result.get("sub_scores"),
            "relevance": result.get("raw_metrics", {}).get("match_relevance_ratio"),
        })
    return rows


def run_linkedin_eval() -> list[dict]:
    rows = []
    for label, text in LINKEDIN_PROFILES.items():
        result = compute_linkedin_score(text)
        rows.append({
            "profile": label,
            "score": result["score"],
            "confidence": result["confidence"],
            "sub_scores": result.get("sub_scores"),
        })
    return rows


def _print_table(title: str, rows: list[dict]):
    print(f"\n=== {title} ===")
    for r in rows:
        relevance = r.get("relevance")
        relevance_str = "-" if relevance is None else f"{relevance:.2f}"
        print(f"{r['profile']:<38} score={str(r['score']):>6}  conf={str(r['confidence']):<5} "
              f"rel={relevance_str:<5} {r['sub_scores']}")


if __name__ == "__main__":
    scholar_rows = run_scholar_eval()
    linkedin_rows = run_linkedin_eval()

    _print_table("Semantic Scholar synthetic eval", scholar_rows)
    _print_table("LinkedIn synthetic eval", linkedin_rows)

    # --- sanity checks: does the ranking match what a human reviewer would expect? ---
    by_label = {r["profile"]: r for r in scholar_rows}
    checks = [
        ("Active star researcher outranks dormant-but-prolific",
         by_label["A_star_researcher_active_relevant"]["score"] > by_label["D_dormant_once_prolific"]["score"]),
        ("Thin-but-relevant match is trusted more than a prolific irrelevant-field name collision "
         "(score reflects quality only; confidence is what should reward topical relevance)",
         by_label["C_early_academic_but_relevant_and_recent"]["confidence"] > by_label["E_name_collision_irrelevant_field"]["confidence"]),
        ("Name collision has lower confidence than a topically relevant match",
         by_label["E_name_collision_irrelevant_field"]["confidence"] < by_label["A_star_researcher_active_relevant"]["confidence"]),
        ("No-match-found returns None score, not a fabricated number",
         by_label["G_no_match_found"]["score"] is None),
    ]

    li_by_label = {r["profile"]: r for r in linkedin_rows}
    checks += [
        ("Serial founder with real engagement outranks vague no-signal text",
         li_by_label["A_serial_founder_ai_active"]["score"] > li_by_label["E_vague_no_dates_no_signal"]["score"]),
        ("Job-hopper (short stable tenures, no engagement) scores below solid operator",
         li_by_label["D_job_hopper_no_engagement"]["score"] < li_by_label["B_solid_operator_stable_tenure"]["score"]),
        ("No text provided returns None score",
         li_by_label["G_no_text_provided"]["score"] is None),
    ]

    print("\n=== Sanity checks ===")
    all_pass = True
    for desc, ok in checks:
        print(f"[{'PASS' if ok else 'FAIL'}] {desc}")
        all_pass = all_pass and ok

    print(f"\n{'ALL CHECKS PASSED' if all_pass else 'SOME CHECKS FAILED'}")
