import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { QuizGenerationProgram } from "./program";
import { WorkerConfigTest, type WorkerConfig } from "./config";
import { LlmProviderService, makeLlmProvider } from "../llm/service";
import { FallbackSeedProvider } from "../llm/providers/FallbackSeedProvider";
import { GenericHttpLlmProvider } from "../llm/providers/GenericHttpLlmProvider";
import { MockLlmProvider } from "../llm/providers/MockLlmProvider";

const baseConfig: WorkerConfig = {
  llm: {
    apiBaseUrl: "",
    apiKey: "",
    modelId: "",
    smallModelId: "",
    providerName: "generic",
    timeoutMs: 100,
    maxRetries: 0,
    jsonMode: true
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
