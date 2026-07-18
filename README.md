# VC Brain

Hack-Nation × Maschmeyer Group challenge: an operating system for a single investor to
source, screen, diligence, and decide on founders — deploying $100K checks within 24 hours.

Primary surface: the **investor dashboard** (thesis config, ranked/scored applications,
natural-language query, cited memos). Founders get a minimal intake form only.

## Pipeline

```
Sourcing (inbound + outbound) -> Screening (3-axis, never averaged) -> Diligence (trust-gap check) -> Decision (memo + score)
```

Layered underneath:
- **Memory** — founders, companies, applications, signals (raw evidence), never discards, houses the persistent Founder Score.
- **Intelligence** — Thesis Engine (configurable investor lens), 3-axis scoring, Trust Score per claim, Multi-Attribute Reasoning (NL query).
- **Experience** — investor dashboard (primary), founder intake form (minimal).

## Repo layout

```
backend/
  db/            # SQLAlchemy models + session setup
  ingestion/     # github.py, semanticscholar.py, linkedin.py (self-paste, no scraping)
  scoring/       # deep_tech.py (gate), founder_score.py (45/25/15/15 aggregator)
  api/           # FastAPI routers: sourcing, screening, decision + pipeline glue
  main.py        # FastAPI app — serves the API and the frontend from one process
frontend/
  index.html     # investor dashboard (single-file, no build step)
data/
  cache/         # pulled real-data snapshots (future)
  synthetic/     # seeded cold-start founder profiles (future)
```

## Running it locally

This needs to run on a machine with normal internet access — some sandboxed dev
environments block direct calls to `api.github.com`/`api.semanticscholar.org`, in which
case sourcing will silently return zero candidates rather than crash.

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Then open **http://127.0.0.1:8000** — the dashboard is served from the same origin as
the API, so there's no separate frontend step and no CORS config needed.

Optional environment variables:
- `GITHUB_TOKEN` — raises the GitHub API rate limit from 60/hr to 5000/hr. Recommended
  before a live demo (multiple sourcing scans will burn through 60 fast).
- `ANTHROPIC_API_KEY` — enables real LLM-based ranking (Screening tab) and full memo
  drafting (Decision tab, including the Business Model Canvas). Without it, both
  features still work through a deterministic fallback (keyword+score ranking; a memo
  with all required Appendix-1 sections but generative sections explicitly marked
  unavailable rather than faked).

In the dashboard: **Sourcing → "Scan GitHub across all sectors"** runs the real
pipeline (GitHub API → deep-tech gate → Semantic Scholar if applicable → Founder Score
aggregation → persisted to SQLite) and renders each candidate's Founder Score, its
GitHub/Scholar breakdown, and evidence citing the exact repo/profile URL behind each
claim. Re-running the scan on the same founder updates their persistent score rather
than overwriting it from scratch — refresh the page and candidates reload from the
database instead of disappearing.

## Status

Founder Score pipeline is live end-to-end: GitHub ingestion, Semantic Scholar
(deep-tech gated), LinkedIn self-paste scoring, the 45/25/15/15 aggregator, and the
FastAPI + dashboard wiring. Product Hunt ingestion is stubbed (weight reserved,
`null`-safe) pending a developer token. Market and Idea-vs-Market axes are placeholders
— not yet real scoring engines.
