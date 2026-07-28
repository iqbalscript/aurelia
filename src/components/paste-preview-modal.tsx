"use client";

import type { PastedFile } from "./pasted-file-chip";

export function PastePreviewModal({
  file,
  onClose,
}: {
  file: PastedFile;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-foreground">{file.filename}</span>
          <button
            onClick={onClose}
            className="text-muted-2 hover:text-foreground"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>
        <pre className="flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-foreground">
          {file.content}
        </pre>
      </div>
    </div>
  );
}