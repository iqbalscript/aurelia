/**
 * Central registry of all AI models AURELIA can talk to.
 * `id` is what gets stored in ModelAccess.modelId and Message.modelUsed.
 * `label` is the user-facing name shown in the model selector.
 */

export type ModelProvider = "auto" | "gemini" | "deepseek" | "nvidia";
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
    id: "auto",
    label: "Auto",
    provider: "auto",
    apiModel: "auto",
    description: "AURELIA picks the best model for your question automatically.",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Swift",
    provider: "gemini",
    apiModel: "gemini-2.5-flash-lite",
    description: "Gemini 2.5 Flash-Lite — fast everyday answers.",
  },
  {
    id: "deepseek-v4-flash",
    label: "Apex",
    provider: "deepseek",
    apiModel: "deepseek-chat",
    description: "DeepSeek V4 Flash — strong general-purpose reasoning.",
  },
  {
    id: "nvidia-nemotron",
    label: "Insight",
    provider: "nvidia",
    apiModel: "nvidia/nemotron-3-ultra-550b-a55b",
    description: "NVIDIA Nemotron 3 Ultra — deep reasoning for hard problems.",
  },
];

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}