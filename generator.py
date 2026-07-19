"""
VC Brain synthetic dataset v2.

FIXES vs v1:
  1. Axis scores are now DERIVED from the underlying claims (strength x trust),
     not drawn at random. v1's scores had no relationship to its own claims table.
  2. Trend is now computed by recomputing each axis using only claims observed
     before each snapshot date. v1 asserted a drift constant.
  3. contradicts_claim_id now points to a real sibling claim on the same
     founder+component. v1 pointed at random IDs that often did not exist.

ADDS (from the JHU/JHTV VSP rubric):
  - All 18 VSP subcriteria mapped onto the three axes plus a diligence block.
  - Operations block (cap table, runway, burn, IP strategy) that feeds memo GAPS,
    not axis scores, per the brief's "flag it, don't fabricate it" rule.
  - Market-sizing method flag: bottom_up_derived vs asserted_pct_of_tam, the
    "1% assumption" test lifted from the VSP pizza-shop workbook.
"""

import random, os, datetime as dt
import pandas as pd

random.seed(7)
TODAY = dt.date(2026, 7, 18)
def d(n): return TODAY - dt.timedelta(days=n)
def s(x): return x.isoformat()

SECTORS = ["AI infra","Fintech","Healthtech","Climate","Devtools","Vertical SaaS","Robotics","Bio"]
GEOS = ["Berlin","London","Bangalore","NYC","SF","Toronto","Lagos","Singapore","Warsaw","Nairobi"]
STAGES = ["Idea","Prototype","Pre-seed","Seed"]

SRC_SOCIAL = [("X/Twitter",3),("LinkedIn post",2),("GitHub",2),("Product Hunt",2),("Show HN",2),("Personal blog",2)]
SRC_NONSOCIAL = [("Company registry filing",1),("Patent filing",1),("University lab page",2),("arXiv paper",1),
                 ("Conference speaker bio",2),("Grant award record",1),("Employer team page",2),
                 ("Accelerator cohort directory",2),("Job posting authored",2)]
SRC_INTAKE = [("Platform intake: scenario interview",1),("Platform intake: work sample",1),
              ("Platform intake: reference check",1),("Platform intake: VSP-style prompt response",1)]

# component -> (axis, vsp_code, weight_within_axis)
# Diligence components carry axis = "Diligence" and never enter an axis score.
COMPONENTS = {
    "Background & execution":      ("Founder", "-",   0.30),
    "Traits":                      ("Founder", "-",   0.20),
    "Team role clarity":           ("Founder", "T-2", 0.20),
    "Team communication":          ("Founder", "T-1", 0.15),
    "Feedback & iteration":        ("Founder", "T-3", 0.15),

    "Market maps":                 ("Market & traction", "M-1", 0.20),
    "Market sizing (TAM/SAM/SOM)": ("Market & traction", "M-2", 0.25),
    "Value proposition":           ("Market & traction", "M-3", 0.15),
    "Traction & KPIs":             ("Market & traction", "P-1", 0.25),
    "Customer acquisition":        ("Market & traction", "B-2", 0.15),

    "USP / secret sauce":          ("Idea-vs-market", "V-3", 0.25),
    "Competitive advantage":       ("Idea-vs-market", "B-3", 0.20),
    "Technical feasibility":       ("Idea-vs-market", "P-2", 0.20),
    "Development roadmap":         ("Idea-vs-market", "P-3", 0.15),
    "Revenue model":               ("Idea-vs-market", "B-1", 0.10),
    "Mission & long-term vision":  ("Idea-vs-market", "V-1/V-2", 0.10),

    "Company formation & cap table": ("Diligence", "O-1", 0.0),
    "IP & regulation strategy":      ("Diligence", "O-2", 0.0),
    "Finances & runway":             ("Diligence", "O-3", 0.0),
}

