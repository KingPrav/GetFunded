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
  ingestion/     # outbound scanners: github, hackernews, arxiv (later)
  scoring/       # thesis engine, 3-axis scoring, cold-start handling (later)
  memo/          # memo builder (later)
  main.py        # FastAPI app
frontend/        # investor dashboard + founder intake form (later)
data/
  cache/         # pulled real-data snapshots
  synthetic/     # seeded cold-start founder profiles
```

## Status

Step 1: repo scaffold + core schema. Built incrementally, one piece at a time.
