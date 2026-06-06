import { Config, Context, Layer } from "effect";
import type { Difficulty, QuestionCount } from "@quizduel/shared";

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
  };
  readonly realtime: {
    readonly url: string;
    readonly transport: "local" | "spacetime";
  };
  readonly demo: {
    readonly topic: string;
    readonly difficulty: Difficulty;
    readonly questionCount: QuestionCount;
  };
}

export class WorkerConfigService extends Context.Tag("quizduel/WorkerConfig")<
  WorkerConfigService,
  WorkerConfig
>() {}

const questionCountConfig = Config.integer("QUIZ_QUESTION_COUNT").pipe(
  Config.withDefault(3),
  Config.validate({
    message: "QUIZ_QUESTION_COUNT must be 3 or 10.",
    validation: (value): value is QuestionCount => value === 3 || value === 10
  })
);

const difficultyConfig = Config.literal("beginner", "intermediate", "expert")("QUIZ_DIFFICULTY").pipe(
  Config.withDefault("beginner" as const)
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
    geminiSmallModelId: Config.string("GEMINI_SMALL_MODEL").pipe(Config.withDefault("gemini-2.5-flash"))
  }),
  realtime: Config.all({
    url: Config.string("AGENT_REALTIME_URL").pipe(Config.withDefault("ws://localhost:8787")),
    transport: Config.literal("local", "spacetime")("AGENT_TRANSPORT").pipe(Config.withDefault("local" as const))
  }),
  demo: Config.all({
    topic: Config.string("QUIZ_TOPIC").pipe(Config.withDefault("AI + Space + Startups")),
    difficulty: difficultyConfig,
    questionCount: questionCountConfig
  })
});

export const WorkerConfigLive = Layer.effect(WorkerConfigService, workerConfig);

export function WorkerConfigTest(config: WorkerConfig) {
  return Layer.succeed(WorkerConfigService, config);
}
