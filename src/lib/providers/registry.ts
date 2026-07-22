/**
 * Central registry of all AI models AURELIA can talk to.
 * `id` is what gets stored in ModelAccess.modelId and Message.modelUsed.
 */

export type ModelProvider = "gemini" | "openrouter" | "nvidia";

export interface ModelDefinition {
  id: string;
  label: string;
  provider: ModelProvider;
  /** Model string sent to the provider's API */
  apiModel: string;
  description: string;
}

export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "gemini",
    apiModel: "gemini-2.5-flash-lite",
    description: "Fast & efficient, good for everyday questions.",
  },
  {
    id: "openrouter-free",
    label: "OpenRouter (Free Models)",
    provider: "openrouter",
    // swap this for whichever free model you want to default to,
    // e.g. "meta-llama/llama-3.3-70b-instruct:free"
    apiModel: "meta-llama/llama-3.3-70b-instruct:free",
    description: "Community free-tier model via OpenRouter.",
  },
  {
    id: "nvidia-nemotron",
    label: "NVIDIA Nemotron 3 Ultra (550B-A55B)",
    provider: "nvidia",
    apiModel: "nvidia/nemotron-3-ultra-550b-a55b",
    description:
      "Open frontier reasoning MoE model, 550B total / 55B active params, via NVIDIA NIM (build.nvidia.com).",
  },
];

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}
