import { Context, Effect, Layer } from "effect";
import { WorkerConfigService, type WorkerConfig } from "../effects/config";
import { AnthropicLlmProvider } from "./providers/AnthropicLlmProvider";
import { FallbackSeedProvider } from "./providers/FallbackSeedProvider";
import { GeminiLlmProvider } from "./providers/GeminiLlmProvider";
import { GenericHttpLlmProvider } from "./providers/GenericHttpLlmProvider";
import { NvidiaLlmProvider } from "./providers/NvidiaLlmProvider";
import type { LlmProvider } from "./provider";

export class LlmProviderService extends Context.Tag("quizduel/LlmProvider")<
  LlmProviderService,
  LlmProvider
>() {}

export interface LlmProviderSelection {
  readonly providerName: string;
  readonly modelId: string;
  readonly configured: boolean;
  readonly reason: string;
}

export function makeLlmProvider(config: WorkerConfig): LlmProvider {
  const selection = selectLlmProvider(config);

  if (!selection.configured) {
    return new FallbackSeedProvider();
  }

  switch (selection.providerName) {
    case "nvidia":
      return new NvidiaLlmProvider({
        baseUrl: config.llm.nvidiaBaseUrl,
        apiKey: config.llm.nvidiaApiKey,
        authorApiKey: config.llm.nvidiaAuthorApiKey,
        authorModelId: config.llm.nvidiaAuthorModelId,
        reasoningApiKey: config.llm.nvidiaReasoningApiKey,
        reasoningModelId: config.llm.nvidiaReasoningModelId,
        smallApiKey: config.llm.nvidiaSmallApiKey,
        smallModelId: config.llm.nvidiaSmallModelId,
        safetyApiKey: config.llm.nvidiaSafetyApiKey,
        safetyModelId: config.llm.nvidiaSafetyModelId,
        jsonMode: config.llm.nvidiaJsonMode,
        reasoningEnabled: config.llm.nvidiaReasoningEnabled
      });
    case "anthropic":
      return new AnthropicLlmProvider({
        baseUrl: config.llm.anthropicBaseUrl,
        apiKey: config.llm.anthropicApiKey,
        modelId: selection.modelId,
        providerName: "anthropic"
      });
    case "gemini":
      return new GeminiLlmProvider({
        baseUrl: config.llm.geminiBaseUrl,
        apiKey: config.llm.geminiApiKey,
        modelId: selection.modelId,
        providerName: "gemini"
      });
    case "openai":
      return new GenericHttpLlmProvider({
        baseUrl: config.llm.openaiBaseUrl,
        apiKey: config.llm.openaiApiKey,
        modelId: selection.modelId,
        jsonMode: config.llm.jsonMode,
        providerName: "openai"
      });
    default:
      return new GenericHttpLlmProvider({
        baseUrl: config.llm.apiBaseUrl,
        apiKey: config.llm.apiKey,
        modelId: selection.modelId,
        jsonMode: config.llm.jsonMode,
        providerName: config.llm.providerName === "auto" ? "generic" : config.llm.providerName
      });
  }
}

export function selectLlmProvider(config: WorkerConfig): LlmProviderSelection {
  const requested = config.llm.providerPreference.toLowerCase();

  const candidates: LlmProviderSelection[] = [
    {
      providerName: "generic",
      modelId: config.llm.modelId,
      configured: Boolean(config.llm.apiBaseUrl && config.llm.apiKey && config.llm.modelId),
      reason: "LLM_API_BASE_URL + LLM_API_KEY + LLM_MODEL_ID"
    },
    {
      providerName: "openai",
      modelId: config.llm.openaiModelId,
      configured: Boolean(config.llm.openaiApiKey && config.llm.openaiBaseUrl && config.llm.openaiModelId),
      reason: "OPENAI_API_KEY"
    },
    {
      providerName: "nvidia",
      modelId: config.llm.nvidiaAuthorModelId,
      configured: Boolean(
        config.llm.nvidiaBaseUrl &&
          config.llm.nvidiaAuthorModelId &&
          (config.llm.nvidiaApiKey || config.llm.nvidiaAuthorApiKey)
      ),
      reason: "NVIDIA_API_KEY or NVIDIA_AUTHOR_API_KEY"
    },
    {
      providerName: "anthropic",
      modelId: config.llm.anthropicModelId,
      configured: Boolean(config.llm.anthropicApiKey && config.llm.anthropicBaseUrl && config.llm.anthropicModelId),
      reason: "ANTHROPIC_API_KEY"
    },
    {
      providerName: "gemini",
      modelId: config.llm.geminiModelId,
      configured: Boolean(config.llm.geminiApiKey && config.llm.geminiBaseUrl && config.llm.geminiModelId),
      reason: "GEMINI_API_KEY"
    }
  ];

  if (requested !== "auto") {
    return (
      candidates.find((candidate) => candidate.providerName === requested) ?? {
        providerName: "fallback",
        modelId: "seed",
        configured: false,
        reason: `Unknown LLM_PROVIDER_NAME: ${config.llm.providerPreference}`
      }
    );
  }

  return (
    candidates.find((candidate) => candidate.configured) ?? {
      providerName: "fallback",
      modelId: "seed",
      configured: false,
      reason: "No usable LLM provider key/model configuration found"
    }
  );
}

export const LlmProviderLive = Layer.effect(
  LlmProviderService,
  Effect.map(WorkerConfigService, makeLlmProvider)
);