# (template, unit, strength_low_value, strength_high_value)  |  qualitative: (text, "qual", strength)
TEMPLATES = {
 "Background & execution": [("Shipped {n} public projects prior to founding","count",0,15),
                            ("{n} years domain experience in {sector}","years",0,14),
                            ("Led engineering for a team of {n}","count",1,30)],
 "Traits": [("Documented fix shipped {n} days after critical user feedback","days_inv",1,90),
            ("Reversed a stated position after customer evidence, {n} documented instances","count",0,5),
            ("Reference describes founder as specific about failure modes","qual",78)],
 "Team role clarity": [("{n} cofounders with non-overlapping functional coverage","count",1,4),
                       ("Written role split covering {n} of 4 core functions","count",1,4),
                       ("Single founder, no technical cofounder identified","qual",32)],
 "Team communication": [("Team publishes a written weekly update, {n} consecutive weeks","count",0,40),
                        ("Decision log maintained with {n} entries","count",0,60),
                        ("No shared written record of decisions found","qual",30)],
 "Feedback & iteration": [("Shipped {n} product iterations following user testing","count",0,20),
                          ("Roadmap changed {n} times citing named customer input","count",0,8),
                          ("No evidence of iteration following feedback","qual",28)],
 "Market maps": [("Names {n} direct competitors with stated differentiation","count",0,10),
                 ("Maps {n} adjacent players and potential partners","count",0,12),
                 ("No named competitor set provided","qual",25)],
 "Market sizing (TAM/SAM/SOM)": [("Bottom-up SOM of ${n}M derived from a stated unit chain","usd_m_bu",1,60),
                                 ("SOM asserted as a flat share of TAM, no derivation","qual",22),
                                 ("SAM narrowed by a stated serviceable constraint, ${n}M","usd_m_bu",1,80)],
 "Value proposition": [("Value prop canvas links {n} customer pains to named features","count",0,10),
                       ("{n} customer personas documented with motivations","count",0,5),
                       ("Value prop stated in feature language only, no customer job named","qual",30)],
 "Traction & KPIs": [("{n} paying customers","count",0,40),
                     ("ARR of ${n}K","usd_k",0,400),
                     ("{n} design partners in signed pilot","count",0,10),
                     ("Waitlist of {n} signups, no conversion data","qual",38)],
 "Customer acquisition": [("Acquisition funnel documented across {n} stages with conversion rates","count",0,6),
                          ("CAC measured at ${n} across a real channel test","usd_inv",50,3000),
                          ("No acquisition process defined","qual",26)],
 "USP / secret sauce": [("Proprietary dataset of {n}K labeled records","count_k",0,300),
                        ("Patent application filed, {n} claims","count",0,25),
                        ("Wrapper over a single third-party model, no proprietary layer","qual",24)],
 "Competitive advantage": [("Win/loss reasons documented across {n} deals","count",0,20),
                           ("Switching cost identified and evidenced in {n} accounts","count",0,10),
                           ("Differentiation asserted but not evidenced","qual",30)],
 "Technical feasibility": [("Working prototype demonstrated, {n} core functions","count",1,8),
                           ("Benchmark published against {n} baselines","count",0,6),
                           ("Core technical risk unaddressed in materials","qual",27)],
 "Development roadmap": [("Roadmap published with {n} dated milestones","count",0,12),
                         ("{n} of last quarter's milestones delivered on time","count",0,6),
                         ("No roadmap or milestone dates provided","qual",25)],
 "Revenue model": [("{n} distinct revenue streams identified with pricing logic","count",1,4),
                   ("Pricing tested across {n} customer segments","count",0,5),
                   ("Revenue model not articulated","qual",26)],
 "Mission & long-term vision": [("Mission statement names a specific beneficiary and outcome","qual",74),
                                ("Vision articulates {n} future verticals with entry logic","count",0,4),
                                ("Vision stated as market-size ambition only","qual",32)],
 "Company formation & cap table": [("Entity incorporated, registry record on file","qual",80),
                                   ("Cap table: not disclosed","qual",None),
                                   ("Entity not yet formed","qual",None)],
 "IP & regulation strategy": [("Regulatory pathway identified with a stated timeline","qual",78),
                              ("IP strategy: not disclosed","qual",None),
                              ("Operates in a regulated category with no stated pathway","qual",None)],
 "Finances & runway": [("Runway of {n} months at current burn","count",0,24),
                       ("Financials: not disclosed","qual",None),
                       ("Monthly burn stated at ${n}K, unaudited","usd_k",1,80)],
}

