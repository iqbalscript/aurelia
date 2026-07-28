import type { ChatMessage } from "./providers/types";

/**
 * Picks which real model "Auto" should route to, based on simple heuristics
 * over the latest user message. No extra API call — keeps latency and cost
 * low. Tune the signals below as you see how it performs in practice.
 *
 * Swap in a cheap classifier call later if you want smarter routing;
 * this stays deliberately simple for now.
 */
export function pickAutoModel(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content ?? "").trim();
  const len = text.length;

  const reasoningSignals = [
    "why",
    "explain",
    "analyze",
    "analisis",
    "kenapa",
    "jelaskan",
    "compare",
    "bandingkan",
    "step by step",
    "prove",
    "buktikan",
    "debug",
    "optimize",
    "architecture",
    "algoritma",
    "algorithm",
    "strategi",
    "strategy",
    "trade-off",
    "design a",
    "rancang",
  ];
  const codeSignals = ["```", "function", "class ", "def ", "SELECT ", "import "];

  const lower = text.toLowerCase();
  const hasReasoningSignal = reasoningSignals.some((s) => lower.includes(s));
  const hasCodeSignal = codeSignals.some((s) => text.includes(s));
  const isLong = len > 280;
  const isShortGreeting = len < 20;

  // Insight (Nemotron) — deep reasoning, long/complex/code-heavy asks
  if (hasReasoningSignal || hasCodeSignal || isLong) {
    return "nvidia-nemotron";
  }

  // Swift (Gemini Flash-Lite) — quick, short, casual messages
  if (isShortGreeting) {
    return "gemini-2.5-flash-lite";
  }

  // Apex (DeepSeek) — solid default for everything in between
  return "deepseek-v4-flash";
}