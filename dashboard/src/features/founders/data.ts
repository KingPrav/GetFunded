export type Recommendation = "Strong Invest" | "Invest" | "Track" | "Pass";
export type Stage = "Discovery" | "Screening" | "Diligence" | "Interview" | "Decision";

export interface Claim {
  id: string;
  claim: string;
  evidence: string[];
  source: string;
  confidence: number;
  date: string;
  verified: "Verified" | "Needs Verification" | "Unverified";
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: "Hackathon" | "Research" | "Founded" | "Funding" | "Interview" | "Memo" | "Press";
  title: string;
  description: string;
}

export interface Founder {
  id: string;
  name: string;
  initials: string;
  company: string;
  logo: string;
  role: string;
  location: string;
  country: string;
  industry: string;
  stage: Stage;
  website: string;
  email: string;
  linkedin: string;
  twitter: string;
  bio: string;
  // Optional: when set, the founder workspace page fetches this founder's real
  // Founder Score from the VC Brain backend (github.com/KingPrav/VC_Mind) instead of
  // using the founderScore mock value below. Unset for founders that were never
  // actually run through a real GitHub scan.
  githubHandle?: string;
  founderScore: number;
  opportunityScore: number;
  trustScore: number;
  recommendation: Recommendation;
  confidence: number;
  radar: {
    founder: number;
    market: number;
    execution: number;
    technical: number;
    communication: number;
    coachability: number;
    vision: number;
    fundraising: number;
  };
  research: {
    github: { summary: string; stars: number; repos: number; score: number };
    scholar: { summary: string; papers: number; citations: number; score: number };
    linkedin: { summary: string; score: number };
    productHunt: { summary: string; score: number };
    news: { summary: string; score: number };
    accelerator: string | null;
  };
  claims: Claim[];
  timeline: TimelineEvent[];
  screening: {
    founder: PanelEval;
    market: PanelEval;
    fit: PanelEval;
  };
}

export interface PanelEval {
  score: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  evidence: string[];
}

const mk = (f: Founder): Founder => f;

