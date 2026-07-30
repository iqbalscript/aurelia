import { getEmbedding, cosineSimilarity } from "./embeddings";
import { db, type MemoryRecord } from "./db";
import type { ChatMessage } from "./providers/types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EXTRACTION_MODEL = "gemini-3.1-flash-lite";

const EXTRACTION_PROMPT = `You are an automatic long-term memory extraction engine for AURELIA AI.
Your job is to extract durable, reusable facts and context about the user from a conversation (preferences, identity, projects, tech stack, goals, workflows, personal details, recurring topics).

Extraction Guidelines:
- Extract clear, self-contained factual statements about the user or their work (max ~25 words per fact).
- Focus on facts that remain useful across future chat sessions (e.g. "User works on AURELIA AI project", "User prefers TypeScript with Next.js", "User uses 4 hex color palette #222831, #393E46, #948979, #DFD0B8").
- Skip transient one-off greetings or trivial single-turn questions unless they reveal durable preferences or background context.
- Return ONLY a valid JSON array of strings. Do NOT include markdown codeblocks or preamble.
- If no durable facts are present, return: []

Example output:
["User's name is Iqbal Dovandra (8Balls)", "User leads game and software development projects", "User built AURELIA AI engine", "User prefers clean modular TypeScript code"]`;

export async function extractMemoriesFromConversation(
  messages: ChatMessage[],
  userId: string,
  conversationId: string
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Cannot extract memories: GEMINI_API_KEY not set");
    return;
  }

  // Look at recent conversation context (user & assistant exchanges)
  const transcript = messages
    .filter((m) => m.role !== "system")
    .slice(-10) // Focus on recent turns
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n")
    .slice(0, 8000);

  if (!transcript.trim()) return;

  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${EXTRACTION_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${EXTRACTION_PROMPT}\n\nConversation Transcript:\n${transcript}` }],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) {
      console.error("Memory extraction API error:", await res.text().catch(() => ""));
      return;
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const cleanedRaw = raw.replace(/```json\n?|\n?```/g, "").trim();
    const facts: string[] = JSON.parse(cleanedRaw);

    if (!Array.isArray(facts) || facts.length === 0) return;

    // Fetch existing user memories for duplicate prevention
    const existing = await db.memory.findMany({
      where: { userId },
      select: { content: true },
    });
    const existingLower = new Set(existing.map((m: { content: string }) => m.content.toLowerCase()));

    for (const fact of facts) {
      if (typeof fact !== "string" || !fact.trim()) continue;
      const normalizedFact = fact.trim();
      if (existingLower.has(normalizedFact.toLowerCase())) continue; // Skip exact duplicate

      try {
        const embedding = await getEmbedding(normalizedFact);
        await db.memory.create({
          data: {
            userId,
            content: normalizedFact,
            embedding: JSON.stringify(embedding),
            sourceConvId: conversationId,
          },
        });
        existingLower.add(normalizedFact.toLowerCase());
      } catch (err) {
        console.error(`Failed to store memory "${normalizedFact}":`, err);
      }
    }
  } catch (err) {
    console.error("Memory extraction error:", err);
  }
}

/**
 * Retrieves memories for context injection.
 * Ingests all core memories if total count is <= topK,
 * or combines top semantic matches + recency if total count is > topK.
 */
export async function retrieveRelevantMemories(
  userId: string,
  query: string,
  topK = 20
): Promise<string[]> {
  const memories = await db.memory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (memories.length === 0) return [];

  // If memory count is within topK limit, return all memories to ensure 100% full context retention!
  if (memories.length <= topK) {
    return memories.map((m: MemoryRecord) => m.content);
  }

  try {
    const queryEmbedding = await getEmbedding(query);

    const scored = memories.map((m: MemoryRecord) => {
      let score = 0;
      try {
        score = cosineSimilarity(queryEmbedding, JSON.parse(m.embedding));
      } catch {
        score = 0;
      }
      return { content: m.content, score, createdAt: m.createdAt };
    });

    // Rank by semantic relevance
    scored.sort((a, b) => b.score - a.score);

    const semanticMatches = scored.slice(0, Math.floor(topK * 0.7)).map((s) => s.content);
    const selectedSet = new Set(semanticMatches);

    // Fill remaining slots with recent memories
    for (const m of memories) {
      if (selectedSet.size >= topK) break;
      selectedSet.add(m.content);
    }

    return Array.from(selectedSet);
  } catch (err) {
    console.error("Semantic memory search fallback to recency:", err);
    return memories.slice(0, topK).map((m: MemoryRecord) => m.content);
  }
}
