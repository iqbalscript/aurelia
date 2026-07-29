import type { ChatMessage } from "./types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function streamGemini(
  apiModel: string,
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  // Gemini uses "contents" with role "user"/"model", no "system" role directly;
  // fold any system message into the first user turn.
  const systemMsg = messages.find((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");

  const contents = rest.map((m, i) => {
    const textPart = {
      text:
        i === 0 && systemMsg
          ? `${systemMsg.content}\n\n${m.content}`
          : m.content,
    };
    const imageParts = (m.images ?? []).map((img) => ({
      inline_data: { mime_type: img.mimeType, data: img.base64 },
    }));
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: [textPart, ...imageParts],
    };
  });

  const res = await fetch(
    `${GEMINI_BASE}/models/${apiModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  // Re-emit as a plain text stream: parse SSE "data: {...}" lines,
  // extract candidates[0].content.parts[0].text, forward as raw text chunks.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const chunkText = decoder.decode(value, { stream: true });
      for (const line of chunkText.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) controller.enqueue(encoder.encode(text));
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