export const founders: Founder[] = [
  mk({
    id: "aria-chen",
    name: "Aria Chen",
    initials: "AC",
    company: "Vectorline AI",
    logo: "VL",
    role: "Co-founder & CEO",
    location: "San Francisco, CA",
    country: "United States",
    industry: "AI Infrastructure",
    stage: "Diligence",
    website: "vectorline.ai",
    email: "aria@vectorline.ai",
    linkedin: "linkedin.com/in/ariachen",
    twitter: "@ariachen",
    bio: "Former staff engineer at Anthropic. MIT PhD in distributed systems. Building the retrieval layer for enterprise agents.",
    founderScore: 92,
    opportunityScore: 88,
    trustScore: 96,
    recommendation: "Strong Invest",
    confidence: 91,
    radar: {
      founder: 92, market: 88, execution: 90, technical: 96,
      communication: 84, coachability: 82, vision: 90, fundraising: 78,
    },
    research: {
      github: { summary: "Owns 3 popular OSS projects on vector search; 8.4k stars aggregate.", stars: 8400, repos: 27, score: 94 },
      scholar: { summary: "4 first-author papers on retrieval-augmented generation, 1,200 citations.", papers: 4, citations: 1200, score: 91 },
      linkedin: { summary: "6 years at Anthropic + Google Brain. MIT PhD 2019.", score: 95 },
      productHunt: { summary: "Launched Vectorline OSS v0 — #2 Product of the Day.", score: 82 },
      news: { summary: "Featured in The Information's 2026 infra-to-watch list.", score: 80 },
      accelerator: "YC W24",
    },
    claims: [
      { id: "c1", claim: "MIT PhD in Distributed Systems (2019)", evidence: ["LinkedIn", "MIT dissertation registry", "Google Scholar"], source: "MIT Directory", confidence: 99, date: "2026-06-14", verified: "Verified" },
      { id: "c2", claim: "$1.4M ARR from 12 enterprise design partners", evidence: ["Founder-provided ARR schedule"], source: "Pitch Deck", confidence: 68, date: "2026-07-02", verified: "Needs Verification" },
      { id: "c3", claim: "Ex-Staff Engineer at Anthropic", evidence: ["LinkedIn", "Anthropic paper co-authorship"], source: "LinkedIn", confidence: 97, date: "2026-06-14", verified: "Verified" },
      { id: "c4", claim: "Vectorline OSS has 8.4k GitHub stars", evidence: ["GitHub public API"], source: "GitHub", confidence: 100, date: "2026-07-15", verified: "Verified" },
    ],
    timeline: [
      { id: "t1", date: "2014-09-01", type: "Hackathon", title: "MIT HackMIT — 1st place", description: "Built a distributed graph store in 36h." },
      { id: "t2", date: "2019-05-30", type: "Research", title: "MIT PhD conferred", description: "Thesis on scalable approximate nearest neighbor systems." },
      { id: "t3", date: "2020-01-06", type: "Founded", title: "Joined Anthropic (founding retrieval team)", description: "Staff engineer, retrieval infrastructure." },
      { id: "t4", date: "2024-01-08", type: "Founded", title: "Founded Vectorline AI", description: "Left Anthropic to build the retrieval layer for enterprise agents." },
      { id: "t5", date: "2024-03-15", type: "Funding", title: "YC W24 batch", description: "$500K standard deal + $375K MFN SAFE." },
      { id: "t6", date: "2026-07-02", type: "Interview", title: "Partner meeting — 45min", description: "Deep dive on GTM, expansion motion, hiring." },
    ],
    screening: {
      founder: { score: 92, confidence: 94, strengths: ["Rare technical depth in retrieval", "3rd-time technical lead", "Ships fast"], weaknesses: ["First-time CEO", "Limited GTM history"], evidence: ["MIT PhD", "Anthropic tenure", "8.4k GitHub stars"] },
      market: { score: 88, confidence: 82, strengths: ["$47B TAM by 2029 per Gartner", "Every enterprise agent needs retrieval"], weaknesses: ["Crowded with well-funded incumbents (Pinecone, Weaviate)"], evidence: ["Gartner AI infra 2026", "12 unsolicited inbound enterprise leads"] },
      fit: { score: 86, confidence: 88, strengths: ["Technical founder + technical problem", "Design partners already onboarding"], weaknesses: ["Positioning vs. hyperscaler bundles unclear"], evidence: ["12 signed design-partner LOIs", "Design partner NPS 71"] },
    },
  }),
  mk({
    id: "moritz-keller",
    name: "Moritz Keller",
    initials: "MK",
    company: "Kliniq Health",
    logo: "KH",
    role: "Founder & CEO",
    location: "Berlin, Germany",
    country: "Germany",
    industry: "Healthcare AI",
    stage: "Screening",
    website: "kliniq.health",
    email: "m@kliniq.health",
    linkedin: "linkedin.com/in/moritzkeller",
    twitter: "@moritzkeller",
    bio: "Physician-turned-founder. Building ambient documentation for European hospitals.",
    founderScore: 81,
    opportunityScore: 84,
    trustScore: 89,
    recommendation: "Invest",
    confidence: 78,
    radar: {
      founder: 81, market: 84, execution: 78, technical: 72,
      communication: 88, coachability: 90, vision: 82, fundraising: 70,
    },
    research: {
      github: { summary: "Limited public code; primarily contributes to internal repos.", stars: 120, repos: 6, score: 52 },
      scholar: { summary: "2 co-authored clinical NLP papers.", papers: 2, citations: 84, score: 68 },
      linkedin: { summary: "8 years clinical practice + 2 years at Doctolib product.", score: 88 },
      productHunt: { summary: "Not launched publicly.", score: 40 },
      news: { summary: "Coverage in Sifted's DACH healthtech roundup.", score: 66 },
      accelerator: "EF LD24",
    },
    claims: [
      { id: "c1", claim: "Licensed MD, Charité Berlin", evidence: ["German Medical Council registry"], source: "Bundesärztekammer", confidence: 99, date: "2026-05-11", verified: "Verified" },
      { id: "c2", claim: "€180K MRR run-rate", evidence: ["Founder-reported"], source: "Pitch Deck", confidence: 55, date: "2026-06-30", verified: "Needs Verification" },
    ],
    timeline: [
      { id: "t1", date: "2016-06-01", type: "Founded", title: "MD, Charité Berlin", description: "Residency in internal medicine." },
      { id: "t2", date: "2023-01-15", type: "Founded", title: "Founded Kliniq Health", description: "Ambient scribe for German hospitals." },
      { id: "t3", date: "2024-04-01", type: "Funding", title: "EF LD24 cohort", description: "€125k pre-seed." },
    ],
    screening: {
      founder: { score: 81, confidence: 84, strengths: ["Deep clinical credibility", "Physician-founder trust with buyers"], weaknesses: ["Non-technical", "First venture"], evidence: ["MD verified", "8 yrs clinical"] },
      market: { score: 84, confidence: 80, strengths: ["EU documentation burden growing", "Regulatory tailwinds (EU AI Act carve-outs)"], weaknesses: ["Fragmented EU procurement"], evidence: ["OECD 2026 clinician burnout study"] },
      fit: { score: 79, confidence: 76, strengths: ["Physician selling to physicians"], weaknesses: ["Long sales cycles", "Needs strong CTO co-founder"], evidence: ["3 hospital LOIs"] },
    },
  }),
  mk({
    id: "priya-nair",
    name: "Priya Nair",
    initials: "PN",
    company: "Ledgerloop",
    logo: "LL",
    role: "Co-founder & CTO",
    location: "Bengaluru, India",
    country: "India",
    industry: "Fintech Infrastructure",
    stage: "Interview",
    website: "ledgerloop.io",
    email: "priya@ledgerloop.io",
    linkedin: "linkedin.com/in/priyanair",
    twitter: "@priyanair",
    bio: "Ex-Stripe payments infra. Building programmable ledgers for Southeast Asian marketplaces.",
    founderScore: 89,
    opportunityScore: 82,
    trustScore: 93,
    recommendation: "Strong Invest",
    confidence: 86,
    radar: {
      founder: 89, market: 82, execution: 88, technical: 93,
      communication: 86, coachability: 84, vision: 84, fundraising: 82,
    },
    research: {
      github: { summary: "Maintainer of double-entry-rs (2.1k stars).", stars: 2100, repos: 14, score: 84 },
      scholar: { summary: "No academic publications.", papers: 0, citations: 0, score: 30 },
      linkedin: { summary: "5 yrs Stripe (Payments Infra), 2 yrs Razorpay.", score: 92 },
      productHunt: { summary: "Ledgerloop dev preview — #4 Product of the Day.", score: 78 },
      news: { summary: "Featured in TechCrunch Southeast Asia coverage.", score: 76 },
      accelerator: null,
    },
    claims: [
      { id: "c1", claim: "5 years at Stripe Payments Infrastructure", evidence: ["LinkedIn", "Stripe engineering blog author page"], source: "LinkedIn", confidence: 98, date: "2026-06-01", verified: "Verified" },
      { id: "c2", claim: "3 signed enterprise design partners in SEA", evidence: ["Design partner LOIs"], source: "Data room", confidence: 88, date: "2026-07-10", verified: "Verified" },
    ],
    timeline: [
      { id: "t1", date: "2018-08-01", type: "Founded", title: "Joined Stripe", description: "Payments infrastructure — ledgering." },
      { id: "t2", date: "2025-02-01", type: "Founded", title: "Founded Ledgerloop", description: "Programmable ledgers API." },
      { id: "t3", date: "2026-07-15", type: "Interview", title: "Partner interview scheduled", description: "60 min with Elena." },
    ],
    screening: {
      founder: { score: 89, confidence: 90, strengths: ["Exceptional infra background", "Domain-obsessed"], weaknesses: ["Solo technical founder"], evidence: ["Stripe tenure", "OSS traction"] },
      market: { score: 82, confidence: 78, strengths: ["SEA marketplace GMV compounding 34% YoY"], weaknesses: ["Ledger-as-a-service is a slow enterprise sale"], evidence: ["Bain SEA fintech report 2026"] },
      fit: { score: 84, confidence: 82, strengths: ["Sharp wedge into marketplaces"], weaknesses: ["Needs commercial co-founder"], evidence: ["3 design partners"] },
    },
  }),
  mk({
    id: "james-okafor",
    name: "James Okafor",
    initials: "JO",
    company: "Solstice Robotics",
    logo: "SR",
    role: "Founder & CEO",
    location: "London, UK",
    country: "United Kingdom",
    industry: "Robotics",
    stage: "Discovery",
    
    website: "solstice-robotics.com",
    email: "james@solstice-robotics.com",
    linkedin: "linkedin.com/in/jamesokafor",
    twitter: "@jokafor",
    bio: "Imperial ML PhD. Warehouse manipulation for mid-market 3PLs.",
    founderScore: 74,
    opportunityScore: 70,
    trustScore: 82,
    recommendation: "Track",
    confidence: 64,
    radar: {
      founder: 74, market: 70, execution: 68, technical: 90,
      communication: 72, coachability: 78, vision: 80, fundraising: 60,
    },
    research: {
      github: { summary: "Robotics simulation repos, modest traction.", stars: 340, repos: 11, score: 62 },
      scholar: { summary: "6 papers on grasping and manipulation.", papers: 6, citations: 210, score: 78 },
      linkedin: { summary: "Imperial College PhD, 3 yrs DeepMind robotics.", score: 84 },
      productHunt: { summary: "No launch yet.", score: 20 },
      news: { summary: "Minimal press coverage.", score: 38 },
      accelerator: null,
    },
    claims: [
      { id: "c1", claim: "Imperial College ML PhD (2022)", evidence: ["Imperial thesis registry"], source: "Imperial", confidence: 99, date: "2026-04-20", verified: "Verified" },
    ],
    timeline: [
      { id: "t1", date: "2022-11-01", type: "Research", title: "PhD conferred", description: "Manipulation under partial observability." },
      { id: "t2", date: "2026-01-10", type: "Founded", title: "Founded Solstice Robotics", description: "Bootstrapped." },
    ],
    screening: {
      founder: { score: 74, confidence: 72, strengths: ["Elite technical training"], weaknesses: ["No commercial experience", "Small team"], evidence: ["Imperial PhD"] },
      market: { score: 70, confidence: 66, strengths: ["Warehouse automation demand"], weaknesses: ["Capital-intensive, long payback"], evidence: ["MHI 2026 report"] },
      fit: { score: 66, confidence: 60, strengths: ["Novel manipulation approach"], weaknesses: ["No customer validation"], evidence: ["1 pilot conversation"] },
    },
  } as Founder),
  mk({
    id: "sara-mikhailov",
    name: "Sara Mikhailov",
    initials: "SM",
    company: "Coralstack",
    logo: "CS",
    role: "Founder",
    location: "Amsterdam, NL",
    country: "Netherlands",
    industry: "DevTools",
    stage: "Decision",
    website: "coralstack.dev",
    email: "sara@coralstack.dev",
    linkedin: "linkedin.com/in/saramikhailov",
    twitter: "@saramikhailov",
    bio: "Ex-Vercel. Open-source-first observability for edge functions.",
    founderScore: 87,
    opportunityScore: 79,
    trustScore: 91,
    recommendation: "Invest",
    confidence: 83,
    radar: {
      founder: 87, market: 79, execution: 84, technical: 89,
      communication: 82, coachability: 80, vision: 78, fundraising: 74,
    },
    research: {
      github: { summary: "Coralstack OSS — 5.2k stars, active contributor community.", stars: 5200, repos: 19, score: 88 },
      scholar: { summary: "No publications.", papers: 0, citations: 0, score: 20 },
      linkedin: { summary: "4 yrs Vercel platform team.", score: 86 },
      productHunt: { summary: "Product of the Week (June 2026).", score: 90 },
      news: { summary: "Hacker News front page x3 in 2026.", score: 82 },
      accelerator: null,
    },
    claims: [
      { id: "c1", claim: "5.2k GitHub stars in 6 months", evidence: ["GitHub API"], source: "GitHub", confidence: 100, date: "2026-07-01", verified: "Verified" },
      { id: "c2", claim: "$120K ARR from 40 self-serve customers", evidence: ["Stripe export"], source: "Data room", confidence: 92, date: "2026-07-05", verified: "Verified" },
    ],
    timeline: [
      { id: "t1", date: "2021-03-01", type: "Founded", title: "Joined Vercel", description: "Edge runtime platform." },
      { id: "t2", date: "2025-10-01", type: "Founded", title: "Founded Coralstack", description: "OSS observability for edge." },
      { id: "t3", date: "2026-06-15", type: "Press", title: "Product of the Week on Product Hunt", description: "" },
      { id: "t4", date: "2026-07-18", type: "Memo", title: "Investment memo drafted", description: "IC scheduled for July 24." },
    ],
    screening: {
      founder: { score: 87, confidence: 88, strengths: ["Deep platform experience", "OSS credibility"], weaknesses: ["Solo founder"], evidence: ["Vercel tenure", "OSS traction"] },
      market: { score: 79, confidence: 76, strengths: ["Edge is default for new apps"], weaknesses: ["Observability is contested"], evidence: ["State of Edge 2026"] },
      fit: { score: 82, confidence: 80, strengths: ["Bottoms-up motion working"], weaknesses: ["Monetization curve uncertain"], evidence: ["40 paying customers"] },
    },
  }),
  mk({
    id: "wei-tanaka",
    name: "Wei Tanaka",
    initials: "WT",
    company: "Meridian Bio",
    logo: "MB",
    role: "Co-founder & CSO",
    location: "Boston, MA",
    country: "United States",
    industry: "Bio × AI",
    stage: "Diligence",
    website: "meridian.bio",
    email: "wei@meridian.bio",
    linkedin: "linkedin.com/in/weitanaka",
    twitter: "@weitanaka",
    bio: "Broad Institute postdoc. ML for protein design.",
    founderScore: 85,
    opportunityScore: 86,
    trustScore: 90,
    recommendation: "Invest",
    confidence: 79,
    radar: {
      founder: 85, market: 86, execution: 76, technical: 94,
      communication: 78, coachability: 82, vision: 88, fundraising: 72,
    },
    research: {
      github: { summary: "Contributor to open protein-design toolkits.", stars: 900, repos: 8, score: 74 },
      scholar: { summary: "11 papers on generative protein models, 2,400 citations.", papers: 11, citations: 2400, score: 95 },
      linkedin: { summary: "Broad Institute postdoc, Stanford PhD.", score: 92 },
      productHunt: { summary: "N/A (deep tech).", score: 30 },
      news: { summary: "Endpoints News profile in April 2026.", score: 70 },
      accelerator: "Petri IndieBio 24",
    },
    claims: [
      { id: "c1", claim: "Stanford PhD in Computational Biology (2022)", evidence: ["Stanford dissertation"], source: "Stanford", confidence: 99, date: "2026-05-01", verified: "Verified" },
      { id: "c2", claim: "Two lead candidates in wet-lab validation", evidence: ["Lab notebook screenshots"], source: "Data room", confidence: 70, date: "2026-06-22", verified: "Needs Verification" },
    ],
    timeline: [
      { id: "t1", date: "2022-08-01", type: "Research", title: "Stanford PhD", description: "Generative protein design." },
      { id: "t2", date: "2025-06-01", type: "Founded", title: "Founded Meridian Bio", description: "Broad Institute spinout." },
    ],
    screening: {
      founder: { score: 85, confidence: 84, strengths: ["Publishing at frontier", "Wet-lab + ML dual competence"], weaknesses: ["First-time operator"], evidence: ["Stanford PhD", "11 top-venue papers"] },
      market: { score: 86, confidence: 82, strengths: ["Programmable biology tailwind"], weaknesses: ["Long, capital-intensive path to revenue"], evidence: ["BCG bio × AI report 2026"] },
      fit: { score: 82, confidence: 78, strengths: ["Differentiated technical wedge"], weaknesses: ["Regulatory + wet-lab risk"], evidence: ["2 preclinical candidates"] },
    },
  }),
];

