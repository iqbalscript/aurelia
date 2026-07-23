import type { ChatMessage } from "./types";
import { streamOpenAICompatible } from "./openai-compatible";

export async function streamDeepSeek(
  apiModel: string,
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  return streamOpenAICompatible({
    baseUrl: "https://api.deepseek.com/v1",
    apiKey,
    apiModel,
    messages,
  });
}