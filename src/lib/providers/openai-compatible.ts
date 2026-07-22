import type { ChatMessage } from "./types";

interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey: string;
  apiModel: string;
  messages: ChatMessage[];
  extraBody?: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
}

/**
 * Calls any OpenAI Chat-Completions-compatible endpoint with stream: true,
 * and re-emits a plain text ReadableStream (content deltas only).
 * Used for both OpenRouter and NVIDIA NIM, since both implement this API shape.
 */
export async function streamOpenAICompatible({
  baseUrl,
  apiKey,
  apiModel,
  messages,
  extraBody,
  extraHeaders,
}: OpenAICompatibleOptions): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: apiModel,
      messages,
      stream: true,
      ...extraBody,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Provider API error (${res.status}): ${errText}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete last line for next pull

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          // Standard content delta
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
          // Some reasoning models (e.g. Nemotron) emit reasoning_content separately;
          // we skip it here and only stream final content. See note in nvidia.ts.
        } catch {
          // ignore partial/malformed SSE fragments
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
