import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { QuizGenerationProgram } from "./program";
import { WorkerConfigTest, type WorkerConfig } from "./config";
import { LlmProviderService, makeLlmProvider, selectLlmProvider } from "../llm/service";
import { FallbackSeedProvider } from "../llm/providers/FallbackSeedProvider";
import { GenericHttpLlmProvider } from "../llm/providers/GenericHttpLlmProvider";
import { MockLlmProvider } from "../llm/providers/MockLlmProvider";
import { NvidiaLlmProvider } from "../llm/providers/NvidiaLlmProvider";

const baseConfig: WorkerConfig = {
  llm: {
    providerPreference: "auto",
    apiBaseUrl: "",
    apiKey: "",
    modelId: "",
    smallModelId: "",
    providerName: "generic",
    timeoutMs: 100,
    maxRetries: 0,
    jsonMode: true,
    openaiApiKey: "",
    openaiBaseUrl: "https://api.openai.com/v1/chat/completions",
    openaiModelId: "gpt-4.1-mini",
    openaiSmallModelId: "gpt-4.1-mini",
    anthropicApiKey: "",
    anthropicBaseUrl: "https://api.anthropic.com/v1/messages",
    anthropicModelId: "claude-sonnet-4-20250514",
    anthropicSmallModelId: "claude-3-5-haiku-20241022",
    geminiApiKey: "",
    geminiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    geminiModelId: "gemini-2.5-flash",
    geminiSmallModelId: "gemini-2.5-flash",
    nvidiaApiKey: "",
    nvidiaBaseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    nvidiaReasoningApiKey: "",
    nvidiaReasoningModelId: "nvidia/nemotron-3-super-120b-a12b",
    nvidiaAuthorApiKey: "",
    nvidiaAuthorModelId: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    nvidiaSmallApiKey: "",
    nvidiaSmallModelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
    nvidiaSafetyApiKey: "",
    nvidiaSafetyModelId: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
    nvidiaJsonMode: false,
    nvidiaReasoningEnabled: false,
    safetyGuardEnabled: false
  },
  realtime: {
    url: "ws://localhost:8787",
    transport: "local"
  },
  demo: {
    topic: "AI + Space + Startups",
    difficulty: "beginner",
    questionCount: 3
  }
};

describe("Effect worker runtime", () => {
  it("uses fallback provider when LLM credentials are missing", () => {
    expect(makeLlmProvider(baseConfig)).toBeInstanceOf(FallbackSeedProvider);
  });

  it("uses generic HTTP provider when required LLM credentials exist", () => {
    expect(
      makeLlmProvider({
        ...baseConfig,
        llm: {
          ...baseConfig.llm,
          apiBaseUrl: "https://example.test/v1/chat/completions",
          apiKey: "test-key",
          modelId: "test-model"
        }
      })
    ).toBeInstanceOf(GenericHttpLlmProvider);
  });

  it("auto-selects configured provider keys without exposing secret values", () => {
    const selection = selectLlmProvider({
      ...baseConfig,
      llm: {
        ...baseConfig.llm,
        openaiApiKey: "test-openai-key"
      }
    });

    expect(selection).toMatchObject({
      providerName: "openai",
      modelId: "gpt-4.1-mini",
      configured: true,
      reason: "OPENAI_API_KEY"
    });
  });

  it("uses NVIDIA provider when NVIDIA credentials exist", () => {
    const config = {
      ...baseConfig,
      llm: {
        ...baseConfig.llm,
        providerPreference: "nvidia",
        nvidiaAuthorApiKey: "test-nvidia-key"
      }
    };

    expect(selectLlmProvider(config)).toMatchObject({
      providerName: "nvidia",
      modelId: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      configured: true,
      reason: "NVIDIA_API_KEY or NVIDIA_AUTHOR_API_KEY"
    });
    expect(makeLlmProvider(config)).toBeInstanceOf(NvidiaLlmProvider);
  });

  it("honors explicit provider preference", () => {
    const selection = selectLlmProvider({
      ...baseConfig,
      llm: {
        ...baseConfig.llm,
        providerPreference: "gemini",
        geminiApiKey: "test-gemini-key"
      }
    });

    expect(selection.providerName).toBe("gemini");
    expect(selection.configured).toBe(true);
  });

  it("runs quiz generation with injected Effect services", async () => {
    const testLayer = Layer.merge(
      WorkerConfigTest(baseConfig),
      Layer.succeed(LlmProviderService, new MockLlmProvider())
    );

    const result = await Effect.runPromise(Effect.provide(QuizGenerationProgram, testLayer));

    expect(result.status).toBe("complete");
    expect(result.questions).toHaveLength(3);
  });
});