FIRST = ["A.","B.","C.","D.","E.","F.","G.","H.","J.","K.","L.","M.","N.","P.","R.","S.","T.","V."]
LAST = ["Okafor","Lindqvist","Rao","Mbeki","Nowak","Ferreira","Haddad","Choi","Duarte","Iyer","Kowalczyk",
        "Adeyemi","Novak","Serrano","Tanaka","Bergman","Rahimi","Osei","Vargas","Petrov"]
CO_A = ["Ledger","Umbra","Kestrel","Tessell","Northwind","Basalt","Vireo","Quanta","Arbor","Sift","Halide",
        "Corvid","Meridian","Pallas","Lumen","Torus","Osprey","Verity","Cinder","Fathom"]
CO_B = ["Labs","Systems","AI","Works","Dynamics","Bio","Grid","Compute","Health","Stack"]


def strength_of(unit, val, lo, hi):
    """Map a claim's substance to 0-100. Separate from trust, which is about evidence."""
    if val is None:
        return 50
    if unit in ("days_inv", "usd_inv"):          # lower is better
        val = max(lo, min(hi, val))
        return round(100 * (hi - val) / (hi - lo))
    val = max(lo, min(hi, val))
    return round(15 + 80 * (val - lo) / (hi - lo)) if hi > lo else 50


founders, companies, links, signals, claims = [], [], [], [], []
axis_scores, founder_scores, decisions, memo_gaps = [], [], [], []
sid = lid = 0
N = 60

