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
  ingestion/     # github.py, semanticscholar.py, linkedin.py (self-paste, no scraping),
                 # claims.py (translates each source into component-tagged claims),
                 # synthetic_profiles.py (demo-mode Scholar/LinkedIn fallback data)
  scoring/       # deep_tech.py (gate), component_map.py (VSP rubric weights),
                 # axis_engine.py (claims -> axis score, validated against ground truth),
                 # founder_score.py (axis -> persistent Founder Score)
  api/           # FastAPI routers: sourcing, screening, decision, founders (external
                 # dashboard integration) + pipeline glue
  eval/          # synthetic_scholar_linkedin.py — sanity-check harness for Scholar/
                 # LinkedIn scoring against hand-built archetype profiles
  main.py        # FastAPI app — serves the API and the frontend from one process
frontend/
  index.html     # original investor dashboard (single-file, no build step)
dashboard/       # investor dashboard v2 — plain-file copy of the team's Lovable-built
                 # React/TanStack dashboard (live repo: github.com/shaibahraiyan-hub/
                 # getfundedvc), included here as regular tracked files (not a git
                 # submodule) so a single clone of this repo is enough to run both.
                 # Has its own package.json/README-equivalent setup — see below.
docs/
  GITHUB_SCORING.md  # full writeup of the GitHub scoring methodology, for the team
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
pipeline (GitHub API → deep-tech gate → Semantic Scholar if applicable, else a
labeled synthetic fallback → LinkedIn, always a labeled synthetic fallback for
outbound candidates → claims → axis engine → Founder Score → persisted to SQLite) and
renders each candidate's Founder Score, its GitHub/LinkedIn/Scholarly breakdown, and
evidence citing the exact repo/profile URL (or "[DEMO DATA]" label, when synthetic)
behind each claim. Re-running the scan on the same founder updates their persistent
score rather than overwriting it from scratch — refresh the page and candidates
reload from the database instead of disappearing.

Set `VC_BRAIN_DEMO_MODE=0` to disable the synthetic Scholar/LinkedIn fallback and see
only real, verified signal.

### Running the second dashboard (`dashboard/`)

This is the team's newer, Lovable-built React dashboard (live/canonical repo:
[shaibahraiyan-hub/getfundedvc](https://github.com/shaibahraiyan-hub/getfundedvc)),
included here as a plain-file snapshot for one-clone runnability. It needs the
backend above running first, then in a separate terminal:

```bash
cd dashboard
npm install
npm run dev
```

It calls the backend server-side (no CORS needed) via `VC_BRAIN_API_URL`, which
defaults to `http://127.0.0.1:8000` — override it if the backend runs elsewhere.
Once both are running, its sidebar has a **Founder Score** item showing every real
scanned candidate in the same card format as the primary dashboard, plus a live
summary strip under the header.

## Status

Founder Score is live end-to-end on a real scoring pipeline, not a flat aggregator:
GitHub ingestion, Semantic Scholar (deep-tech gated, with a recency + topical-
relevance-based match confidence), LinkedIn self-paste scoring, all translated into
component-tagged claims and run through `scoring/axis_engine.py` — a two-level
weighted mean (claims aggregate to one score per rubric component first, then
components combine by their fixed weight) validated **540/540 exact** against the
team's ground-truth dataset. `scoring/founder_score.py` turns the Founder axis score
into the persistent, cross-application Founder Score.

Both dashboards are wired to the same live backend, including a synthetic Scholar/
LinkedIn fallback (clearly labeled, never presented as real evidence) so a demo scan
shows a complete 3-source score even when a real Scholar match isn't found.

Known gaps: Product Hunt ingestion is stubbed (weight reserved, `null`-safe) pending a
developer token. Market and Idea-vs-Market axes are still placeholders — not yet real
scoring engines.
