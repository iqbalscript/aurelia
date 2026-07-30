"use client";

import { useState } from "react";

export interface CanvasItem {
  id: string;
  language: string;
  code: string;
  title: string;
}

export function CanvasPanel({
  item,
  onClose,
}: {
  item: CanvasItem;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(item.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-full w-full max-w-xl flex-shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          <p className="font-mono text-xs text-muted-2">{item.language || "text"}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={handleCopy}
            className="rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1.5 text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label="Close canvas"
          >
            ✕
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto bg-surface-raised px-4 py-3">
        <code className="font-mono text-sm leading-relaxed text-foreground">{item.code}</code>
      </pre>
    </div>
  );
}