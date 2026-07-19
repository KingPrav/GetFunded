import { createServerFn } from "@tanstack/react-start";

export type DiscoveredFounder = {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
  bio: string;
  location: string;
  company: string;
  blog: string;
  followers: number;
  publicRepos: number;
  htmlUrl: string;
  topRepo?: { name: string; description: string; stars: number; language: string; url: string };
};

type GHUser = { login: string; id: number; avatar_url: string; html_url: string };
type GHUserDetail = {
  login: string; name: string | null; avatar_url: string; bio: string | null;
  location: string | null; company: string | null; blog: string | null;
  followers: number; public_repos: number; html_url: string;
};
type GHRepo = { name: string; description: string | null; stargazers_count: number; language: string | null; html_url: string; fork: boolean };

async function gh<T>(url: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "get-funded-vc",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.json() as Promise<T>;
}

export const discoverFoundersOnGitHub = createServerFn({ method: "POST" })
  .inputValidator((input: {
    query?: string;
    industries?: string[];
    countries?: string[];
    minFollowers?: number;
    limit?: number;
  }) => input)
  .handler(async ({ data }) => {
    const topicMap: Record<string, string[]> = {
      "AI Infrastructure": ["llm", "vector-database", "ai-agents", "rag"],
      "Healthcare AI": ["healthcare", "medical-imaging", "clinical-nlp"],
      "Fintech Infrastructure": ["fintech", "payments", "ledger"],
      Robotics: ["robotics", "ros", "manipulation"],
      DevTools: ["developer-tools", "cli", "devtools"],
      "Bio × AI": ["bioinformatics", "protein-folding", "genomics"],
    };
    const locMap: Record<string, string[]> = {
      "United States": ["San Francisco", "New York", "Seattle", "Boston"],
      Germany: ["Berlin", "Munich"],
      India: ["Bangalore", "Mumbai"],
      "United Kingdom": ["London"],
      Netherlands: ["Amsterdam"],
    };

    const parts: string[] = [];
    if (data.query?.trim()) parts.push(data.query.trim());
    const topics = (data.industries ?? []).flatMap((i) => topicMap[i] ?? []);
    topics.slice(0, 3).forEach((t) => parts.push(`topic:${t}`));
    const locs = (data.countries ?? []).flatMap((c) => locMap[c] ?? []);
    locs.slice(0, 2).forEach((l) => parts.push(`location:"${l}"`));
    parts.push(`followers:>=${data.minFollowers ?? 50}`);
    parts.push("type:user");

    const q = parts.join(" ") || "language:typescript followers:>=100 type:user";
    const limit = Math.min(data.limit ?? 24, 30);

    const search = await gh<{ items: GHUser[] }>(
      `https://api.github.com/search/users?q=${encodeURIComponent(q)}&per_page=${limit}&sort=followers`,
    );

    const results = await Promise.all(
      search.items.map(async (u): Promise<DiscoveredFounder | null> => {
        try {
          const [detail, repos] = await Promise.all([
            gh<GHUserDetail>(`https://api.github.com/users/${u.login}`),
            gh<GHRepo[]>(`https://api.github.com/users/${u.login}/repos?per_page=10&sort=updated&type=owner`),
          ]);
          const top = repos
            .filter((r) => !r.fork)
            .sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
          return {
            id: `gh-${detail.login}`,
            login: detail.login,
            name: detail.name || detail.login,
            avatarUrl: detail.avatar_url,
            bio: detail.bio ?? "",
            location: detail.location ?? "",
            company: detail.company ?? "",
            blog: detail.blog ?? "",
            followers: detail.followers,
            publicRepos: detail.public_repos,
            htmlUrl: detail.html_url,
            topRepo: top
              ? {
                  name: top.name,
                  description: top.description ?? "",
                  stars: top.stargazers_count,
                  language: top.language ?? "",
                  url: top.html_url,
                }
              : undefined,
          };
        } catch {
          return null;
        }
      }),
    );

    return {
      query: q,
      founders: results.filter((r): r is DiscoveredFounder => r !== null),
    };
  });
