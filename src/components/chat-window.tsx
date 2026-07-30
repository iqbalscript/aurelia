"use client";

import { useEffect, useRef, useState } from "react";
import { ModelSelector } from "./model-selector";
import { Logo } from "./logo";
import { PastedFileChip, type PastedFile } from "./pasted-file-chip";
import { PastePreviewModal } from "./paste-preview-modal";
import { AttachmentChip } from "./attachment-chip";
import type { Attachment } from "@/lib/attachments";
import { MessageContent } from "./message-content";
import { CanvasPanel, type CanvasItem } from "./canvas-panel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const THINKING_STAGES = ["Reading", "Reasoning", "Writing"];
const PASTE_TO_FILE_THRESHOLD = 600;

const QUICK_STARTERS = [
  {
    title: "Code & Architecture",
    desc: "Analyze code structures, debug logic, or design systems.",
    prompt: "Analyze the architecture of a modular TypeScript application and suggest best practices.",
  },
  {
    title: "Deep Reasoning",
    desc: "Break down complex problems with step-by-step logic.",
    prompt: "Let's perform a step-by-step evaluation of the core trade-offs in serverless vs containerized deployments.",
  },
  {
    title: "Web Grounded Research",
    desc: "Synthesize latest findings with live web context.",
    prompt: "Find and summarize recent developments in AI model optimization and context window extensions.",
    enableSearch: true,
  },
  {
    title: "Document Synthesis",
    desc: "Extract key insights, summaries, and action items.",
    prompt: "Summarize the key takeaways and actionable conclusions from the attached document.",
  },
];

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [canvasItem, setCanvasItem] = useState<CanvasItem | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const pastedFileIdRef = useRef(0);

  useEffect(() => {
    if (!conversationId) return;
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
      })
      .catch((err) => {
        console.error("Failed to load conversation:", err);
        setError("Failed to load this conversation.");
      });
  }, [conversationId]);

  useEffect(() => {
    return () => {
      activeControllerRef.current?.abort();
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!streaming) return;
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

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text");
    if (text.length <= PASTE_TO_FILE_THRESHOLD) return;

    e.preventDefault();

    const firstLine = text.trim().split("\n")[0]?.slice(0, 40) ?? "pasted text";
    const file: PastedFile = {
      id: `paste-${++pastedFileIdRef.current}`,
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/extract-file", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `Failed to process ${file.name}`);
          continue;
        }
        setAttachments((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            filename: data.filename,
            mimeType: data.mimeType,
            base64: data.base64,
            extractedText: data.extractedText,
            sizeBytes: data.sizeBytes,
          },
        ]);
      } catch (err) {
        console.error("Upload failed:", err);
        setError(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
  }

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const res = await fetch("/api/conversations", { method: "POST" });
    const data = await res.json();
    onConversationCreated(data.conversation.id);
    return data.conversation.id;
  }

  async function handleSend(customText?: string) {
    const textToSend = customText ?? input;
    const hasText = textToSend.trim().length > 0;
    const hasPastedFiles = pastedFiles.length > 0;
    const hasAttachments = attachments.length > 0;
    if ((!hasText && !hasPastedFiles && !hasAttachments) || streaming) return;
    if (!modelId) {
      setError("Model is still loading — try again in a second.");
      return;
    }
    setError(null);

    const pastedBlock = pastedFiles
      .map((f) => `**Attached: ${f.filename}**\n\n\`\`\`\n${f.content}\n\`\`\``)
      .join("\n\n");
    const docAttachments = attachments.filter((a) => a.extractedText);
    const docBlock = docAttachments
      .map((a) => `**Attached: ${a.filename}**\n\n\`\`\`\n${a.extractedText}\n\`\`\``)
      .join("\n\n");

    const combinedContent = [textToSend.trim(), pastedBlock, docBlock]
      .filter(Boolean)
      .join("\n\n");

    const attachmentLabels = [
      ...pastedFiles.map((f) => `📎 ${f.filename}`),
      ...docAttachments.map((a) => `📎 ${a.filename}`),
    ];
    const displayContent = [textToSend.trim(), attachmentLabels.join("\n")]
      .filter(Boolean)
      .join("\n\n");

    const imageAttachments = attachments.filter((a) => a.mimeType.startsWith("image/"));

    const convId = await ensureConversation();
    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: displayContent,
    };
    const nextMessages = [...messages, userMessage];
    const imagesForApi = imageAttachments.map((a) => ({
      base64: a.base64!,
      mimeType: a.mimeType,
    }));

    setMessages(nextMessages);
    setInput("");
    setPastedFiles([]);
    setAttachments([]);
    requestAnimationFrame(autoResize);
    setStage(0);
    setStreaming(true);

    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: combinedContent }),
      });
    } catch (err) {
      console.error("Failed to persist user message:", err);
    }

    const assistantId = `local-${Date.now()}-assistant`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const hardTimeout = setTimeout(() => controller.abort(), 90_000);

    let stallTimer: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
    function resetStallTimer() {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), 25_000);
    }

    try {
      resetStallTimer();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          conversationId: convId,
          modelId,
          useWebSearch,
          messages: nextMessages.map((m, idx) => {
            const isNewMessage = idx === nextMessages.length - 1;
            return {
              role: m.role,
              content: isNewMessage ? combinedContent : m.content,
              ...(isNewMessage && imagesForApi.length > 0 ? { images: imagesForApi } : {}),
            };
          }),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      try {
        while (true) {
          if (controller.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done || controller.signal.aborted) break;
          resetStallTimer();
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
          );
        }
      } catch (readErr) {
        if (!controller.signal.aborted) {
          reader.cancel().catch(() => {});
          throw readErr;
        }
      }

      if (acc.length === 0 && !controller.signal.aborted) {
        throw new Error("The model didn't return a response. Please try again.");
      }
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError") ||
        controller.signal.aborted;

      if (!isAbort) {
        console.error("Chat request failed:", err);
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
      setMessages((prev) => prev.filter((m) => !(m.id === assistantId && m.content.length === 0)));
    } finally {
      clearTimeout(hardTimeout);
      clearTimeout(stallTimer);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
        setStreaming(false);
      }
    }
  }

  return (
    <div className="relative flex h-full flex-1 overflow-hidden bg-background">
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Floating Top Control Deck */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={onOpenSidebar}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted shadow-sm transition-all hover:border-muted hover:text-foreground"
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                <SidebarIcon />
              </button>
            )}
            <div className="rounded-xl border border-border bg-surface-raised/90 backdrop-blur-md px-3 py-1 shadow-sm">
              <ModelSelector value={modelId} onChange={setModelId} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-raised/90 backdrop-blur-md px-3.5 py-1.5 text-xs text-muted shadow-sm transition-all hover:border-muted hover:text-foreground">
              <input
                type="checkbox"
                checked={useWebSearch}
                onChange={(e) => setUseWebSearch(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#DFD0B8]"
              />
              <span className="font-medium">Web Grounding</span>
            </label>
          </div>
        </div>

        {/* Message Stream or Hero Centerpiece */}
        <div className="flex-1 overflow-y-auto px-4 pb-28">
          {messages.length === 0 ? (
            <div className="flex min-h-[calc(100vh-180px)] flex-col items-center justify-center py-10">
              <div className="mb-6 flex items-center justify-center rounded-2xl border border-border bg-surface-raised p-4 shadow-md">
                <Logo size={56} />
              </div>
              <h1 className="font-display text-4xl tracking-wide text-foreground">
                AURELIA
              </h1>
              <p className="mt-2 text-xs uppercase tracking-widest text-muted">
                Adaptive Unified Reasoning Engine
              </p>
              <p className="mt-4 max-w-lg text-center text-sm leading-relaxed text-muted-2">
                Select a quick reasoning mode or type your prompt below to initiate an intelligence session.
              </p>

              {/* Quick Starter Grid */}
              <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3.5 sm:grid-cols-2 px-2">
                {QUICK_STARTERS.map((starter) => (
                  <button
                    key={starter.title}
                    onClick={() => {
                      if (starter.enableSearch) setUseWebSearch(true);
                      setInput(starter.prompt);
                      textareaRef.current?.focus();
                    }}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-surface-raised p-4 text-left shadow-sm transition-all hover:border-[#948979] hover:bg-surface-hover"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground group-hover:text-accent">
                          {starter.title}
                        </span>
                        <span className="text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
                          →
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted leading-snug">
                        {starter.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl py-8">
              <div className="space-y-6">
                {messages.map((m, i) => {
                  const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
                  const isEmptyStreaming =
                    isLastAssistant && streaming && m.content.length === 0;
                  const isUser = m.role === "user";

                  return (
                    <div key={m.id} className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
                      {isUser ? (
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#DFD0B8]/40 bg-surface-raised text-[#DFD0B8] shadow-md">
                          <UserIcon />
                        </div>
                      ) : (
                        <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#948979]/40 bg-surface-raised shadow-md">
                          {isLastAssistant && streaming && (
                            <span className="breathe-ring absolute -inset-1 rounded-xl border border-[#DFD0B8]/60 opacity-75" />
                          )}
                          <Logo size={36} />
                        </div>
                      )}

                      <div
                        className={`group relative max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
                          isUser
                            ? "bg-accent text-accent-foreground font-medium"
                            : "border border-border bg-surface-raised text-foreground"
                        }`}
                      >
                        {isEmptyStreaming ? (
                          <span className="text-sm text-muted">
                            {THINKING_STAGES[stage]}
                            <span className="caret">…</span>
                          </span>
                        ) : isUser ? (
                          <p className="whitespace-pre-wrap text-base leading-relaxed">
                            {m.content}
                          </p>
                        ) : (
                          <>
                            <MessageContent content={m.content} onOpenCanvas={setCanvasItem} />
                            {isLastAssistant && streaming && m.content.length > 0 && (
                              <span className="caret text-muted">▍</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Elevated Floating Input Island */}
        <div className="absolute bottom-4 left-0 right-0 z-20 px-4">
          <div className="mx-auto max-w-3xl">
            {(pastedFiles.length > 0 || attachments.length > 0) && (
              <div className="mb-2 flex flex-wrap gap-2 rounded-xl border border-border bg-surface-raised/95 backdrop-blur-md p-2 shadow-lg">
                {pastedFiles.map((f) => (
                  <PastedFileChip
                    key={f.id}
                    file={f}
                    onPreview={() => setPreviewFile(f)}
                    onRemove={() => setPastedFiles((prev) => prev.filter((x) => x.id !== f.id))}
                  />
                ))}
                {attachments.map((a) => (
                  <AttachmentChip
                    key={a.id}
                    attachment={a}
                    onRemove={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  />
                ))}
              </div>
            )}

            <div className="relative flex items-end gap-2.5 rounded-2xl border border-border bg-surface-raised/95 backdrop-blur-lg p-2.5 shadow-xl transition-all focus-within:border-[#948979] focus-within:ring-2 focus-within:ring-ring">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.docx,.txt,.md,.csv,.json"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface/50 text-muted transition-all hover:border-border hover:bg-surface hover:text-foreground disabled:opacity-40"
                aria-label="Attach file"
                title="Attach file"
              >
                {uploading ? <Spinner /> : <PaperclipIcon />}
              </button>

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
                placeholder="Ask AURELIA anything…"
                className="max-h-48 flex-1 resize-none bg-transparent px-2 py-2 text-base text-foreground outline-none placeholder:text-muted-2"
              />

              <button
                onClick={() => handleSend()}
                disabled={
                  streaming ||
                  (!input.trim() && pastedFiles.length === 0 && attachments.length === 0)
                }
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-30"
                aria-label="Send message"
              >
                <ArrowUp />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-2">
              AURELIA Reasoning Engine • Double check critical output.
            </p>
          </div>
        </div>

        {previewFile && (
          <PastePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
        )}
      </div>

      {canvasItem && <CanvasPanel item={canvasItem} onClose={() => setCanvasItem(null)} />}
    </div>
  );
}

function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
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

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path
        d="M11.5 5.5 6.914 10.086a2 2 0 1 0 2.829 2.828l5.121-5.12a3.5 3.5 0 1 0-4.95-4.95L4.793 7.965a5 5 0 1 0 7.071 7.071"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" fill="none" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 10a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.75 17.5a6.25 6.25 0 0 1 12.5 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
