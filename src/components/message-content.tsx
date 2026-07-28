"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";
import type { CanvasItem } from "./canvas-panel";

// Code blocks at or beyond this length open in the side Canvas panel
// instead of rendering inline — keeps the chat readable for big files.
const CANVAS_THRESHOLD = 400;

export function MessageContent({
  content,
  onOpenCanvas,
}: {
  content: string;
  onOpenCanvas: (item: CanvasItem) => void;
}) {
  return (
    <div className="prose-aurelia">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="whitespace-pre-wrap text-lg leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5 text-lg leading-relaxed">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5 text-lg leading-relaxed">
              {children}
            </ol>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-muted"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || "");
            const codeText = String(children).replace(/\n$/, "");

            if (!isBlock) {
              // Inline code, e.g. `variable`
              return (
                <code
                  className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[0.9em]"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const language = (className || "").replace("language-", "");

            if (codeText.length >= CANVAS_THRESHOLD) {
              return (
                <button
                  onClick={() =>
                    onOpenCanvas({
                      id: `canvas-${Date.now()}`,
                      language,
                      code: codeText,
                      title: guessTitle(language, codeText),
                    })
                  }
                  className="my-3 flex w-full items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <FileIcon />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {guessTitle(language, codeText)}
                    </span>
                    <span className="block text-xs text-muted-2">
                      {language || "text"} · {codeText.split("\n").length} lines · Click to open
                    </span>
                  </span>
                </button>
              );
            }

            return <CodeBlock language={language} code={codeText} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function guessTitle(language: string, code: string) {
  const ext: Record<string, string> = {
    tsx: "tsx",
    ts: "ts",
    js: "js",
    jsx: "jsx",
    python: "py",
    py: "py",
    css: "css",
    html: "html",
    json: "json",
    bash: "sh",
    sh: "sh",
  };
  const suffix = ext[language] ? `.${ext[language]}` : "";
  const firstLine = code.trim().split("\n")[0]?.slice(0, 30) ?? "snippet";
  return `${sanitize(firstLine) || "snippet"}${suffix}`;
}

function sanitize(s: string) {
  return s.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-muted">
      <path
        d="M4 1.5h5.5L13 5v9a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V2a.5.5 0 0 1 0-.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
