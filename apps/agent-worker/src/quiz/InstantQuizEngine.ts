import { Duration, Effect } from "effect";
import {
  buildTopicFallbackQuestions,
  normalizeIntent,
  questionBatchSchema,
  QUESTION_COUNT,
  topicKeyPart,
  type NormalizedIntent,
  type QuestionInput
} from "@quizrush/shared";
import { quizAuthorPrompt, quizAuthorUserPrompt } from "../prompts/quizPrompts";
import { ValidationError, type LlmError } from "../llm/errors";
import type { LlmProvider } from "../llm/provider";
import { cachedQuizPacks, type CachedQuizPack } from "./packs";

export type InstantPackSource = "exact_cache" | "alias_cache" | "semantic_cache" | "template" | "llm" | "seed";

export interface InstantQuizPack {
  packId: string;
  arenaName: string;
  topics: string[];
  difficulty: string;
  sourceType: InstantPackSource;
  confidence: number;
  questions: QuestionInput[];
  latencyMs: number;
}

export interface InstantQuizInput {
  topic: string;
  questionCount?: number;
}

export interface InstantQuizConfig {
  timeoutMs: number;
  includeLlm?: boolean;
}

export function selectInstantQuizPack(
  provider: LlmProvider,
  config: InstantQuizConfig,
  input: InstantQuizInput
): Effect.Effect<InstantQuizPack, never> {
  const started = Date.now();
  const parsed = normalizeIntent(input.topic);
  const questionCount = input.questionCount ?? QUESTION_COUNT;
  const effects: Array<Effect.Effect<InstantQuizPack, LlmError>> = [
    exactCacheLookup(parsed, questionCount, started).pipe(Effect.delay(Duration.millis(0))),
    aliasCacheLookup(parsed, questionCount, started).pipe(Effect.delay(Duration.millis(8))),
    semanticCacheLookup(parsed, questionCount, started).pipe(Effect.delay(Duration.millis(16))),
    templatePackGenerator(parsed, questionCount, started).pipe(Effect.delay(Duration.millis(35))),
    seedFallbackPack(parsed, questionCount, started).pipe(Effect.delay(Duration.millis(80)))
  ];

  if (config.includeLlm) {
    effects.splice(
      4,
      0,
      llmCustomPack(provider, parsed, questionCount, started, config.timeoutMs).pipe(
        Effect.timeout(Duration.millis(Math.max(250, config.timeoutMs))),
        Effect.mapError((error) => new ValidationError(String(error)))
      )
    );
  }

  return Effect.raceAll(effects).pipe(
    Effect.catchAll(() => seedFallbackPack(parsed, questionCount, started)),
    Effect.orDie
  );
}

export function exactCacheLookup(parsed: NormalizedIntent, questionCount: number, started = Date.now()): Effect.Effect<InstantQuizPack, ValidationError> {
  const pack = cachedQuizPacks.find((candidate) => candidate.topicKey === parsed.topicKey);
  if (!pack) return Effect.fail(new ValidationError(`No exact cache pack for ${parsed.topicKey}.`));
  return Effect.succeed(packFromCache(pack, parsed, questionCount, "exact_cache", 0.98, started));
}

export function aliasCacheLookup(parsed: NormalizedIntent, questionCount: number, started = Date.now()): Effect.Effect<InstantQuizPack, ValidationError> {
  const tokens = tokensFor(parsed.cleanedText || parsed.displayArenaName);
  const pack = cachedQuizPacks.find((candidate) =>
    candidate.aliases.some((alias) => tokens.has(topicKeyPart(alias).replace(/_/g, " "))) ||
    candidate.tags.some((tag) => parsed.canonicalTopics.some((topic) => topicKeyPart(topic) === topicKeyPart(tag)))
  );
  if (!pack) return Effect.fail(new ValidationError(`No alias cache pack for ${parsed.displayArenaName}.`));
  return Effect.succeed(packFromCache(pack, parsed, questionCount, "alias_cache", 0.9, started));
}

export function semanticCacheLookup(parsed: NormalizedIntent, questionCount: number, started = Date.now()): Effect.Effect<InstantQuizPack, ValidationError> {
  const query = tokensFor(`${parsed.cleanedText} ${parsed.canonicalTopics.join(" ")}`);
  let best: { pack: CachedQuizPack; score: number } | null = null;

  for (const pack of cachedQuizPacks) {
    const haystack = tokensFor(`${pack.title} ${pack.aliases.join(" ")} ${pack.tags.join(" ")} ${pack.questions.map((question) => question.questionText).join(" ")}`);
    const score = overlapScore(query, haystack);
    if (!best || score > best.score) best = { pack, score };
  }

  if (!best || best.score < 0.24) return Effect.fail(new ValidationError(`No semantic cache pack for ${parsed.displayArenaName}.`));
  return Effect.succeed(packFromCache(best.pack, parsed, questionCount, "semantic_cache", Math.min(0.86, 0.62 + best.score), started));
}

