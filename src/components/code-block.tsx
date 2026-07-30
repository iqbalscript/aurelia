"use client";

import { useState } from "react";

export function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail on non-HTTPS/localhost edge cases — fail silently.
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-surface-raised">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <span className="font-mono text-xs text-muted-2">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          {copied ? (
            <>
              <CheckIcon /> Copied
            </>
          ) : (
            <>
              <CopyIcon /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-sm leading-relaxed text-foreground">{code}</code>
      </pre>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8.5L6.5 12L13 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}