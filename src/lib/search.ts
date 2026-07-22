interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

/**
 * Runs a web search via Tavily and returns a compact text block
 * suitable for injecting into the model's context as grounding.
 * Swap this out for Serper/Brave/etc if you prefer another provider.
 */
export async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      search_depth: "basic",
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed (${res.status})`);
  }

  const data = await res.json();
  const results: TavilyResult[] = data.results ?? [];

  if (results.length === 0) return "No relevant search results found.";

  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 500)}`
    )
    .join("\n\n");
}
