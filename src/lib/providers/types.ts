export interface ChatMessageImage {
  base64: string;
  mimeType: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Images attached to this message (only meaningfully used by vision-capable models) */
  images?: ChatMessageImage[];
}