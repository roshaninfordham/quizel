import { Effect } from "effect";
import { LlmMalformedJsonError, LlmProviderError, LlmTimeoutError, type LlmError } from "../errors";
import { parseJsonContent } from "../json";
import type { GenerateJsonInput, LlmProvider } from "../provider";

export interface NvidiaLlmProviderConfig {
  baseUrl: string;
  apiKey: string;
  authorApiKey: string;
  authorModelId: string;
  reasoningApiKey: string;
  reasoningModelId: string;
  smallApiKey: string;
  smallModelId: string;
  safetyApiKey: string;
  safetyModelId: string;
  jsonMode: boolean;
  reasoningEnabled: boolean;
}

interface NvidiaRoute {
  apiKey: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  reasoning: boolean;
}

export class NvidiaLlmProvider implements LlmProvider {
  public constructor(private readonly config: NvidiaLlmProviderConfig) {}

  public generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    return Effect.tryPromise({
      try: async () => {
        const route = this.routeFor(input);
        if (!route.apiKey || !this.config.baseUrl || !route.modelId) {
          throw new LlmProviderError(`NVIDIA route is not configured for ${input.schemaName}.`);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), input.timeoutMs);
        try {
          const response = await fetch(this.config.baseUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
              authorization: `Bearer ${route.apiKey}`
            },
            body: JSON.stringify({
              model: route.modelId,
              temperature: route.temperature,
              top_p: 0.95,
              max_tokens: route.maxTokens,
              frequency_penalty: 0,
              presence_penalty: 0,
              stream: false,
              response_format: this.config.jsonMode ? { type: "json_object" } : undefined,
              reasoning_budget: route.reasoning ? 4096 : undefined,
              chat_template_kwargs: route.reasoning ? { enable_thinking: true } : undefined,
              messages: [
                { role: "system", content: input.system },
                { role: "user", content: input.user }
              ]
            }),
            signal: controller.signal
          });

          if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new LlmProviderError(`nvidia returned HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
          }

          const payload = (await response.json()) as {
            choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
            output_text?: string;
          };
          const content = payload.output_text ?? payload.choices?.[0]?.message?.content;
          if (!content) {
            throw new LlmProviderError("NVIDIA response did not include JSON content.");
          }

          try {
            return parseJsonContent<T>(content);
          } catch (error) {
            const coerced = coercePlainTextResponse(input.schemaName, content);
            if (coerced) {
              return coerced as T;
            }
            throw error;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw new LlmTimeoutError(`NVIDIA call timed out after ${input.timeoutMs}ms.`);
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

  private routeFor(input: GenerateJsonInput): NvidiaRoute {
    const fallbackKey = this.config.apiKey;
    switch (input.schemaName) {
      case "HostCommentary":
        return {
          apiKey: this.config.smallApiKey || fallbackKey,
          modelId: this.config.smallModelId,
          maxTokens: 512,
          temperature: input.temperature,
          reasoning: false
        };
      case "LearningRecap":
        return {
          apiKey: this.config.smallApiKey || fallbackKey,
          modelId: this.config.smallModelId,
          maxTokens: 1024,
          temperature: input.temperature,
          reasoning: false
        };
      case "SafetyGuardReview":
        return {
          apiKey: this.config.safetyApiKey || this.config.smallApiKey || fallbackKey,
          modelId: this.config.safetyModelId || this.config.smallModelId,
          maxTokens: 512,
          temperature: 0,
          reasoning: false
        };
      case "FairnessReview":
        return {
          apiKey: this.config.reasoningApiKey || this.config.authorApiKey || fallbackKey,
          modelId: this.config.reasoningModelId || this.config.authorModelId,
          maxTokens: 4096,
          temperature: 0.1,
          reasoning: this.config.reasoningEnabled
        };
      default:
        return {
          apiKey: this.config.authorApiKey || fallbackKey,
          modelId: this.config.authorModelId,
          maxTokens: 8192,
          temperature: input.temperature,
          reasoning: false
        };
    }
  }
}

function coercePlainTextResponse(schemaName: string, content: string): unknown | null {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!cleaned) return null;

  if (schemaName === "HostCommentary") {
    return {
      commentary: truncate(cleaned, 160),
      tone: "excited",
      confidence: 0.72
    };
  }

  if (schemaName === "LearningRecap") {
    return {
      summary: truncate(cleaned, 600),
      hardestConcepts: ["AI-generated quiz content"],
      nextQuizRecommendation: "Try another AI + Space + Startups match."
    };
  }

  return null;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