export const kpis = {
  foundersTracked: 1284,
  newThisWeek: 47,
  interviewsCompleted: 132,
  memosReady: 9,
  avgFounderScore: 82,
  avgTrustScore: 88,
  pipelineHealth: 91,
  portfolioCapacity: 62,
};

export function foundersByStage(): Record<Stage, Founder[]> {
  const buckets: Record<Stage, Founder[]> = {
    Discovery: [], Screening: [], Diligence: [], Interview: [], Decision: [],
  };
  for (const f of founders) buckets[f.stage].push(f);
  return buckets;
}

export function getFounder(id: string) {
  return founders.find((f) => f.id === id);
}

// ================= Founder Memory =================
export type MemoryCategory =
  | "Background"
  | "Skill"
  | "Motivation"
  | "Risk"
  | "Network"
  | "Preference"
  | "Milestone"
  | "Signal";

export type MemorySource =
  | "Interview"
  | "Research"
  | "Evidence"
  | "Email"
  | "Manual"
  | "Memo"
  | "Meeting";

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  content: string;
  source: MemorySource;
  sourceRef?: string;
  confidence: number; // 0-100
  createdAt: string; // ISO
  pinned?: boolean;
}

const memoryStore: Record<string, MemoryEntry[]> = {
  "aria-chen": [
    { id: "m1", category: "Background", content: "MIT PhD in distributed systems; thesis on gradient sharding for LLM training clusters.", source: "Research", sourceRef: "Google Scholar", confidence: 98, createdAt: "2026-02-11T10:12:00Z", pinned: true },
    { id: "m2", category: "Skill", content: "Deep systems expertise — shipped Anthropic's internal retrieval pipeline (10B+ vectors, p99 <30ms).", source: "Interview", sourceRef: "Intro call · Feb 14", confidence: 94, createdAt: "2026-02-14T17:04:00Z", pinned: true },
    { id: "m3", category: "Motivation", content: "Left Anthropic because she wanted to own the retrieval layer end-to-end for enterprises.", source: "Interview", sourceRef: "Intro call · Feb 14", confidence: 88, createdAt: "2026-02-14T17:22:00Z" },
    { id: "m4", category: "Network", content: "Warm intros available to Dario Amodei and Jared Kaplan; co-founder was tech lead on Claude eval infra.", source: "Email", sourceRef: "aria@vectorline.ai · Feb 20", confidence: 82, createdAt: "2026-02-20T09:41:00Z" },
    { id: "m5", category: "Risk", content: "No prior founding experience — first-time CEO. Hiring GTM lead is the near-term unlock.", source: "Memo", sourceRef: "Draft memo v0.3", confidence: 76, createdAt: "2026-03-02T14:10:00Z" },
    { id: "m6", category: "Milestone", content: "Signed 3 design partners (Ramp, Notion, Rippling) at $80k ARR each in the last 6 weeks.", source: "Evidence", sourceRef: "DocuSign PDFs", confidence: 96, createdAt: "2026-03-08T11:00:00Z", pinned: true },
    { id: "m7", category: "Preference", content: "Prefers async decision-making; sends written updates every Friday.", source: "Meeting", sourceRef: "Weekly sync", confidence: 70, createdAt: "2026-03-12T16:30:00Z" },
    { id: "m8", category: "Signal", content: "Coachability score improved after founder feedback session — implemented pricing changes within 48h.", source: "Manual", sourceRef: "Partner note", confidence: 84, createdAt: "2026-03-15T09:15:00Z" },
  ],
};

