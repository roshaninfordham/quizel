import { Effect } from "effect";
import { LlmMalformedJsonError, LlmProviderError, LlmTimeoutError, type LlmError } from "../errors";
import type { GenerateJsonInput, LlmProvider } from "../provider";

export interface GenericHttpLlmProviderConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  jsonMode: boolean;
  providerName: string;
}

export class GenericHttpLlmProvider implements LlmProvider {
  public constructor(private readonly config: GenericHttpLlmProviderConfig) {}

  public generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    return Effect.tryPromise({
      try: async () => {
        if (!this.config.apiKey || !this.config.baseUrl || !this.config.modelId) {
          throw new LlmProviderError("LLM provider is not configured.");
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), input.timeoutMs);
        try {
          const response = await fetch(this.config.baseUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
              model: this.config.modelId,
              temperature: input.temperature,
              response_format: this.config.jsonMode ? { type: "json_object" } : undefined,
              messages: [
                { role: "system", content: input.system },
                { role: "user", content: input.user }
              ]
            }),
            signal: controller.signal
          });

          if (!response.ok) {
            throw new LlmProviderError(`${this.config.providerName} returned HTTP ${response.status}`);
          }

          const payload = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            output_text?: string;
          };
          const content = payload.output_text ?? payload.choices?.[0]?.message?.content;
          if (!content) {
            throw new LlmProviderError("LLM response did not include JSON content.");
          }

          try {
            return JSON.parse(content) as T;
          } catch (error) {
            throw new LlmMalformedJsonError(error instanceof Error ? error.message : "Malformed JSON");
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new LlmTimeoutError(`LLM call timed out after ${input.timeoutMs}ms.`);
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