for i in range(1, N + 1):
    fid, coid = f"F{i:03d}", f"C{i:03d}"
    presence = "no_social" if random.random() < 0.40 else "social_present"
    first_time = random.random() < 0.55
    sector, geo, stage = random.choice(SECTORS), random.choice(GEOS), random.choice(STAGES)
    quality = random.random()   # latent venture quality, drives claim values

    founders.append(dict(founder_id=fid, display_name=f"{random.choice(FIRST)} {random.choice(LAST)}",
        presence_type=presence, first_time_founder=first_time, geo=geo, primary_sector=sector,
        first_observed_at=s(d(random.randint(120, 900))),
        entered_via=random.choice(["outbound_scan","inbound_application"])))
    companies.append(dict(company_id=coid, company_name=f"{random.choice(CO_A)} {random.choice(CO_B)}",
        founder_id=fid, sector=sector, geo=geo, stage=stage,
        founded_at=s(d(random.randint(60, 800))), prior_vc_backing=random.random() < 0.18))

    pool = (SRC_SOCIAL + SRC_NONSOCIAL) if presence == "social_present" else SRC_NONSOCIAL
    for src, tier in random.sample(pool, min(random.randint(3, 6) if presence == "social_present"
                                             else random.randint(1, 3), len(pool))):
        lid += 1
        links.append(dict(link_id=f"L{lid:04d}", founder_id=fid, platform=src, source_tier=tier,
            match_method=random.choice(["exact_email","name+employer","name+geo+sector","self_declared"]),
            match_confidence=round(random.uniform(0.55, 0.99), 2)))

    fclaims = []
    for comp, (axis, vsp, w) in COMPONENTS.items():
        p_obs = 0.90 if presence == "social_present" else 0.58
        rescue = presence == "no_social" and random.random() < 0.55
        if axis == "Diligence":
            p_obs = 0.75    # diligence items are often simply not disclosed
        if random.random() > p_obs and not rescue:
            fclaims.append(dict(claim_id=f"CL{len(claims)+len(fclaims)+1:05d}", founder_id=fid, company_id=coid,
                axis=axis, component=comp, vsp_code=vsp, claim_text="No observation available",
                value_numeric=None, unit=None, strength_0_100=None, sizing_method=None,
                implied_share_pct=None, signal_id=None, source_name=None, source_tier=None,
                observed_at=None, evidence_state="unobserved", verification_count=0,
                contradicts_claim_id=None, trust_score=None))
            continue

        t = random.choice(TEMPLATES[comp])
        sizing_method = implied_share = None
        if t[1] == "qual":
            text, val, unit = t[0], None, "qualitative"
            strength = t[2]
            if strength is None:                       # explicit non-disclosure
                fclaims.append(dict(claim_id=f"CL{len(claims)+len(fclaims)+1:05d}", founder_id=fid,
                    company_id=coid, axis=axis, component=comp, vsp_code=vsp, claim_text=text,
                    value_numeric=None, unit="qualitative", strength_0_100=None, sizing_method=None,
                    implied_share_pct=None, signal_id=None, source_name="Founder disclosure",
                    source_tier=1, observed_at=s(d(random.randint(1, 60))), evidence_state="gap_flagged",
                    verification_count=0, contradicts_claim_id=None, trust_score=None))
                continue
            if comp == "Market sizing (TAM/SAM/SOM)":  # the VSP "1% assumption" red flag
                sizing_method = "asserted_pct_of_tam"
                implied_share = round(random.choice([1.0, 1.0, 0.5, 2.0]), 2)
        else:
            tmpl, unit, lo, hi = t
            span = hi - lo
            val = round(lo + span * min(1.0, max(0.0, random.gauss(quality, 0.22))))
            if unit in ("days_inv", "usd_inv"):
                val = round(hi - span * min(1.0, max(0.0, random.gauss(quality, 0.22))))
            text = tmpl.format(n=val, sector=sector)
            strength = strength_of(unit, val, lo, hi)
            if unit == "usd_m_bu":
                sizing_method = "bottom_up_derived"
                implied_share = round(random.uniform(0.001, 0.08), 4)

        if rescue:
            src, tier = random.choice(SRC_INTAKE)
        else:
            src, tier = random.choice(pool)
        sid += 1
        sig = f"S{sid:05d}"
        obs = d(random.randint(1, 400))
        signals.append(dict(signal_id=sig, founder_id=fid, company_id=coid, source_name=src,
            source_tier=tier, observed_at=s(obs), component=comp,
            url=f"https://example-source.invalid/{fid.lower()}/{sig.lower()}", raw_excerpt=text))

        ver = random.choices([0,1,2,3], weights=[32,31,26,11])[0]
        contradicted = random.random() < 0.11
        if contradicted:
            state, trust = "contradicted", random.randint(25, 55)
        elif ver >= 2:
            state, trust = "verified", random.randint(80, 97)
        elif ver == 1:
            state, trust = ("verified" if tier <= 2 else "self_asserted"), random.randint(62, 82)
        else:
            state, trust = "self_asserted", random.randint(45, 68)
        if tier == 1:
            trust = min(99, trust + 8)
        if sizing_method == "asserted_pct_of_tam":      # unsupported share claim is low trust by rule
            trust = min(trust, 45)
            state = "self_asserted" if state != "contradicted" else state

        fclaims.append(dict(claim_id=f"CL{len(claims)+len(fclaims)+1:05d}", founder_id=fid, company_id=coid,
            axis=axis, component=comp, vsp_code=vsp, claim_text=text, value_numeric=val, unit=unit,
            strength_0_100=strength, sizing_method=sizing_method, implied_share_pct=implied_share,
            signal_id=sig, source_name=src, source_tier=tier, observed_at=s(obs), evidence_state=state,
            verification_count=ver, contradicts_claim_id=None, trust_score=trust))

    # FIX: contradictions link to a real sibling claim on the same founder
    scored = [c for c in fclaims if c["evidence_state"] not in ("unobserved", "gap_flagged")]
    for c in [x for x in fclaims if x["evidence_state"] == "contradicted"]:
        sibs = [x for x in scored if x["claim_id"] != c["claim_id"]]
        if sibs:
            c["contradicts_claim_id"] = random.choice(sibs)["claim_id"]
    claims.extend(fclaims)

    # FIX: axis scores derived from the claims, recomputed at each snapshot date
    TRUST_FACTOR = {"verified": 1.0, "self_asserted": 0.80, "contradicted": 0.35}
    def score_axis(axis, asof):
        num = den = 0.0
        obs_n = tot_n = 0
        for c in fclaims:
            if c["axis"] != axis:
                continue
            tot_n += 1
            if c["evidence_state"] in ("unobserved", "gap_flagged") or not c["observed_at"]:
                continue
            if dt.date.fromisoformat(c["observed_at"]) > asof:
                continue      # not yet known at this snapshot
            obs_n += 1
            w = COMPONENTS[c["component"]][2]
            # trust DISCOUNTS substance, it does not multiply it away:
            # a fully verified claim keeps its strength, an unverified one keeps ~55%.
            conf = TRUST_FACTOR[c["evidence_state"]] * (c["trust_score"] / 100)
            q = c["strength_0_100"] * (0.55 + 0.45 * conf)
            num += w * q
            den += w
        if den == 0:
            return None, round(100 * obs_n / max(1, tot_n))
        return round(num / den), round(100 * obs_n / max(1, tot_n))

    for axis in ["Founder", "Market & traction", "Idea-vs-market"]:
        hist = []
        for k, days_ago in enumerate([120, 60, 0]):
            sc, cov = score_axis(axis, d(days_ago))
            hist.append(sc)
            trend = "insufficient_history"
            if days_ago == 0 and hist[0] is not None and sc is not None:
                delta = sc - hist[0]
                trend = "improving" if delta > 4 else ("declining" if delta < -4 else "stable")
            axis_scores.append(dict(founder_id=fid, company_id=coid, axis=axis, score_0_100=sc,
                coverage_pct=cov, trend=(trend if days_ago == 0 else "n/a"),
                computed_at=s(d(days_ago)), snapshot_seq=k+1))

    # persistent Founder Score, derived from founder-axis evidence + history
    fa = [a for a in axis_scores if a["founder_id"] == fid and a["axis"] == "Founder" and a["snapshot_seq"] == 3][0]
    prior = random.choices([0,1,2], weights=[60,30,10])[0]
    shipped = sum(1 for c in fclaims if c["component"] == "Background & execution"
                  and c["value_numeric"] is not None)
    base = fa["score_0_100"] if fa["score_0_100"] is not None else 45
    founder_scores.append(dict(founder_id=fid, founder_score=min(99, round(base * 0.75 + prior * 9 + shipped * 3)),
        derived_from="0.75 x current Founder axis + 9/prior venture + 3/shipped artifact",
        prior_ventures=prior,
        evidence_completeness_pct=round(100 * len([c for c in fclaims
            if c["evidence_state"] not in ("unobserved",)]) / len(fclaims)),
        last_updated_at=s(d(random.randint(0, 30))),
        note="Keyed to the person. Persists across ventures, never resets. One input into the Founder axis."))

    # memo gaps, explicitly flagged rather than fabricated
    for c in fclaims:
        if c["evidence_state"] in ("unobserved", "gap_flagged"):
            memo_gaps.append(dict(company_id=coid, founder_id=fid, component=c["component"],
                vsp_code=c["vsp_code"],
                gap_type=("not_disclosed" if c["evidence_state"] == "gap_flagged" else "no_observation"),
                memo_line=(c["claim_text"] if c["evidence_state"] == "gap_flagged"
                           else f"{c['component']}: no evidence located at time of drafting")))

    latest = {a: [x for x in axis_scores if x["founder_id"] == fid and x["axis"] == a
                  and x["snapshot_seq"] == 3][0] for a in ["Founder","Market & traction","Idea-vs-market"]}
    strong = sum(1 for a in latest if (latest[a]["score_0_100"] or 0) >= 60)
    contra = len([c for c in fclaims if c["evidence_state"] == "contradicted"])
    low_cov = any((latest[a]["coverage_pct"] or 0) < 40 for a in latest)
    if contra >= 4: rec = "Hold - resolve contradictions"
    elif low_cov:   rec = "Hold - insufficient coverage"
    elif strong == 3: rec = "Invest $100K"
    elif strong == 2: rec = "Invest $100K (conditional)"
    elif strong == 1: rec = "Track"
    else: rec = "Pass"
    cap = random.choice([4,5,6,8,10])
    decisions.append(dict(company_id=coid, founder_id=fid, recommendation=rec,
        founder_axis=latest["Founder"]["score_0_100"],
        founder_axis_trend=latest["Founder"]["trend"],
        market_axis=latest["Market & traction"]["score_0_100"],
        market_axis_trend=latest["Market & traction"]["trend"],
        idea_axis=latest["Idea-vs-market"]["score_0_100"],
        idea_axis_trend=latest["Idea-vs-market"]["trend"],
        min_coverage_pct=min(latest[a]["coverage_pct"] for a in latest),
        open_contradictions=contra,
        market_sizing_method=next((c["sizing_method"] for c in fclaims
            if c["component"] == "Market sizing (TAM/SAM/SOM)" and c["sizing_method"]), "unobserved"),
        instrument="Post-money SAFE", check_size_usd=100000, valuation_cap_usd_m=cap,
        implied_ownership_pct=round(0.1 / cap * 100, 2),
        flagged_gap_count=len([c for c in fclaims if c["evidence_state"] in ("unobserved","gap_flagged")]),
        decided_at=s(d(random.randint(0, 20)))))

