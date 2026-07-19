import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* ---------- Types ---------- */
export type GithubSignal = {
  login: string;
  name: string | null;
  avatar: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers: number;
  publicRepos: number;
  aggregateStars: number;
  topRepos: { name: string; stars: number; language: string | null; description: string | null; url: string }[];
  profileUrl: string;
  matchConfidence: number;
};

export type ScholarSignal = {
  authorId: string;
  name: string;
  affiliations: string[];
  paperCount: number;
  citationCount: number;
  hIndex: number;
  topPapers: { title: string; year: number | null; citationCount: number; venue: string | null }[];
  profileUrl: string;
  matchConfidence: number;
};

export type EnrichResult = {
  github: GithubSignal | null;
  scholar: ScholarSignal | null;
  githubCandidates: { login: string; name: string | null; avatar: string; bio: string | null }[];
  scholarCandidates: { authorId: string; name: string; affiliations: string[]; paperCount: number }[];
  errors: { github?: string; scholar?: string };
};

/* ---------- Helpers ---------- */
const GH_HEADERS = { Accept: "application/vnd.github+json", "User-Agent": "VC-Brain-Enrich/1.0" };
const S2 = "https://api.semanticscholar.org/graph/v1";

function nameSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const nb = b.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const at = new Set(na.split(/\s+/));
  const bt = new Set(nb.split(/\s+/));
  const inter = [...at].filter((t) => bt.has(t)).length;
  return inter / Math.max(at.size, bt.size);
}

/* ---------- GitHub ---------- */
async function fetchGithub(name: string, handleOverride?: string): Promise<{ signal: GithubSignal | null; candidates: GithubSignal["topRepos"] extends never ? never : { login: string; name: string | null; avatar: string; bio: string | null }[]; error?: string }> {
  try {
    let login = handleOverride?.trim().replace(/^@/, "") || "";
    let candidates: { login: string; name: string | null; avatar: string; bio: string | null }[] = [];
    let confidence = login ? 1 : 0;

    if (!login) {
      const q = encodeURIComponent(`${name} in:fullname`);
      const res = await fetch(`https://api.github.com/search/users?q=${q}&per_page=5`, { headers: GH_HEADERS });
      if (!res.ok) return { signal: null, candidates: [], error: `GitHub search ${res.status}` };
      const data = (await res.json()) as { items?: { login: string; avatar_url: string }[] };
      const items = data.items ?? [];
      // enrich each candidate lightly for confidence
      const detailed = await Promise.all(
        items.slice(0, 5).map(async (u) => {
          const r = await fetch(`https://api.github.com/users/${u.login}`, { headers: GH_HEADERS });
          if (!r.ok) return null;
          const d = (await r.json()) as { login: string; name: string | null; avatar_url: string; bio: string | null };
          return { login: d.login, name: d.name, avatar: d.avatar_url, bio: d.bio };
        }),
      );
      candidates = detailed.filter((x): x is NonNullable<typeof x> => x !== null);
      const scored = candidates
        .map((c) => ({ c, s: nameSimilarity(c.name ?? c.login, name) }))
        .sort((a, b) => b.s - a.s);
      if (!scored[0] || scored[0].s < 0.5) {
        return { signal: null, candidates, error: undefined };
      }
      login = scored[0].c.login;
      confidence = scored[0].s;
    }

    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${login}`, { headers: GH_HEADERS }),
      fetch(`https://api.github.com/users/${login}/repos?per_page=100&sort=updated`, { headers: GH_HEADERS }),
    ]);
    if (!userRes.ok) return { signal: null, candidates, error: `GitHub user ${userRes.status}` };
    const user = (await userRes.json()) as {
      login: string; name: string | null; avatar_url: string; bio: string | null;
      company: string | null; location: string | null; followers: number; public_repos: number;
    };
    const repos = reposRes.ok
      ? ((await reposRes.json()) as { name: string; stargazers_count: number; language: string | null; description: string | null; html_url: string; fork: boolean }[])
      : [];
    const owned = repos.filter((r) => !r.fork);
    const aggregateStars = owned.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0);
    const topRepos = [...owned]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map((r) => ({ name: r.name, stars: r.stargazers_count, language: r.language, description: r.description, url: r.html_url }));

    return {
      signal: {
        login: user.login,
        name: user.name,
        avatar: user.avatar_url,
        bio: user.bio,
        company: user.company,
        location: user.location,
        followers: user.followers,
        publicRepos: user.public_repos,
        aggregateStars,
        topRepos,
        profileUrl: `https://github.com/${user.login}`,
        matchConfidence: Math.round(confidence * 100),
      },
      candidates,
    };
  } catch (e) {
    return { signal: null, candidates: [], error: e instanceof Error ? e.message : "GitHub error" };
  }
}

