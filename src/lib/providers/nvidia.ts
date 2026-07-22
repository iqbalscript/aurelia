import type { ChatMessage } from "./types";
import { streamOpenAICompatible } from "./openai-compatible";

export async function streamNvidia(
  apiModel: string,
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not set");

  return streamOpenAICompatible({
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey,
    apiModel,
    messages,
    // Nemotron 3 Ultra supports an explicit "thinking" / reasoning budget.
    // Kept modest by default; raise reasoning_budget for harder queries.
    extraBody: {
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 4096,
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: 4096,
    },
  });
}