tables = {"founders": pd.DataFrame(founders), "companies": pd.DataFrame(companies),
          "identity_links": pd.DataFrame(links), "signal_events": pd.DataFrame(signals),
          "claims": pd.DataFrame(claims), "axis_scores": pd.DataFrame(axis_scores),
          "founder_scores": pd.DataFrame(founder_scores), "memo_gaps": pd.DataFrame(memo_gaps),
          "decisions": pd.DataFrame(decisions),
          "component_map": pd.DataFrame([{"component": k, "axis": v[0], "vsp_code": v[1],
                                          "weight_within_axis": v[2]} for k, v in COMPONENTS.items()])}

out = "/mnt/user-data/outputs/vc_brain_dataset_v2"
os.makedirs(out, exist_ok=True)
for n, df in tables.items():
    df.to_csv(f"{out}/{n}.csv", index=False)
    print(f"{n:18s} {df.shape}")
with pd.ExcelWriter("/mnt/user-data/outputs/vc_brain_dataset_v2.xlsx", engine="openpyxl") as xl:
    for n, df in tables.items():
        df.to_excel(xl, sheet_name=n[:31], index=False)

# validation
c, a, dec = tables["claims"], tables["axis_scores"], tables["decisions"]
print("\nevidence_state:\n", c.evidence_state.value_counts().to_string())
m = c.merge(tables["founders"][["founder_id","presence_type"]], on="founder_id")
print("\ncoverage % by presence:\n", m.groupby("presence_type").evidence_state
      .apply(lambda x: round(100*(~x.isin(["unobserved"])).mean(),1)).to_string())
print("\ncontradiction targets resolve:",
      c[c.contradicts_claim_id.notna()].contradicts_claim_id.isin(c.claim_id).all())
print("axis score range:", a.score_0_100.min(), "-", a.score_0_100.max())
print("\ntrend mix:\n", a[a.snapshot_seq==3].trend.value_counts().to_string())
print("\nrecommendations:\n", dec.recommendation.value_counts().to_string())
print("\nmarket sizing method:\n", dec.market_sizing_method.value_counts().to_string())
