import { Effect } from "effect";
import { LlmMalformedJsonError, LlmProviderError, LlmTimeoutError, type LlmError } from "../errors";
import { parseJsonContent } from "../json";
import type { GenerateJsonInput, LlmProvider } from "../provider";

export interface GeminiLlmProviderConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  providerName: string;
}

export class GeminiLlmProvider implements LlmProvider {
  public constructor(private readonly config: GeminiLlmProviderConfig) {}

  public generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    return Effect.tryPromise({
      try: async () => {
        if (!this.config.apiKey || !this.config.baseUrl || !this.config.modelId) {
          throw new LlmProviderError("Gemini provider is not configured.");
        }

        const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(
          this.config.modelId
        )}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), input.timeoutMs);
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: input.system }]
              },
              contents: [
                {
                  role: "user",
                  parts: [{ text: input.user }]
                }
              ],
              generationConfig: {
                temperature: input.temperature,
                responseMimeType: "application/json"
              }
            }),
            signal: controller.signal
          });

          if (!response.ok) {
            throw new LlmProviderError(`${this.config.providerName} returned HTTP ${response.status}`);
          }

          const payload = (await response.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          };
          const content = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
          if (!content) {
            throw new LlmProviderError("Gemini response did not include text content.");
          }

          return parseJsonContent<T>(content);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new LlmTimeoutError(`Gemini call timed out after ${input.timeoutMs}ms.`);
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
