"use client";

import Image from "next/image";
import type { Attachment } from "@/lib/attachments";

export function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const isImg = attachment.mimeType.startsWith("image/");

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-sm">
      {isImg && attachment.base64 ? (
        <Image
          src={`data:${attachment.mimeType};base64,${attachment.base64}`}
          alt={attachment.filename}
          width={32}
          height={32}
          unoptimized
          className="h-8 w-8 flex-shrink-0 rounded object-cover"
        />
      ) : (
        <FileIcon />
      )}
      <span className="max-w-[140px] truncate text-foreground" title={attachment.filename}>
        {attachment.filename}
      </span>
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-muted-2 hover:text-foreground"
        aria-label="Remove attachment"
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
