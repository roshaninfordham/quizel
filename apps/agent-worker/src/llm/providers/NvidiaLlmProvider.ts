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
  authorMaxConcurrency: number;
  reasoningMaxConcurrency: number;
  smallMaxConcurrency: number;
  safetyMaxConcurrency: number;
  routeQueueTimeoutMs: number;
  cooldownMs: number;
}

interface NvidiaRoute {
  routeName: "author" | "reasoning" | "small" | "safety";
  apiKey: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  reasoning: boolean;
  maxConcurrency: number;
}

interface RouteState {
  inFlight: number;
  cooldownUntil: number;
}

export class NvidiaLlmProvider implements LlmProvider {
  private readonly routeState = new Map<string, RouteState>();

  public constructor(private readonly config: NvidiaLlmProviderConfig) {}

  public generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    return Effect.tryPromise({
      try: async () => {
        const route = this.routeFor(input);
        if (!route.apiKey || !this.config.baseUrl || !route.modelId) {
          throw new LlmProviderError(`NVIDIA route is not configured for ${input.schemaName}.`);
        }

        const release = await this.acquireRoute(route);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), input.timeoutMs);
        try {
          const response = await fetch(nvidiaEndpoint(this.config.baseUrl), {
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
            if (response.status === 429 || response.status >= 500) {
              this.cooldownRoute(route);
            }
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
          release();
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
          routeName: "small",
          apiKey: this.config.smallApiKey || fallbackKey,
          modelId: this.config.smallModelId,
          maxTokens: 512,
          temperature: input.temperature,
          reasoning: false,
          maxConcurrency: positiveLimit(this.config.smallMaxConcurrency)
        };
      case "LearningRecap":
        return {
          routeName: "small",
          apiKey: this.config.smallApiKey || fallbackKey,
          modelId: this.config.smallModelId,
          maxTokens: 1024,
          temperature: input.temperature,
          reasoning: false,
          maxConcurrency: positiveLimit(this.config.smallMaxConcurrency)
        };
      case "TopicRouter":
        return {
          routeName: "small",
          apiKey: this.config.smallApiKey || fallbackKey,
          modelId: this.config.smallModelId,
          maxTokens: 1024,
          temperature: input.temperature,
          reasoning: false,
          maxConcurrency: positiveLimit(this.config.smallMaxConcurrency)
        };
      case "SafetyGuardReview":
        return {
          routeName: "safety",
          apiKey: this.config.safetyApiKey || this.config.smallApiKey || fallbackKey,
          modelId: this.config.safetyModelId || this.config.smallModelId,
          maxTokens: 512,
          temperature: 0,
          reasoning: false,
          maxConcurrency: positiveLimit(this.config.safetyMaxConcurrency)
        };
      case "FairnessReview":
        return {
          routeName: "reasoning",
          apiKey: this.config.reasoningApiKey || this.config.authorApiKey || fallbackKey,
          modelId: this.config.reasoningModelId || this.config.authorModelId,
          maxTokens: 4096,
          temperature: 0.1,
          reasoning: this.config.reasoningEnabled,
          maxConcurrency: positiveLimit(this.config.reasoningMaxConcurrency)
        };
      default:
        return {
          routeName: "author",
          apiKey: this.config.authorApiKey || fallbackKey,
          modelId: this.config.authorModelId,
          maxTokens: 8192,
          temperature: input.temperature,
          reasoning: false,
          maxConcurrency: positiveLimit(this.config.authorMaxConcurrency)
        };
    }
  }

  private async acquireRoute(route: NvidiaRoute): Promise<() => void> {
    const key = `${route.routeName}:${route.modelId}`;
    const timeoutMs = Math.max(0, this.config.routeQueueTimeoutMs);
    const startedAt = Date.now();

    while (true) {
      const state = this.stateFor(key);
      const now = Date.now();
      if (state.cooldownUntil > now) {
        throw new LlmProviderError(
          `NVIDIA ${route.routeName} route is cooling down for ${Math.ceil((state.cooldownUntil - now) / 1000)}s.`
        );
      }
      if (state.inFlight < route.maxConcurrency) {
        state.inFlight += 1;
        return () => {
          state.inFlight = Math.max(0, state.inFlight - 1);
        };
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new LlmProviderError(
          `NVIDIA ${route.routeName} route concurrency limit reached; using fallback quiz path.`
        );
      }
      await sleep(Math.min(100, Math.max(25, timeoutMs - (Date.now() - startedAt))));
    }
  }

  private cooldownRoute(route: NvidiaRoute): void {
    const key = `${route.routeName}:${route.modelId}`;
    const state = this.stateFor(key);
    state.cooldownUntil = Date.now() + Math.max(1000, this.config.cooldownMs);
  }

  private stateFor(key: string): RouteState {
    const existing = this.routeState.get(key);
    if (existing) return existing;
    const created = { inFlight: 0, cooldownUntil: 0 };
    this.routeState.set(key, created);
    return created;
  }
}

function nvidiaEndpoint(baseUrl: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  return clean.endsWith("/chat/completions") ? clean : `${clean}/chat/completions`;
}

function positiveLimit(value: number): number {
  return Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  if (schemaName === "SafetyGuardReview") {
    const lower = cleaned.toLowerCase();
    const unsafe = /\b(unsafe|high risk|blocked|disallowed|violation)\b/.test(lower) && !/\bsafe\b/.test(lower);
    return {
      safe: !unsafe,
      riskLevel: unsafe ? "high" : "low",
      categories: unsafe ? ["nvidia_safety_guard"] : [],
      rationale: truncate(cleaned, 240)
    };
  }

  return null;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
