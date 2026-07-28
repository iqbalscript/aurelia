"use client";

interface PastedFile {
  id: string;
  filename: string;
  content: string;
  charCount: number;
}

export function PastedFileChip({
  file,
  onRemove,
  onPreview,
}: {
  file: PastedFile;
  onRemove: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">
      <FileIcon />
      <button
        onClick={onPreview}
        className="flex-1 truncate text-left text-foreground hover:underline"
        title="Click to preview"
      >
        {file.filename}
      </button>
      <span className="flex-shrink-0 text-xs text-muted-2">
        {file.charCount.toLocaleString()} chars
      </span>
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-muted-2 hover:text-foreground"
        aria-label="Remove pasted file"
      >
        ✕
      </button>
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-muted">
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

export type { PastedFile };