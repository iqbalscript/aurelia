import type { ChatMessage } from "./types";
import { streamOpenAICompatible } from "./openai-compatible";

export async function streamOpenRouter(
  apiModel: string,
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  return streamOpenAICompatible({
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey,
    apiModel,
    messages,
    extraHeaders: {
      // Recommended by OpenRouter for analytics/rate-limit purposes
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "AURELIA",
    },
  });
}
