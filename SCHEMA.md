# VC Brain dataset v2 — schema and changelog

60 founders, 60 companies, 882 signal events, 1,140 claims, 540 timestamped axis
snapshots, 258 flagged memo gaps. All synthetic. Source URLs point to
`example-source.invalid`, a reserved non-resolving domain.

## What was WRONG in v1 and is now fixed

**1. Axis scores were random.** v1 drew `random.randint(35, 88)` and had no
relationship to its own claims table. A judge opening the file would have found
a founder with three verified strong claims scoring 38. Scores are now computed:

```
quality  = strength_0_100 x (0.55 + 0.45 x confidence)
confidence = evidence_state_factor x (trust_score / 100)
axis_score = weighted mean of quality across observed components in that axis
```

`strength` measures substance (how many customers, how much ARR). `trust`
measures evidence quality. They are separate fields and multiply only at the end.
Trust discounts substance rather than erasing it: a fully verified claim keeps
100% of its strength, an unverified one keeps about 55%.

**2. Trend was asserted, not computed.** v1 picked a drift constant. v2 recomputes
each axis three times using only claims whose `observed_at` precedes each snapshot
date, then labels the delta. `insufficient_history` appears where there was no
prior observation, which is honest rather than fabricated.

**3. Contradiction links were broken.** v1's `contradicts_claim_id` pointed at
random IDs, many of which did not exist. v2 links every contradicted claim to a
real sibling claim on the same founder. Validated: all references resolve.

## What was MISSING and is now added, from the VSP rubric

All 18 VSP subcriteria now appear, carried in the `vsp_code` column on every
claim. See `component_map.csv` for the full mapping.

- **Founder axis** now includes T-1 Communication, T-2 Role Clarity, T-3 Feedback
  and Iteration alongside background, execution, and traits.
- **Market and traction** now includes M-1 Market Maps, M-2 Sizing, M-3 Value
  Prop, B-2 Customer Acquisition.
- **Idea-vs-market** now includes P-2 Technical Feasibility, P-3 Roadmap, B-1
  Revenue Model, B-3 Competitive Advantage, V-1/V-2 Mission and Vision, V-3
  Secret Sauce.
- **Diligence block** (O-1 cap table, O-2 IP and regulation, O-3 finances and
  runway) is deliberately NOT scored into any axis. It feeds `memo_gaps.csv`.
  This follows the brief: do not fabricate financials, flag them explicitly.
  `evidence_state = gap_flagged` produces memo lines such as
  "Cap table: not disclosed".

## The 1% assumption test

Lifted from the VSP Baltimore pizza workbook. Every market sizing claim carries
`sizing_method`, either `bottom_up_derived` or `asserted_pct_of_tam`, plus
`implied_share_pct`. Any SOM asserted as a flat share of TAM is capped at trust
45 by rule. In this run: 38 bottom-up, 15 asserted, 7 unobserved.

Derived SOMs imply market shares between 0.1% and 8%. Asserted ones cluster at
exactly 1%, which is the tell.

## Files

| File | Rows | What it is |
|---|---|---|
| founders.csv | 60 | The person. `presence_type` is the cold-start flag |
| companies.csv | 60 | The opportunity |
| identity_links.csv | 206 | Entity resolution with match confidence |
| signal_events.csv | 882 | Raw observations, tiered and timestamped |
| claims.csv | 1,140 | One row per assertion, with strength and trust separate |
| axis_scores.csv | 540 | Three axes x three snapshots, never averaged |
| founder_scores.csv | 60 | Persistent, keyed to the person |
| memo_gaps.csv | 258 | Explicit gap lines for the memo |
| decisions.csv | 60 | Recommendation with all three axes shown separately |
| component_map.csv | 19 | Component to axis to VSP code, with weights |

## Decision rule

- 3 of 3 axes at or above 60 → Invest $100K
- 2 of 3 → Invest, conditional
- 1 of 3 → Track
- 0 of 3 → Pass
- 4 or more open contradictions → Hold, overrides everything
- Any axis below 40% coverage → Hold, insufficient coverage

This run: 2 invest, 8 conditional, 7 track, 38 pass, 5 hold.

## Honest caveats

- The 82.7% vs 86.8% coverage gap between cold-start and social-footprint
  founders is a **parameter**, not a finding. It comes from `p_obs` and the
  intake rescue rate set in the generator. Frame it as a modeling assumption.
- The invest rate here is about 17%. Real pre-seed funnels convert at low single
  digits. The dataset is tuned for demo legibility, not realism.
- `strength` scales were chosen by hand and are not calibrated against outcomes.
  Nothing here has been backtested.
