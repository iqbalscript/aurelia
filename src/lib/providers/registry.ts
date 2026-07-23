/**
 * Central registry of all AI models AURELIA can talk to.
 * `id` is what gets stored in ModelAccess.modelId and Message.modelUsed.
 * `label` is the user-facing name shown in the model selector.
 */

export type ModelProvider = "gemini" | "deepseek" | "nvidia";

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
    label: "Swift",
    provider: "gemini",
    apiModel: "gemini-2.5-flash-lite",
    description: "Fast and efficient. Good for short conversations and quick answers.",
  },
  {
    id: "deepseek-v4-flash",
    label: "Apex",
    provider: "deepseek",
    apiModel: "deepseek-chat",
    description: "Maximum intelligence. Good for complex reasoning and nuanced conversations.",
  },
  {
    id: "nvidia-nemotron",
    label: "Insight",
    provider: "nvidia",
    apiModel: "nvidia/nemotron-3-ultra-550b-a55b",
    description: "Balanced and capable. Good for a wide range of tasks.",
  },
];

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}