const defaultMemory = (f: Founder): MemoryEntry[] => [
  { id: `${f.id}-m1`, category: "Background", content: `${f.bio}`, source: "Research", sourceRef: "LinkedIn", confidence: 90, createdAt: "2026-02-05T09:00:00Z", pinned: true },
  { id: `${f.id}-m2`, category: "Milestone", content: `Currently in ${f.stage.toLowerCase()} stage for ${f.company}.`, source: "Manual", sourceRef: "Pipeline", confidence: 100, createdAt: "2026-02-18T12:00:00Z" },
  { id: `${f.id}-m3`, category: "Signal", content: `Founder score ${f.founderScore} · trust ${f.trustScore}. Recommendation: ${f.recommendation}.`, source: "Memo", sourceRef: "Auto-eval", confidence: 88, createdAt: "2026-02-25T15:30:00Z" },
  { id: `${f.id}-m4`, category: "Skill", content: `Domain: ${f.industry}. Based in ${f.location}.`, source: "Research", sourceRef: "Web", confidence: 85, createdAt: "2026-03-01T10:00:00Z" },
  { id: `${f.id}-m5`, category: "Risk", content: `Verify go-to-market motion and moat vs incumbents in ${f.industry}.`, source: "Manual", sourceRef: "Partner note", confidence: 65, createdAt: "2026-03-06T14:00:00Z" },
];

export function getFounderMemory(id: string): MemoryEntry[] {
  const f = getFounder(id);
  if (!f) return [];
  return memoryStore[id] ?? defaultMemory(f);
}

export function addFounderMemory(id: string, entry: Omit<MemoryEntry, "id" | "createdAt">): MemoryEntry {
  const created: MemoryEntry = {
    ...entry,
    id: `${id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const existing = memoryStore[id] ?? (getFounder(id) ? defaultMemory(getFounder(id)!) : []);
  memoryStore[id] = [created, ...existing];
  return created;
}

