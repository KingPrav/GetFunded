
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Utility: updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Roles enum + user_roles + has_role
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'investor', 'analyst');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Profiles
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default investor role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'investor')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Founder Memory (the spine)
CREATE TABLE public.founder_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_key text NOT NULL,
  category text NOT NULL,
  source text NOT NULL,
  content text NOT NULL,
  summary text,
  confidence int NOT NULL DEFAULT 70 CHECK (confidence BETWEEN 0 AND 100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.founder_memory (user_id, founder_key, created_at DESC);
CREATE INDEX ON public.founder_memory USING hnsw (embedding vector_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.founder_memory TO authenticated;
GRANT ALL ON public.founder_memory TO service_role;
ALTER TABLE public.founder_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory" ON public.founder_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Founder Score history
CREATE TABLE public.founder_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_key text NOT NULL,
  total int NOT NULL CHECK (total BETWEEN 0 AND 100),
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.founder_scores (user_id, founder_key, created_at DESC);
GRANT SELECT, INSERT ON public.founder_scores TO authenticated;
GRANT ALL ON public.founder_scores TO service_role;
ALTER TABLE public.founder_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scores" ON public.founder_scores FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Opportunity Scores (3 independent panels)
CREATE TABLE public.opportunity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_key text NOT NULL,
  panel text NOT NULL CHECK (panel IN ('founder','market','fit')),
  score int NOT NULL CHECK (score BETWEEN 0 AND 100),
  confidence int NOT NULL DEFAULT 70 CHECK (confidence BETWEEN 0 AND 100),
  strengths text[] NOT NULL DEFAULT '{}',
  weaknesses text[] NOT NULL DEFAULT '{}',
  evidence text[] NOT NULL DEFAULT '{}',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.opportunity_scores (user_id, founder_key, panel, created_at DESC);
GRANT SELECT, INSERT ON public.opportunity_scores TO authenticated;
GRANT ALL ON public.opportunity_scores TO service_role;
ALTER TABLE public.opportunity_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own opportunity" ON public.opportunity_scores FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Claims + evidence
CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_key text NOT NULL,
  claim text NOT NULL,
  source text NOT NULL,
  source_url text,
  confidence int NOT NULL DEFAULT 70 CHECK (confidence BETWEEN 0 AND 100),
  verified text NOT NULL DEFAULT 'Unverified' CHECK (verified IN ('Verified','Needs Verification','Unverified','Contradicted')),
  evidence_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.claims (user_id, founder_key, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own claims" ON public.claims FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Interviews
CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_key text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','completed','archived')),
  scheduled_at timestamptz,
  summary text,
  recommendation text,
  score_deltas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.interviews (user_id, founder_key, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own interviews" ON public.interviews FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_interviews_updated BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.interview_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seq int NOT NULL,
  speaker text NOT NULL CHECK (speaker IN ('investor','founder','ai')),
  content text NOT NULL,
  ai_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.interview_turns (interview_id, seq);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_turns TO authenticated;
GRANT ALL ON public.interview_turns TO service_role;
ALTER TABLE public.interview_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own turns" ON public.interview_turns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Investment memos
CREATE TABLE public.investment_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_key text NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation text,
  confidence int CHECK (confidence BETWEEN 0 AND 100),
  check_size text,
  next_steps text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.investment_memos (user_id, founder_key, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_memos TO authenticated;
GRANT ALL ON public.investment_memos TO service_role;
ALTER TABLE public.investment_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memos" ON public.investment_memos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_memos_updated BEFORE UPDATE ON public.investment_memos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Thesis settings (one per user)
CREATE TABLE public.thesis_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sectors text[] NOT NULL DEFAULT '{}',
  geographies text[] NOT NULL DEFAULT '{}',
  stages text[] NOT NULL DEFAULT '{}',
  check_size_min int,
  check_size_max int,
  ownership_target numeric,
  risk_tolerance text,
  time_horizon text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.thesis_settings TO authenticated;
GRANT ALL ON public.thesis_settings TO service_role;
ALTER TABLE public.thesis_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own thesis" ON public.thesis_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_thesis_updated BEFORE UPDATE ON public.thesis_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Founder handle overrides (github/scholar per user per founder)
CREATE TABLE public.founder_handles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_key text NOT NULL,
  github_handle text,
  scholar_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, founder_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.founder_handles TO authenticated;
GRANT ALL ON public.founder_handles TO service_role;
ALTER TABLE public.founder_handles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own handles" ON public.founder_handles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_handles_updated BEFORE UPDATE ON public.founder_handles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  founder_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifs" ON public.notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Activities (audit log)
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_key text,
  kind text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.activities (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities" ON public.activities FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Semantic memory search RPC
CREATE OR REPLACE FUNCTION public.match_founder_memory(
  _user_id uuid,
  _founder_key text,
  _query vector(1536),
  _match_count int DEFAULT 8
) RETURNS TABLE (
  id uuid, category text, source text, content text, summary text,
  confidence int, metadata jsonb, created_at timestamptz, similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.category, m.source, m.content, m.summary, m.confidence, m.metadata, m.created_at,
         1 - (m.embedding <=> _query) AS similarity
  FROM public.founder_memory m
  WHERE m.user_id = _user_id
    AND m.founder_key = _founder_key
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> _query
  LIMIT _match_count;
$$;
GRANT EXECUTE ON FUNCTION public.match_founder_memory TO authenticated, service_role;
