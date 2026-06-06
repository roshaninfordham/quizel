import { Config, Context, Layer } from "effect";
import type { Difficulty, QuestionCount } from "@quizduel/shared";

export interface WorkerConfig {
  readonly llm: {
    readonly apiBaseUrl: string;
    readonly apiKey: string;
    readonly modelId: string;
    readonly smallModelId: string;
    readonly providerName: string;
    readonly timeoutMs: number;
    readonly maxRetries: number;
    readonly jsonMode: boolean;
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
    apiBaseUrl: Config.string("LLM_API_BASE_URL").pipe(Config.withDefault("")),
    apiKey: Config.string("LLM_API_KEY").pipe(Config.withDefault("")),
    modelId: Config.string("LLM_MODEL_ID").pipe(Config.withDefault("")),
    smallModelId: Config.string("LLM_SMALL_MODEL_ID").pipe(Config.withDefault("")),
    providerName: Config.string("LLM_PROVIDER_NAME").pipe(Config.withDefault("generic")),
    timeoutMs: Config.integer("LLM_TIMEOUT_MS").pipe(Config.withDefault(12_000)),
    maxRetries: Config.integer("LLM_MAX_RETRIES").pipe(Config.withDefault(2)),
    jsonMode: Config.boolean("LLM_JSON_MODE").pipe(Config.withDefault(true))
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
