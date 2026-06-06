import { Effect } from "effect";
import { LlmMalformedJsonError, LlmProviderError, LlmTimeoutError, type LlmError } from "../errors";
import { parseJsonContent } from "../json";
import type { GenerateJsonInput, LlmProvider } from "../provider";

export interface AnthropicLlmProviderConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  providerName: string;
}

export class AnthropicLlmProvider implements LlmProvider {
  public constructor(private readonly config: AnthropicLlmProviderConfig) {}

  public generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    return Effect.tryPromise({
      try: async () => {
        if (!this.config.apiKey || !this.config.baseUrl || !this.config.modelId) {
          throw new LlmProviderError("Anthropic provider is not configured.");
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), input.timeoutMs);
        try {
          const response = await fetch(this.config.baseUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": this.config.apiKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: this.config.modelId,
              max_tokens: 2_000,
              temperature: input.temperature,
              system: input.system,
              messages: [{ role: "user", content: input.user }]
            }),
            signal: controller.signal
          });

          if (!response.ok) {
            throw new LlmProviderError(`${this.config.providerName} returned HTTP ${response.status}`);
          }

          const payload = (await response.json()) as {
            content?: Array<{ type: string; text?: string }>;
          };
          const content = payload.content?.find((part) => part.type === "text")?.text;
          if (!content) {
            throw new LlmProviderError("Anthropic response did not include text content.");
          }

          return parseJsonContent<T>(content);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new LlmTimeoutError(`Anthropic call timed out after ${input.timeoutMs}ms.`);
          }
          throw error;
        } finally {
          clearTimeout(timer);
        }
      },
      catch: (error) => {
        if (
          error instanceof LlmProviderError ||
          error instanceof LlmMalformedJsonError ||
          error instanceof LlmTimeoutError
        ) {
          return error;
        }
        return new LlmProviderError(error instanceof Error ? error.message : String(error));
      }
    });
  }
}
