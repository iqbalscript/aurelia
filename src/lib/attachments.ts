export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  /** Raw base64 (no data: prefix) — used for images sent to vision models */
  base64?: string;
  /** Extracted plain text — used for PDFs/DOCX/TXT/CSV/MD sent as context */
  extractedText?: string;
  sizeBytes: number;
}

export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
export const MAX_FILES_PER_MESSAGE = 5;

export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
];

export function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}