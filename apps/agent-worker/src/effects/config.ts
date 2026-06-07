import { Config, Context, Layer } from "effect";

export interface WorkerConfig {
  readonly llm: {
    readonly providerPreference: string;
    readonly apiBaseUrl: string;
    readonly apiKey: string;
    readonly modelId: string;
    readonly smallModelId: string;
    readonly providerName: string;
    readonly timeoutMs: number;
    readonly maxRetries: number;
    readonly jsonMode: boolean;
    readonly openaiApiKey: string;
    readonly openaiBaseUrl: string;
    readonly openaiModelId: string;
    readonly openaiSmallModelId: string;
    readonly anthropicApiKey: string;
    readonly anthropicBaseUrl: string;
    readonly anthropicModelId: string;
    readonly anthropicSmallModelId: string;
    readonly geminiApiKey: string;
    readonly geminiBaseUrl: string;
    readonly geminiModelId: string;
    readonly geminiSmallModelId: string;
    readonly nvidiaApiKey: string;
    readonly nvidiaBaseUrl: string;
    readonly nvidiaReasoningApiKey: string;
    readonly nvidiaReasoningModelId: string;
    readonly nvidiaAuthorApiKey: string;
    readonly nvidiaAuthorModelId: string;
    readonly nvidiaSmallApiKey: string;
    readonly nvidiaSmallModelId: string;
    readonly nvidiaSafetyApiKey: string;
    readonly nvidiaSafetyModelId: string;
    readonly nvidiaJsonMode: boolean;
    readonly nvidiaReasoningEnabled: boolean;
    readonly nvidiaAuthorMaxConcurrency: number;
    readonly nvidiaReasoningMaxConcurrency: number;
    readonly nvidiaSmallMaxConcurrency: number;
    readonly nvidiaSafetyMaxConcurrency: number;
    readonly nvidiaRouteQueueTimeoutMs: number;
    readonly nvidiaCooldownMs: number;
    readonly safetyGuardEnabled: boolean;
  };
  readonly realtime: {
    readonly url: string;
    readonly transport: "local" | "spacetime";
    readonly spacetimeHost: string;
    readonly spacetimeModule: string;
  };
  readonly grounding: {
    readonly firecrawlEnabled: boolean;
    readonly firecrawlApiKey: string;
    readonly firecrawlApiBaseUrl: string;
    readonly firecrawlTimeoutMs: number;
    readonly firecrawlLimit: number;
    readonly firecrawlMaxFacts: number;
    readonly firecrawlCountry: string;
  };
  readonly demo: {
    readonly topic: string;
    readonly questionCount: number;
  };
}

export class WorkerConfigService extends Context.Tag("quizrush/WorkerConfig")<
  WorkerConfigService,
  WorkerConfig
>() {}

const questionCountConfig = Config.integer("QUIZ_QUESTION_COUNT").pipe(
  Config.withDefault(7),
  Config.validate({
    message: "QUIZ_QUESTION_COUNT must be between 5 and 9 for the QuizRush sprint demo.",
    validation: (value) => value >= 5 && value <= 9
  })
);