export function templatePackGenerator(parsed: NormalizedIntent, questionCount: number, started = Date.now()): Effect.Effect<InstantQuizPack, ValidationError> {
  return validatePack({
    packId: `template:${parsed.topicKey}`,
    arenaName: parsed.displayArenaName,
    topics: parsed.canonicalTopics,
    difficulty: parsed.difficultyHint,
    sourceType: "template",
    confidence: 0.72,
    questions: buildTopicFallbackQuestions(parsed.displayArenaName, questionCount),
    latencyMs: Date.now() - started
  });
}

export function seedFallbackPack(parsed: NormalizedIntent, questionCount: number, started = Date.now()): Effect.Effect<InstantQuizPack, ValidationError> {
  return validatePack({
    packId: `seed:${parsed.topicKey}`,
    arenaName: parsed.displayArenaName,
    topics: parsed.canonicalTopics,
    difficulty: parsed.difficultyHint,
    sourceType: "seed",
    confidence: 1,
    questions: buildTopicFallbackQuestions(parsed.displayArenaName, questionCount),
    latencyMs: Date.now() - started
  });
}

function llmCustomPack(
  provider: LlmProvider,
  parsed: NormalizedIntent,
  questionCount: number,
  started: number,
  timeoutMs: number
): Effect.Effect<InstantQuizPack, LlmError> {
  return provider
    .generateJson<unknown>({
      system: quizAuthorPrompt(),
      user: quizAuthorUserPrompt({ topic: parsed.displayArenaName, questionCount }),
      schemaName: "QuizQuestionBatch",
      timeoutMs,
      temperature: 0.28
    })
    .pipe(
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => {
            const parsedBatch = questionBatchSchema.parse(normalizeQuestionBatchPayload(payload));
            return {
              packId: `llm:${parsed.topicKey}`,
              arenaName: parsed.displayArenaName,
              topics: parsed.canonicalTopics,
              difficulty: parsed.difficultyHint,
              sourceType: "llm" as const,
              confidence: 0.92,
              questions: parsedBatch.questions.slice(0, questionCount),
              latencyMs: Date.now() - started
            };
          },
          catch: (error): LlmError => new ValidationError(error instanceof Error ? error.message : String(error))
        })
      ),
      Effect.flatMap(validatePack)
    );
}

function packFromCache(
  pack: CachedQuizPack,
  parsed: NormalizedIntent,
  questionCount: number,
  sourceType: InstantPackSource,
  confidence: number,
  started: number
): InstantQuizPack {
  return {
    packId: `${sourceType}:${pack.topicKey}`,
    arenaName: pack.title,
    topics: parsed.canonicalTopics,
    difficulty: parsed.difficultyHint,
    sourceType,
    confidence,
    questions: takeQuestions(pack.questions, questionCount),
    latencyMs: Date.now() - started
  };
}

function validatePack(pack: InstantQuizPack): Effect.Effect<InstantQuizPack, ValidationError> {
  const parsed = questionBatchSchema.safeParse({ questions: pack.questions });
  if (!parsed.success) return Effect.fail(new ValidationError(parsed.error.message));
  return Effect.succeed({ ...pack, questions: parsed.data.questions });
}

function takeQuestions(questions: QuestionInput[], questionCount: number): QuestionInput[] {
  const selected: QuestionInput[] = [];
  for (let index = 0; index < questionCount; index += 1) {
    const question = questions[index % questions.length];
    if (question) selected.push(question);
  }
  return selected;
}

function tokensFor(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1)
  );
}

function overlapScore(query: Set<string>, haystack: Set<string>): number {
  if (!query.size || !haystack.size) return 0;
  let hits = 0;
  for (const token of query) {
    if (haystack.has(token)) hits += 1;
  }
  return hits / Math.max(1, query.size);
}

function normalizeQuestionBatchPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) return { questions: payload.map(normalizeQuestionInput) };
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.questions)) return payload;
  return { questions: record.questions.map(normalizeQuestionInput) };
}

function normalizeQuestionInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const record = input as Record<string, unknown>;
  return {
    questionText: record.questionText ?? record.question_text ?? record.question,
    options: normalizeOptions(record.options),
    correctOption: record.correctOption ?? record.correct_option ?? record.correct,
    explanation: record.explanation,
    topic: record.topic ?? parsedTopic(record.topic_tags) ?? "General Knowledge"
  };
}

function normalizeOptions(options: unknown): unknown {
  if (Array.isArray(options)) return { A: options[0], B: options[1], C: options[2], D: options[3] };
  return options;
}

function parsedTopic(value: unknown): string | undefined {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}
