"""
Component -> axis -> VSP code -> weight-within-axis map.

Copied exactly from the team's `component_map.csv` (part of their VSP-rubric-based
synthetic evaluation dataset), so our axis_engine reproduces the same aggregation their
generator.py uses — this is what makes it possible to validate our scoring code against
their ground-truth axis_scores.csv rather than just trusting it looks reasonable.

Diligence components (cap table, IP/regulation, finances/runway) deliberately carry
weight 0.0 — per the brief, this data should never be fabricated into a score. It feeds
memo gaps instead (see api/decision.py's gap-flagging), exactly as the brief requires
for cap tables and financials.
"""
from __future__ import annotations

# component_name -> (axis, vsp_code, weight_within_axis)
COMPONENT_MAP: dict[str, tuple[str, str, float]] = {
    "Background & execution": ("Founder", "-", 0.30),
    "Traits": ("Founder", "-", 0.20),
    "Team role clarity": ("Founder", "T-2", 0.20),
    "Team communication": ("Founder", "T-1", 0.15),
    "Feedback & iteration": ("Founder", "T-3", 0.15),

    "Market maps": ("Market & traction", "M-1", 0.20),
    "Market sizing (TAM/SAM/SOM)": ("Market & traction", "M-2", 0.25),
    "Value proposition": ("Market & traction", "M-3", 0.15),
    "Traction & KPIs": ("Market & traction", "P-1", 0.25),
    "Customer acquisition": ("Market & traction", "B-2", 0.15),

    "USP / secret sauce": ("Idea-vs-market", "V-3", 0.25),
    "Competitive advantage": ("Idea-vs-market", "B-3", 0.20),
    "Technical feasibility": ("Idea-vs-market", "P-2", 0.20),
    "Development roadmap": ("Idea-vs-market", "P-3", 0.15),
    "Revenue model": ("Idea-vs-market", "B-1", 0.10),
    "Mission & long-term vision": ("Idea-vs-market", "V-1/V-2", 0.10),

    "Company formation & cap table": ("Diligence", "O-1", 0.0),
    "IP & regulation strategy": ("Diligence", "O-2", 0.0),
    "Finances & runway": ("Diligence", "O-3", 0.0),
}

AXES = ["Founder", "Market & traction", "Idea-vs-market"]


def components_for_axis(axis: str) -> list[str]:
    return [c for c, (a, _, _) in COMPONENT_MAP.items() if a == axis]


def weight_of(component: str) -> float:
    return COMPONENT_MAP[component][2]


def axis_of(component: str) -> str:
    return COMPONENT_MAP[component][0]


def vsp_code_of(component: str) -> str:
    return COMPONENT_MAP[component][1]
