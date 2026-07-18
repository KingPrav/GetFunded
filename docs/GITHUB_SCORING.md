# How the GitHub score is calculated

Reference for the team. Everything below matches `backend/ingestion/github.py`,
`backend/ingestion/claims.py`, and `backend/scoring/axis_engine.py` exactly — this
isn't a simplified description, it's what the code actually does.

## 1. What's pulled from GitHub

All via the official REST API, no scraping, no LLM involved in this stage:

- The user's public profile (`GET /users/{username}`) — followers, public repo count, display name.
- Up to 8 owned, non-fork repos, most-recently-pushed first (`GET /users/{username}/repos`).
- Weekly commit counts for the last 52 weeks, per repo (`GET /repos/{owner}/{repo}/stats/commit_activity`).
- Contributor count, per repo (`GET /repos/{owner}/{repo}/contributors`).

Every profile and repo pulled is saved as a `signals` row with its real URL — this is
what Agentic Traceability points back to later.

## 2. The four sub-metrics

Each is scored 0–10 independently, then combined by weight. All four are deliberately
capped (`min(10.0, ...)`) so no single sub-metric can be gamed into an outsized score.

| Sub-metric | Weight | Formula | Caps at |
|---|---|---|---|
| Commit frequency & consistency | 30% | `0.6 × frequency_score + 0.4 × consistency_score`, where `frequency_score = min(10, total_commits_52w / 50)` and `consistency_score = (active_weeks / 52) × 10` | 500+ commits across the year **and** at least one commit in every one of the 52 weeks |
| Repo topic relevance | 20% | Fraction of considered repos whose topics/language/description overlap the target sector's keywords, × 10 | Every repo overlaps the sector keywords |
| Star growth velocity | 25% | `min(10, (best_repo_stars_per_month / 5) × 10)` — takes the *best* repo, not an average, so one strong repo isn't diluted by an old backlog | 5+ stars/month sustained on the best-performing repo |
| Contributor patterns | 25% | `min(10, 4 + min(6, max(0, (avg_contributors - 1) × 3)))` — solo founders get a 4/10 floor, not zero; collaboration adds on top | 3+ average contributors across owned repos |

**Sector keywords** for topic relevance come from the company's declared sector (e.g.
"AI infrastructure" → `{"ai infrastructure"}`); if none is set, a generic fallback list
is used (`ai, ml, llm, data, infra, startup, saas, api, agent, robotics, fintech,
healthtech, biotech, ...`).

## 3. Combining into one GitHub score

```
overall = Σ (sub_metric_score × weight) / Σ (weight of sub-metrics that had real data)
```

If a sub-metric couldn't be computed (e.g. GitHub's commit-activity endpoint was still
computing and timed out after one retry), its weight is dropped and the remaining
weights are renormalized — never zero-filled. `confidence` is the fraction of total
weight backed by real data (1.0 = all four sub-metrics had data; lower if some are
missing; 0.1 flat if the profile exists but owns zero repos).

**Maximum possible: 10.0** internally (displayed as **100** on the dashboard's 0–100
scale), achieved only if all four sub-metrics simultaneously hit their caps above.

## 4. Known heuristic limitations (documented on purpose, not hidden)

- GitHub's API doesn't expose historical star counts, so "star growth velocity" is
  approximated as `current stars ÷ months since repo creation`. This rewards fast
  recent traction and will slightly undercount old repos that gained stars slowly.
- Unauthenticated API calls are capped at 60/hour, and this pipeline makes ~15+ calls
  per candidate (profile + up to 8 repos × 2 endpoints each). **Set a `GITHUB_TOKEN`
  environment variable** (no special scopes needed) before running a real scan — this
  raises the limit to 5,000/hour. Without it, most candidates in a multi-sector scan
  will silently fail to fetch and fall back to a generic low score.

## 5. How the GitHub score becomes claims (not a standalone number anymore)

This is the part that changed when we adopted the team's VSP-rubric model. GitHub no
longer contributes a flat "45% of the Founder Score." Instead, each sub-metric becomes
an individual **claim**, tagged to a specific rubric component:

| Claim | Component | `strength_0_100` | `value_numeric` | `evidence_state` | `trust_score` |
|---|---|---|---|---|---|
| Commit frequency/consistency | Background & execution | sub-metric × 10 | total commits (52w) | verified | 95 |
| Star growth velocity | Background & execution | sub-metric × 10 | best stars/month | verified | 95 |
| Topic relevance | Background & execution | sub-metric × 10 | *(none — qualifier, not a countable artifact)* | verified | 90 |
| Contributor patterns | Team role clarity | sub-metric × 10 | avg. contributors | verified | 85 |

`evidence_state = "verified"` and high `trust_score` because this is all API-sourced,
objective data — not self-reported. Compare to LinkedIn claims, which use
`evidence_state = "self_asserted"` and a lower trust_score (60–70), since that's
founder-pasted text, not verified.

Any Founder-axis component GitHub *doesn't* cover (Traits, Team communication,
Feedback & iteration) gets an explicit `"unobserved"` placeholder claim rather than
being silently skipped — this is what makes `coverage_pct` honest (a GitHub-only
founder currently covers 2 of 5 Founder components, ~57% coverage, not 100%).

## 6. Claims → Founder axis score

```
quality(claim)    = strength_0_100 × (0.55 + 0.45 × confidence)
confidence(claim)  = trust_factor(evidence_state) × (trust_score / 100)
                      trust_factor: verified=1.0, self_asserted=0.80, contradicted=0.35
Founder axis score = weighted mean of quality across all non-unobserved claims,
                      weight = the claim's component weight (Background & execution
                      0.30, Team role clarity 0.20, Traits 0.20, Team communication
                      0.15, Feedback & iteration 0.15)
```

This formula and the component weights are copied exactly from the team's
`component_map.csv` / `generator.py`, and validated **byte-exact against their
ground-truth dataset — 540/540 axis scores matched.**

## 7. Founder axis → persistent Founder Score

```
Founder Score = min(99, round(founder_axis × 0.75 + prior_ventures × 9 + shipped_artifacts × 3))
```

`shipped_artifacts` counts claims in "Background & execution" that carry a real
`value_numeric` — for a GitHub-only founder that's typically 2 (the commits claim and
the star-velocity claim). `prior_ventures` is a Founder-level field, currently
self-reported (defaults to 0 for GitHub-sourced founders, since there's no intake form
data for outbound-sourced candidates yet).

This formula was also validated exactly against the team's ground truth — **60/60
Founder Scores matched.**

## One thing worth flagging to the team

The dashboard card still shows a line like *"Founder Score weighting · GitHub 65 ·
LinkedIn 0 · Scholarly 0"*. Those numbers are each source's raw 0–100 composite score,
shown for reference — they are **not** literally "GitHub is weighted 65% of this
founder's score" anymore. The actual weighting now happens at the component level
(step 6 above), not the source level. Worth relabeling that line before a demo so
nobody reads it as the old per-source-weight model, which we retired.
