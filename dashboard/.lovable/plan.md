## VC Brain — Part 2: AI Intelligence Layer

Turn the current UI shell into a real AI-powered VC OS. Backend on **Lovable Cloud** (Supabase), intelligence on **Lovable AI Gateway** (default `openai/gpt-5.5`, `google/gemini-3.1-flash-lite` for cheap/high-volume, `google/gemini-embedding-001` for memory). No API keys in the frontend — everything routes through TanStack server functions.

### Phase 1 — Foundations (backend + auth)
1. Enable **Lovable Cloud** and provision `LOVABLE_API_KEY`.
2. Auth: Email/password + Google sign-in. Public `/auth` page, protect the whole app under `_authenticated/`.
3. Schema (migrations):
   - `profiles`, `user_roles` (with `has_role` fn) + RLS
   - `founders`, `companies`, `founder_handles` (github/scholar overrides)
   - `founder_memory` (category, source, content, confidence, timestamp, structured metadata, embedding `vector(1536)`)
   - `founder_scores` (component breakdown + reason + timestamp — historical)
   - `opportunity_scores` (founder / market / idea-vs-market, never averaged)
   - `claims`, `evidence` (source, url, verified, confidence)
   - `interviews`, `interview_turns` (q/a/timestamp/ai_notes)
   - `investment_memos` (sectioned JSON)
   - `activities`, `notifications`, `thesis_settings`
   - Full RLS: workspace-scoped via `user_roles`, service_role for edge writes.

### Phase 2 — Memory Engine (the spine)
- `updateFounderMemory` server fn: takes `{ founderId, source, rawContent, structured? }` → summarizes with Gemini Flash Lite, extracts facts, computes confidence, generates embedding, **appends** (never replaces).
- `searchFounderMemory` server fn: semantic + category filters via pgvector.
- Wire existing Memory tab to real DB (replace in-memory store); add "source ingestion" panel showing every update as an evidence event.

### Phase 3 — Research Agent (real ingestion → memory)
- Extend existing `enrichFounder` to **persist** results as memory entries + claims + evidence rows (GitHub → skill/signal memory + claims for stars/repos; Scholar → research memory + citation claims).
- Add `analyzeWebsite` (fetch + Gemini extract mission/pricing/team/product) and `analyzeNews` (web search + summarize) server fns.
- `analyzePitchDeck`: PDF upload to Cloud storage → `document--parse_document` pattern → Gemini extraction into structured sections → memory + claims.
- Each writes evidence with source URL, confidence, verification status.

### Phase 4 — Scoring engines
- `recomputeFounderScore(founderId)`: reads memory → GPT-5.5 structured output returns 10 components + weighted score + **reason string** ("Updated because…"). Writes history row.
- `recomputeOpportunityScore(founderId)`: three independent GPT-5.5 calls (Founder / Market / Idea-vs-Market), each with own evidence citations. Never averaged in UI.
- `screenAgainstThesis(founderId)`: reads `thesis_settings` + scores → explains fit or why-not-recommended.

### Phase 5 — Natural-language sourcing
- `interpretSearch(query)`: GPT-5.5 → structured filter JSON (`{ sectors, geo, stage, funding, keywords, minScore, … }`) → applied to `founders` query. Sourcing page's search bar becomes real.

### Phase 6 — Interview Agent
- `generateInterviewQuestions(founderId)`: reads memory + unresolved claims + score gaps → tailored questions (never generic).
- `analyzeInterviewTurn({ interviewId, question, answer })`: GPT-5.5 with reasoning → rubric scores (confidence/depth/coachability/comms/leadership/execution/vision), extracted facts, follow-ups → append to memory + `interview_turns`.
- `synthesizeInterview(interviewId)`: summary + score deltas + recommendation.
- Wire live session UI to real streaming; persist transcript.

### Phase 7 — Trust Score + Claims verification
- Every AI-generated claim carries `{source, evidence, confidence, verified}`. Trust Score = f(verified ratio, avg confidence, contradiction flags). Recomputed on memory update.

### Phase 8 — Investment Committee Agent
- `generateInvestmentMemo(founderId)`: GPT-5.5 reasoning → structured JSON (Exec Summary, Founder, Company, Market, Competition, Risks, Strengths, Weaknesses, Thesis Fit, Check Size, Recommendation, Confidence, Next Steps) — every section cites evidence rows. Persist + render in Memo tab with citation chips.

### Phase 9 — Dashboard insights + Notifications
- `generateDashboardInsights(userId)`: highest-scoring / most-improved / weakest pipeline / recommended interviews / trends — from real data.
- Notifications table + realtime subscribe: score changes, new research, interview completed, trust drops.

### Phase 10 — Polish
- Loading skeletons, error boundaries, pagination on Sourcing, lazy-loaded routes, cached queries (TanStack Query already in place), toasts on background jobs.

### Technical notes (for the record)
- All AI calls: TanStack `createServerFn` → AI SDK + `@ai-sdk/openai-compatible` Lovable Gateway provider. Never expose `LOVABLE_API_KEY`. Prompts stay on server.
- Structured outputs: `generateText` + `Output.object(zod)` with `structuredOutputs: true` on OpenAI models; keep schemas flat, limits in prompt.
- Embeddings: `google/gemini-embedding-001` (1536-dim) into pgvector `founder_memory.embedding`.
- Existing in-memory `src/features/founders/data.ts` becomes seed migration + typed DB access layer (`founders.functions.ts`).
- Migration + auth are prerequisites; everything else follows.

### Order I'll ship (in this sequence)
**Turn A:** Phase 1 + Phase 2 (Cloud on, schema, auth, Memory Engine wired to existing Memory tab).
**Turn B:** Phase 3 + Phase 4 (Research Agent persistence, Founder/Opportunity/Thesis scoring).
**Turn C:** Phase 5 + Phase 6 (NL search, Interview Agent end-to-end).
**Turn D:** Phase 7 + Phase 8 (Trust Score, Investment Memo).
**Turn E:** Phase 9 + Phase 10 (Insights, Notifications, polish).

I'll stop between turns for you to review, since each turn is a large slice.

---

**One thing I need you to confirm before I start Turn A:**
Enabling Lovable Cloud provisions a real Supabase backend and adds auth — after this the app will require sign-in. OK to proceed?