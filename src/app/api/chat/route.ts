import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getModelById } from "@/lib/providers/registry";
import { streamGemini } from "@/lib/providers/gemini";
import { streamDeepSeek } from "@/lib/providers/deepseek";
import { streamNvidia } from "@/lib/providers/nvidia";
import { webSearch } from "@/lib/search";
import type { ChatMessage } from "@/lib/providers/types";
import { AURELIA_SYSTEM_PROMPT } from "@/lib/system-prompt";

export const runtime = "nodejs";

interface ChatRequestBody {
  conversationId?: string;
  modelId: string;
  messages: ChatMessage[];
  useWebSearch?: boolean;
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[chat:${requestId}] incoming request`);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: ChatRequestBody = await req.json();
  const { modelId, messages, useWebSearch, conversationId } = body;
  console.log(
    `[chat:${requestId}] modelId=${modelId} conversationId=${conversationId} messageCount=${messages?.length}`
  );

  const model = getModelById(modelId);
  if (!model) {
    console.error(`[chat:${requestId}] REJECTED — unknown modelId: "${modelId}"`);
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  // --- RBAC check: does this user have access to this model? ---
  // ADMIN role bypasses the allowlist and can use everything.
  if (session.user.role !== "ADMIN") {
    const access = await db.modelAccess.findUnique({
      where: {
        userId_modelId: {
          userId: session.user.id,
          modelId: model.id,
        },
      },
    });
    if (!access) {
      console.error(
        `[chat:${requestId}] REJECTED — user ${session.user.id} lacks access to ${model.id}`
      );
      return NextResponse.json(
        { error: `You do not have access to ${model.label}` },
        { status: 403 }
      );
    }
  }

// --- Inject AURELIA's persona + guardrails as the first system message ---
  // This runs on every request regardless of provider, so identity and
  // safety behavior stay consistent across Gemini/OpenRouter/NVIDIA.
  let finalMessages: ChatMessage[] = [
    { role: "system", content: AURELIA_SYSTEM_PROMPT },
    ...messages,
  ];
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

if (useWebSearch && lastUserMsg) {
    try {
      const searchResults = await webSearch(lastUserMsg.content);
      const groundingMsg: ChatMessage = {
        role: "system",
        content: `Here are live web search results relevant to the user's latest question. Use them to give an accurate, up-to-date answer, and mention sources naturally where relevant:\n\n${searchResults}`,
      };
      finalMessages = [
        { role: "system", content: AURELIA_SYSTEM_PROMPT },
        groundingMsg,
        ...messages,
      ];
    } catch (err) {
      console.error("Web search failed:", err);
      // Fail open: continue without search grounding rather than blocking the chat.
    }
  }

  // --- Dispatch to the correct provider ---
  let stream: ReadableStream<Uint8Array>;
  try {
    switch (model.provider) {
      case "gemini":
        stream = await streamGemini(model.apiModel, finalMessages);
        break;
      case "deepseek":
        stream = await streamDeepSeek(model.apiModel, finalMessages);
        break;
      case "nvidia":
        stream = await streamNvidia(model.apiModel, finalMessages);
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported provider" },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error(`[chat:${requestId}] PROVIDER ERROR (${model.provider}):`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Provider request failed" },
      { status: 502 }
    );
  }

  // --- Persist messages (fire-and-forget-ish, but awaited for correctness) ---
  // We tee the stream: one branch goes to the client, one gets buffered to save to DB.
  const [clientStream, saveStream] = stream.tee();

  if (conversationId) {
    saveAssistantReply(saveStream, conversationId, model.id).catch((err) =>
      console.error(`[chat:${requestId}] Failed to persist assistant reply:`, err)
    );
  }

  console.log(`[chat:${requestId}] streaming response from ${model.provider}`);
  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}

async function saveAssistantReply(
  stream: ReadableStream<Uint8Array>,
  conversationId: string,
  modelUsed: string
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }

  await db.message.create({
    data: {
      conversationId,
      role: "assistant",
      content: full,
      modelUsed,
    },
  });
}