/* ---------- Semantic Scholar ---------- */
async function fetchScholar(name: string, authorIdOverride?: string): Promise<{ signal: ScholarSignal | null; candidates: { authorId: string; name: string; affiliations: string[]; paperCount: number }[]; error?: string }> {
  try {
    let authorId = authorIdOverride?.trim() || "";
    let candidates: { authorId: string; name: string; affiliations: string[]; paperCount: number }[] = [];
    let confidence = authorId ? 1 : 0;

    if (!authorId) {
      const q = encodeURIComponent(name);
      const res = await fetch(`${S2}/author/search?query=${q}&limit=5&fields=name,affiliations,paperCount,citationCount,hIndex`);
      if (!res.ok) return { signal: null, candidates: [], error: `S2 search ${res.status}` };
      const data = (await res.json()) as { data?: { authorId: string; name: string; affiliations?: string[]; paperCount?: number }[] };
      candidates = (data.data ?? []).map((a) => ({
        authorId: a.authorId,
        name: a.name,
        affiliations: a.affiliations ?? [],
        paperCount: a.paperCount ?? 0,
      }));
      const scored = candidates
        .map((c) => ({ c, s: nameSimilarity(c.name, name) * (c.paperCount > 0 ? 1 : 0.5) }))
        .sort((a, b) => b.s - a.s);
      if (!scored[0] || scored[0].s < 0.5) {
        return { signal: null, candidates };
      }
      authorId = scored[0].c.authorId;
      confidence = Math.min(1, scored[0].s);
    }

    const [authorRes, papersRes] = await Promise.all([
      fetch(`${S2}/author/${authorId}?fields=name,affiliations,paperCount,citationCount,hIndex`),
      fetch(`${S2}/author/${authorId}/papers?limit=5&fields=title,year,citationCount,venue`),
    ]);
    if (!authorRes.ok) return { signal: null, candidates, error: `S2 author ${authorRes.status}` };
    const author = (await authorRes.json()) as {
      name: string; affiliations?: string[]; paperCount?: number; citationCount?: number; hIndex?: number;
    };
    const papers = papersRes.ok
      ? ((await papersRes.json()) as { data?: { title: string; year: number | null; citationCount: number; venue: string | null }[] }).data ?? []
      : [];
    const topPapers = [...papers]
      .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
      .slice(0, 5)
      .map((p) => ({ title: p.title, year: p.year, citationCount: p.citationCount, venue: p.venue }));

    return {
      signal: {
        authorId,
        name: author.name,
        affiliations: author.affiliations ?? [],
        paperCount: author.paperCount ?? 0,
        citationCount: author.citationCount ?? 0,
        hIndex: author.hIndex ?? 0,
        topPapers,
        profileUrl: `https://www.semanticscholar.org/author/${authorId}`,
        matchConfidence: Math.round(confidence * 100),
      },
      candidates,
    };
  } catch (e) {
    return { signal: null, candidates: [], error: e instanceof Error ? e.message : "Scholar error" };
  }
}

/* ---------- Server function ---------- */
const EnrichInput = z.object({
  name: z.string().min(1),
  githubHandle: z.string().optional(),
  scholarId: z.string().optional(),
});

export const enrichFounder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EnrichInput.parse(input))
  .handler(async ({ data }): Promise<EnrichResult> => {
    const [gh, sc] = await Promise.all([
      fetchGithub(data.name, data.githubHandle),
      fetchScholar(data.name, data.scholarId),
    ]);
    return {
      github: gh.signal,
      scholar: sc.signal,
      githubCandidates: gh.candidates,
      scholarCandidates: sc.candidates,
      errors: { ...(gh.error ? { github: gh.error } : {}), ...(sc.error ? { scholar: sc.error } : {}) },
    };
  });
