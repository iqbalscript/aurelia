"use client";

import { useEffect, useRef, useState } from "react";
import { ModelSelector } from "./model-selector";
import { Logo } from "./logo";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const THINKING_STAGES = ["Reading", "Reasoning", "Writing"];

export function ChatWindow({
  conversationId,
  onConversationCreated,
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(
          (data.conversation?.messages ?? []).map(
            (m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            })
          )
        );
      });
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cycle through thinking-stage labels while a response streams in,
  // so the wait reads as progress rather than a frozen spinner.
  useEffect(() => {
    if (!streaming) {
      setStage(0);
      return;
    }
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, THINKING_STAGES.length - 1));
    }, 900);
    return () => clearInterval(id);
  }, [streaming]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const res = await fetch("/api/conversations", { method: "POST" });
    const data = await res.json();
    onConversationCreated(data.conversation.id);
    return data.conversation.id;
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;
    setError(null);

    const convId = await ensureConversation();
    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: input,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    requestAnimationFrame(autoResize);
    setStreaming(true);

    fetch(`/api/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: userMessage.content }),
    }).catch(() => {});

    const assistantId = `local-${Date.now()}-assistant`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          modelId,
          useWebSearch,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (firstChunk) {
          firstChunk = false;
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3.5">
        <ModelSelector value={modelId} onChange={setModelId} />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            className="accent-current"
          />
          Search the web
        </label>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {messages.length === 0 && (
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center text-center">
            <Logo size={52} />
            <h1 className="font-display mt-5 text-4xl italic text-foreground">
              AURELIA
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Adaptive Unified Reasoning Engine for Learning, Intelligence,
              and Assistance. Ask a question, or turn on web search for
              anything time-sensitive.
            </p>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-7">
          {messages.map((m, i) => {
            const isLastAssistant =
              m.role === "assistant" && i === messages.length - 1;
            const isEmptyStreaming =
              isLastAssistant && streaming && m.content.length === 0;

            return (
              <div key={m.id} className="flex gap-3.5">
                {m.role === "assistant" ? (
                  <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center">
                    {isLastAssistant && streaming && (
                      <span className="breathe-ring absolute inset-0 rounded-full border border-foreground/40" />
                    )}
                    <div className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-raised text-[11px] font-medium">
                      <span className="font-display">A</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle bg-background text-[11px] font-medium text-muted">
                    U
                  </div>
                )}

                <div className="flex-1 pt-0.5">
                  {isEmptyStreaming ? (
                    <span className="text-sm text-muted-2">
                      {THINKING_STAGES[stage]}
                      <span className="caret">…</span>
                    </span>
                  ) : (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                      {m.content}
                      {isLastAssistant && streaming && m.content.length > 0 && (
                        <span className="caret text-muted-2">▍</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="mx-auto mt-4 max-w-3xl rounded-lg border border-border-subtle bg-surface-raised px-4 py-2.5 text-sm text-muted">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-surface/60 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-surface px-2 py-2 focus-within:ring-2 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Message AURELIA…"
            className="max-h-48 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-foreground outline-none placeholder:text-muted-2"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
            aria-label="Send message"
          >
            <ArrowUp />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-2">
          AURELIA can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}

function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
