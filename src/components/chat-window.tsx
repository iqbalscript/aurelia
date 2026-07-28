"use client";

import { useEffect, useRef, useState } from "react";
import { ModelSelector } from "./model-selector";
import { Logo } from "./logo";
import { PastedFileChip, type PastedFile } from "./pasted-file-chip";
import { PastePreviewModal } from "./paste-preview-modal";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const THINKING_STAGES = ["Reading", "Reasoning", "Writing"];

// Paste longer than this becomes an attached .md file instead of
// dumping raw text into the textarea — mirrors Claude/ChatGPT behavior.
const PASTE_TO_FILE_THRESHOLD = 600;


export function ChatWindow({
  conversationId,
  onConversationCreated,
  sidebarOpen,
  onOpenSidebar,
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pastedFiles, setPastedFiles] = useState<PastedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<PastedFile | null>(null);
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

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text");
    if (text.length <= PASTE_TO_FILE_THRESHOLD) return; // let it paste normally

    e.preventDefault();

    const firstLine = text.trim().split("\n")[0]?.slice(0, 40) ?? "pasted text";
    const file: PastedFile = {
      // This handler only runs in response to a paste event.
      // eslint-disable-next-line react-hooks/purity
      id: `paste-${Date.now()}`,
      filename: `${sanitizeFilename(firstLine) || "pasted-text"}.md`,
      content: text,
      charCount: text.length,
    };
    setPastedFiles((prev) => [...prev, file]);
  }

  function sanitizeFilename(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40);
  }

  async function handleSend() {
    const hasText = input.trim().length > 0;
    const hasFiles = pastedFiles.length > 0;
    if ((!hasText && !hasFiles) || streaming) return;
    if (!modelId) {
      setError("Model is still loading — try again in a second.");
      return;
    }
    setError(null);

    // Fold any attached pasted files into the message content as
    // fenced markdown blocks, labeled by filename.
    const filesBlock = pastedFiles
      .map((f) => `**Attached: ${f.filename}**\n\n\`\`\`\n${f.content}\n\`\`\``)
      .join("\n\n");
    const combinedContent = [input.trim(), filesBlock].filter(Boolean).join("\n\n");

    const convId = await ensureConversation();
    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: combinedContent,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setPastedFiles([]);
    requestAnimationFrame(autoResize);
    setStreaming(true);

    // Persist user message BEFORE calling /api/chat, so ordering is
    // guaranteed and a failure here surfaces instead of failing silently.
    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage.content }),
      });
    } catch (err) {
      console.error("Failed to persist user message:", err);
      // Non-fatal — continue to get the AI response even if saving failed.
    }

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
        );
      }
    } catch (err) {
      console.error("Chat request failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-2">
          {!sidebarOpen && (
            <button
              onClick={onOpenSidebar}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
              aria-label="Open sidebar"
              title="Open sidebar"
            >
              <SidebarIcon />
            </button>
          )}
          <ModelSelector value={modelId} onChange={setModelId} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-raised">
          <input
            type="checkbox"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            className="accent-current"
          />
          Search the web
        </label>
      </header>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Logo size={52} />
            <h1 className="font-display mt-5 text-4xl italic text-foreground">
              AURELIA
            </h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
              Adaptive Unified Reasoning Engine for Learning, Intelligence,
              and Assistance. Ask a question, or turn on web search for
              anything time-sensitive.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl px-6 py-10">
            <div className="space-y-8">
              {messages.map((m, i) => {
                const isLastAssistant =
                  m.role === "assistant" && i === messages.length - 1;
                const isEmptyStreaming =
                  isLastAssistant && streaming && m.content.length === 0;
                const isUser = m.role === "user";

                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar */}
                    {isUser ? (
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-sm font-medium text-muted">
                        U
                      </div>
                    ) : (
                      <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center">
                        {isLastAssistant && streaming && (
                          <span className="breathe-ring absolute inset-0 rounded-full border border-foreground/40" />
                        )}
                        <Logo size={36} />
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                        isUser
                          ? "bg-foreground text-background"
                          : "border border-border bg-surface text-foreground"
                      }`}
                    >
                      {isEmptyStreaming ? (
                        <span className="text-base text-muted-2">
                          {THINKING_STAGES[stage]}
                          <span className="caret">…</span>
                        </span>
                      ) : (
                        <p className="whitespace-pre-wrap text-lg leading-relaxed">
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
              <div className="mt-4 rounded-lg border border-border-subtle bg-surface-raised px-4 py-2.5 text-sm text-muted">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-4xl">
          {pastedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pastedFiles.map((f) => (
                <PastedFileChip
                  key={f.id}
                  file={f}
                  onPreview={() => setPreviewFile(f)}
                  onRemove={() =>
                    setPastedFiles((prev) => prev.filter((x) => x.id !== f.id))
                  }
                />
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-2 py-2 focus-within:ring-2 focus-within:ring-ring">
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
            onPaste={handlePaste}
            rows={1}
            placeholder="Message AURELIA…"
            className="max-h-48 flex-1 resize-none bg-transparent px-2.5 py-2 text-base text-foreground outline-none placeholder:text-muted-2"
          />
          <button
              onClick={handleSend}
              disabled={streaming || (!input.trim() && pastedFiles.length === 0)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
              aria-label="Send message"
            >
              <ArrowUp />
            </button>
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-4xl text-center text-xs text-muted-2">
          AURELIA can make mistakes. Verify important information.
        </p>
      </div>

      {previewFile && (
        <PastePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
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

function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
