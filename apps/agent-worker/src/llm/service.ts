import { Context, Effect, Layer } from "effect";
import { WorkerConfigService, type WorkerConfig } from "../effects/config";
import { FallbackSeedProvider } from "./providers/FallbackSeedProvider";
import { GenericHttpLlmProvider } from "./providers/GenericHttpLlmProvider";
import type { LlmProvider } from "./provider";

export class LlmProviderService extends Context.Tag("quizduel/LlmProvider")<
  LlmProviderService,
  LlmProvider
>() {}

export function makeLlmProvider(config: WorkerConfig): LlmProvider {
  const hasProviderCredentials = Boolean(config.llm.apiKey && config.llm.apiBaseUrl && config.llm.modelId);

  if (!hasProviderCredentials) {
    return new FallbackSeedProvider();
  }

  return new GenericHttpLlmProvider({
    baseUrl: config.llm.apiBaseUrl,
    apiKey: config.llm.apiKey,
    modelId: config.llm.modelId,
    jsonMode: config.llm.jsonMode,
    providerName: config.llm.providerName
  });
}

export const LlmProviderLive = Layer.effect(
  LlmProviderService,
  Effect.map(WorkerConfigService, makeLlmProvider)
);