export const workerConfig = Config.all({
  llm: Config.all({
    providerPreference: Config.string("LLM_PROVIDER_NAME").pipe(Config.withDefault("auto")),
    apiBaseUrl: Config.string("LLM_API_BASE_URL").pipe(Config.withDefault("")),
    apiKey: Config.string("LLM_API_KEY").pipe(Config.withDefault("")),
    modelId: Config.string("LLM_MODEL_ID").pipe(Config.withDefault("")),
    smallModelId: Config.string("LLM_SMALL_MODEL_ID").pipe(Config.withDefault("")),
    providerName: Config.string("LLM_PROVIDER_NAME").pipe(Config.withDefault("generic")),
    timeoutMs: Config.integer("LLM_TIMEOUT_MS").pipe(Config.withDefault(12_000)),
    maxRetries: Config.integer("LLM_MAX_RETRIES").pipe(Config.withDefault(2)),
    jsonMode: Config.boolean("LLM_JSON_MODE").pipe(Config.withDefault(true)),
    openaiApiKey: Config.string("OPENAI_API_KEY").pipe(Config.withDefault("")),
    openaiBaseUrl: Config.string("OPENAI_API_BASE_URL").pipe(Config.withDefault("https://api.openai.com/v1/chat/completions")),
    openaiModelId: Config.string("OPENAI_MODEL").pipe(Config.withDefault("gpt-4.1-mini")),
    openaiSmallModelId: Config.string("OPENAI_SMALL_MODEL").pipe(Config.withDefault("gpt-4.1-mini")),
    anthropicApiKey: Config.string("ANTHROPIC_API_KEY").pipe(Config.withDefault("")),
    anthropicBaseUrl: Config.string("ANTHROPIC_BASE_URL").pipe(Config.withDefault("https://api.anthropic.com/v1/messages")),
    anthropicModelId: Config.string("ANTHROPIC_MODEL").pipe(Config.withDefault("claude-sonnet-4-20250514")),
    anthropicSmallModelId: Config.string("ANTHROPIC_SMALL_FAST_MODEL").pipe(Config.withDefault("claude-3-5-haiku-20241022")),
    geminiApiKey: Config.string("GEMINI_API_KEY").pipe(Config.withDefault("")),
    geminiBaseUrl: Config.string("GEMINI_API_BASE_URL").pipe(Config.withDefault("https://generativelanguage.googleapis.com/v1beta")),
    geminiModelId: Config.string("GEMINI_MODEL").pipe(Config.withDefault("gemini-2.5-flash")),
    geminiSmallModelId: Config.string("GEMINI_SMALL_MODEL").pipe(Config.withDefault("gemini-2.5-flash")),
    nvidiaApiKey: Config.string("NVIDIA_API_KEY").pipe(Config.withDefault("")),
    nvidiaBaseUrl: Config.string("NVIDIA_API_BASE_URL").pipe(
      Config.withDefault("https://integrate.api.nvidia.com/v1")
    ),
    nvidiaReasoningApiKey: Config.string("NVIDIA_REASONING_API_KEY").pipe(Config.withDefault("")),
    nvidiaReasoningModelId: Config.string("NVIDIA_REASONING_MODEL").pipe(
      Config.withDefault("nvidia/nemotron-3-super-120b-a12b")
    ),
    nvidiaAuthorApiKey: Config.string("NVIDIA_AUTHOR_API_KEY").pipe(Config.withDefault("")),
    nvidiaAuthorModelId: Config.string("NVIDIA_AUTHOR_MODEL").pipe(
      Config.withDefault("nvidia/llama-3.3-nemotron-super-49b-v1.5")
    ),
    nvidiaSmallApiKey: Config.string("NVIDIA_SMALL_API_KEY").pipe(Config.withDefault("")),
    nvidiaSmallModelId: Config.string("NVIDIA_SMALL_MODEL").pipe(
      Config.withDefault("nvidia/llama-3.1-nemotron-nano-8b-v1")
    ),
    nvidiaSafetyApiKey: Config.string("NVIDIA_SAFETY_API_KEY").pipe(Config.withDefault("")),
    nvidiaSafetyModelId: Config.string("NVIDIA_SAFETY_MODEL").pipe(
      Config.withDefault("nvidia/llama-3.1-nemotron-safety-guard-8b-v3")
    ),
    nvidiaJsonMode: Config.boolean("NVIDIA_JSON_MODE").pipe(Config.withDefault(false)),
    nvidiaReasoningEnabled: Config.boolean("NVIDIA_REASONING_ENABLED").pipe(Config.withDefault(false)),
    nvidiaAuthorMaxConcurrency: Config.integer("NVIDIA_AUTHOR_MAX_CONCURRENCY").pipe(Config.withDefault(2)),
    nvidiaReasoningMaxConcurrency: Config.integer("NVIDIA_REASONING_MAX_CONCURRENCY").pipe(Config.withDefault(1)),
    nvidiaSmallMaxConcurrency: Config.integer("NVIDIA_SMALL_MAX_CONCURRENCY").pipe(Config.withDefault(4)),
    nvidiaSafetyMaxConcurrency: Config.integer("NVIDIA_SAFETY_MAX_CONCURRENCY").pipe(Config.withDefault(2)),
    nvidiaRouteQueueTimeoutMs: Config.integer("NVIDIA_ROUTE_QUEUE_TIMEOUT_MS").pipe(Config.withDefault(750)),
    nvidiaCooldownMs: Config.integer("NVIDIA_COOLDOWN_MS").pipe(Config.withDefault(15_000)),
    safetyGuardEnabled: Config.boolean("SAFETY_GUARD_ENABLED").pipe(Config.withDefault(false))
  }),
  realtime: Config.all({
    url: Config.string("AGENT_REALTIME_URL").pipe(Config.withDefault("ws://localhost:8787")),
    transport: Config.literal("local", "spacetime")("AGENT_TRANSPORT").pipe(Config.withDefault("local" as const)),
    spacetimeHost: Config.string("AGENT_SPACETIMEDB_HOST").pipe(Config.withDefault("https://maincloud.spacetimedb.com")),
    spacetimeModule: Config.string("AGENT_SPACETIMEDB_MODULE").pipe(Config.withDefault("quizrush-live"))
  }),
  grounding: Config.all({
    firecrawlEnabled: Config.boolean("FIRECRAWL_ENABLED").pipe(Config.withDefault(true)),
    firecrawlApiKey: Config.string("FIRECRAWL_API_KEY").pipe(Config.withDefault("")),
    firecrawlApiBaseUrl: Config.string("FIRECRAWL_API_BASE_URL").pipe(Config.withDefault("https://api.firecrawl.dev")),
    firecrawlTimeoutMs: Config.integer("FIRECRAWL_TIMEOUT_MS").pipe(Config.withDefault(1500)),
    firecrawlLimit: Config.integer("FIRECRAWL_SEARCH_LIMIT").pipe(Config.withDefault(4)),
    firecrawlMaxFacts: Config.integer("FIRECRAWL_MAX_FACTS").pipe(Config.withDefault(10)),
    firecrawlCountry: Config.string("FIRECRAWL_COUNTRY").pipe(Config.withDefault("US"))
  }),
  demo: Config.all({
    topic: Config.string("QUIZ_TOPIC").pipe(Config.withDefault("AI + Space + Startups")),
    questionCount: questionCountConfig
  })
});

export const WorkerConfigLive = Layer.effect(WorkerConfigService, workerConfig);

export function WorkerConfigTest(config: WorkerConfig) {
  return Layer.succeed(WorkerConfigService, config);
}
