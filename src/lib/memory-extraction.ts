import { getEmbedding } from "./embeddings";
import { db, type MemoryRecord } from "./db";
import type { ChatMessage } from "./providers/types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EXTRACTION_MODEL = "gemini-2.5-flash-lite";

const EXTRACTION_PROMPT = `You extract durable, reusable facts about the user from a conversation — the kind of thing worth remembering for future conversations (preferences, ongoing projects, personal details, recurring context). 

Rules:
- Only extract facts that would still be useful weeks from now.
- Skip small talk, one-off questions, and anything purely about the current task.
- Each fact must be a short, self-contained sentence (max ~20 words).
- Return ONLY a JSON array of strings, nothing else. No markdown, no preamble.
- If there's nothing worth remembering, return an empty array: []

Example output:
["User's name is Iqbal Dovandra, goes by 8Balls", "User leads a game dev team called MNTA", "User prefers short, direct answers without fluff"]`;

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

  // Only look at the actual conversation, skip system messages
  const transcript = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n")
    .slice(0, 8000); // keep the extraction prompt cheap

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
              parts: [{ text: `${EXTRACTION_PROMPT}\n\nConversation:\n${transcript}` }],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) {
      console.error("Memory extraction failed:", await res.text().catch(() => ""));
      return;
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const facts: string[] = JSON.parse(raw);

    if (!Array.isArray(facts) || facts.length === 0) return;

    // Fetch existing memories once to do a cheap duplicate check.
    const existing = await db.memory.findMany({
      where: { userId },
      select: { content: true },
    });
    const existingLower = new Set(existing.map((m: { content: string }) => m.content.toLowerCase()));

    for (const fact of facts) {
      if (typeof fact !== "string" || !fact.trim()) continue;
      if (existingLower.has(fact.trim().toLowerCase())) continue; // skip exact dupes

      try {
        const embedding = await getEmbedding(fact);
        await db.memory.create({
          data: {
            userId,
            content: fact.trim(),
            embedding: JSON.stringify(embedding),
            sourceConvId: conversationId,
          },
        });
      } catch (err) {
        console.error(`Failed to embed/save memory "${fact}":`, err);
      }
    }
  } catch (err) {
    console.error("Memory extraction error:", err);
  }
}

/**
 * Retrieves the most relevant memories for the current user message via
 * cosine similarity over stored embeddings. Returns plain text ready to
 * inject into the system prompt.
 */
export async function retrieveRelevantMemories(
  userId: string,
  query: string,
  topK = 8
): Promise<string[]> {
  const memories = await db.memory.findMany({ where: { userId } });
  if (memories.length === 0) return [];

  try {
    const { cosineSimilarity } = await import("./embeddings");
    const queryEmbedding = await getEmbedding(query);

    const scored: Array<{ content: string; score: number }> = memories.map((m: MemoryRecord) => ({
      content: m.content,
      score: cosineSimilarity(queryEmbedding, JSON.parse(m.embedding)),
    }));

    scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    return scored.slice(0, topK).map((s: { content: string }) => s.content);
  } catch (err) {
    console.error("Memory retrieval failed, falling back to recency:", err);
    // Fail open: if embedding call fails, just return most recent memories
    // instead of breaking the chat entirely.
    return memories
      .slice(-topK)
      .map((m: MemoryRecord) => m.content);
  }
}
