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
import { pickAutoModel } from "@/lib/auto-router";
import { retrieveRelevantMemories, extractMemoriesFromConversation } from "@/lib/memory-extraction";

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

  let resolvedModelId = modelId;
  if (modelId === "auto") {
    resolvedModelId = pickAutoModel(messages);
    console.log(`[chat:${requestId}] auto-routed "auto" -> "${resolvedModelId}"`);
  }

  const model = getModelById(resolvedModelId);
  if (!model) {
    console.error(`[chat:${requestId}] REJECTED — unknown modelId: "${resolvedModelId}"`);
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  // --- RBAC check: does this user have access to this model? ---
  // ADMIN role bypasses the allowlist and can use everything.
  if (session.user.role !== "ADMIN") {
    const userAccess = await db.modelAccess.findMany({
      where: { userId: session.user.id },
      select: { modelId: true },
    });
    const allowedIds = new Set(userAccess.map((a: { modelId: string }) => a.modelId));

    if (!allowedIds.has(model.id)) {
      // If Auto picked a model this user can't use, fall back to any
      // model they *do* have access to, instead of hard-failing.
      if (modelId === "auto" && allowedIds.size > 0) {
        const fallbackId = [...allowedIds][0];
        const fallbackModel = getModelById(fallbackId);
        if (fallbackModel) {
          console.log(
            `[chat:${requestId}] auto-picked model not allowed, falling back to "${fallbackId}"`
          );
          Object.assign(model, fallbackModel);
        } else {
          console.error(`[chat:${requestId}] REJECTED — fallback model invalid`);
          return NextResponse.json({ error: "No accessible model found" }, { status: 403 });
        }
      } else {
        console.error(
          `[chat:${requestId}] REJECTED — user ${session.user.id} lacks access to ${model.id}`
        );
        return NextResponse.json(
          { error: `You do not have access to ${model.label}` },
          { status: 403 }
        );
      }
    }
  }

// --- Inject AURELIA's persona + guardrails as the first system message ---
  // This runs on every request regardless of provider, so identity and
  // safety behavior stay consistent across Gemini/OpenRouter/NVIDIA.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

  // --- Retrieve relevant long-term memories for this user ---
  let memoryContext = "";
  if (lastUserMsg?.content) {
    try {
      const relevant = await retrieveRelevantMemories(session.user.id, lastUserMsg.content);
      if (relevant.length > 0) {
        memoryContext = `\n\nWhat you remember about this user from past conversations:\n${relevant
          .map((m) => `- ${m}`)
          .join("\n")}`;
      }
    } catch (err) {
      console.error("Memory retrieval error:", err);
      // Fail open — proceed without memory context rather than blocking chat.
    }
  }

  let finalMessages: ChatMessage[] = [
    { role: "system", content: AURELIA_SYSTEM_PROMPT + memoryContext },
    ...messages,
  ];

if (useWebSearch && lastUserMsg) {
    try {
      const searchResults = await webSearch(lastUserMsg.content);
      const groundingMsg: ChatMessage = {
        role: "system",
        content: `Here are live web search results relevant to the user's latest question. Use them to give an accurate, up-to-date answer, and mention sources naturally where relevant:\n\n${searchResults}`,
      };
      finalMessages = [
        { role: "system", content: AURELIA_SYSTEM_PROMPT + memoryContext },
        groundingMsg,
        ...messages,
      ];
    } catch (err) {
      console.error("Web search failed:", err);
      // Fail open: continue without search grounding rather than blocking the chat.
    }
  }

  // Non-vision models can't see images — strip them but note it so the
  // model (and the user, via the reply) knows an image was attached.
  if (model.provider !== "gemini") {
    const hasImages = finalMessages.some((m) => (m.images?.length ?? 0) > 0);
    if (hasImages) {
      finalMessages = finalMessages.map((m) => ({ role: m.role, content: m.content }));
      finalMessages.unshift({
        role: "system",
        content:
          "Note: the user attached one or more images, but this model cannot see images. Let them know you can't view the image and suggest switching to Swift (Gemini) if they need image analysis.",
      });
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

    // Extract long-term memories every few turns, in the background.
    // Doesn't block the response — runs after this request returns.
    const turnCount = messages.filter((m) => m.role === "user").length;
    if (turnCount > 0 && turnCount % 3 === 0) {
      extractMemoriesFromConversation(finalMessages, session.user.id, conversationId).catch(
        (err) => console.error(`[chat:${requestId}] Memory extraction failed:`, err)
      );
    }
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
