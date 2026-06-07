import { Duration, Effect, Schedule } from "effect";
import { buildTopicFallbackQuestions, DEFAULT_SELECTED_TOPIC, QUESTION_COUNT, normalizeIntent, questionBatchSchema } from "@quizrush/shared";
import type { QuestionInput } from "@quizrush/shared";
import { ValidationError, type LlmError } from "../llm/errors";
import type { LlmProvider } from "../llm/provider";
import { fetchFirecrawlFacts, type FirecrawlGroundingConfig, type GroundingFact } from "../knowledge/firecrawl";
import {
  fairnessReviewPrompt,
  fairnessReviewUserPrompt,
  hostCommentaryPrompt,
  hostCommentaryUserPrompt,
  learningRecapPrompt,
  learningRecapUserPrompt,
  quizAuthorPrompt,
  quizAuthorUserPrompt,
  safetyGuardPrompt,
  safetyGuardUserPrompt,
  topicRouterPrompt,
  topicRouterUserPrompt
} from "../prompts/quizPrompts";
import {
  fairnessReviewSchema,
  hostCommentarySchema,
  learningRecapSchema,
  safetyGuardReviewSchema,
  topicRouterSchema
} from "../schemas/agentSchemas";
import { validateGroundedQuestionPack } from "../quiz/validateQuestionPack";
import { buildTemplateGroundedQuestions } from "../quiz/templateGroundedQuestions";

export interface AgentConfig {
  timeoutMs: number;
  maxRetries: number;
  enableSafetyGuard?: boolean;
  grounding?: FirecrawlGroundingConfig;
}

export interface AgentEventDraft {
  agentName: string;
  eventType: string;
  content: string;
  confidence: number;
  status: "complete" | "fallback" | "failed";
}

export interface TopicRoutingInput {
  topicCounts: Array<{ topic: string; count: number; percent: number }>;
  defaultTopic?: string;
}

export interface TopicRoutingResult {
  selectedTopic: string;
  status: "complete" | "fallback";
  event: AgentEventDraft;
}

export interface QuizGenerationInput {
  topic: string;
  questionCount?: number;
}

export interface QuizGenerationResult {
  questions: QuestionInput[];
  status: "complete" | "fallback";
  events: AgentEventDraft[];
  facts: GroundingFact[];
  topicKey: string;
}

export function routeTopic(
  provider: LlmProvider,
  config: AgentConfig,
  input: TopicRoutingInput
): Effect.Effect<TopicRoutingResult, never> {
  const policy = Schedule.exponential(Duration.millis(200)).pipe(Schedule.compose(Schedule.recurs(config.maxRetries)));
  const fallbackTopic = fallbackTopicFromCounts(input.topicCounts, input.defaultTopic ?? DEFAULT_SELECTED_TOPIC);

  return provider
    .generateJson<unknown>({
      system: topicRouterPrompt(),
      user: topicRouterUserPrompt({
        topicCounts: input.topicCounts,
        defaultTopic: input.defaultTopic ?? DEFAULT_SELECTED_TOPIC
      }),
      schemaName: "TopicRouter",
      timeoutMs: config.timeoutMs,
      temperature: 0.2
    })
    .pipe(
      Effect.retry(policy),
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => {
            const parsed = topicRouterSchema.parse(payload);
            const selectedTopic = normalizeIntent(parsed.selected_topic).displayArenaName;
            return {
              selectedTopic,
              status: "complete" as const,
              event: {
                agentName: "Topic Router Agent",
                eventType: "topic_selected",
                content: `${parsed.reason} Arena normalized to ${selectedTopic}.`,
                confidence: 0.9,
                status: "complete" as const
              }
            };
          },
          catch: (error): LlmError => new ValidationError(error instanceof Error ? error.message : String(error))
        })
      ),
      Effect.catchAll((error) =>
        Effect.succeed({
          selectedTopic: fallbackTopic,
          status: "fallback" as const,
          event: {
            agentName: "Topic Router Agent",
            eventType: "topic_fallback",
            content: `Using deterministic topic "${fallbackTopic}" because ${error.name} occurred.`,
            confidence: 1,
            status: "fallback" as const
          }
        })
      )
    );
}

export function generateQuizQuestions(
  provider: LlmProvider,
  config: AgentConfig,
  input: QuizGenerationInput
): Effect.Effect<QuizGenerationResult, never> {
  const policy = Schedule.exponential(Duration.millis(250)).pipe(Schedule.compose(Schedule.recurs(config.maxRetries)));
  const requestedCount = input.questionCount ?? QUESTION_COUNT;

  return fetchGroundingFacts(config, input.topic)
    .pipe(
      Effect.flatMap((grounding) =>
        provider
          .generateJson<unknown>({
            system: quizAuthorPrompt(),
            user: quizAuthorUserPrompt({
              topic: grounding.displayName,
              questionCount: requestedCount,
              facts: grounding.facts.map((fact) => ({
                factId: fact.factId,
                sourceTitle: fact.sourceTitle,
                sourceUrl: fact.sourceUrl,
                factText: fact.factText,
                confidence: fact.confidence
              }))
            }),
            schemaName: "QuizQuestionBatch",
            timeoutMs: config.timeoutMs,
            temperature: grounding.facts.length ? 0.18 : 0.35
          })
          .pipe(Effect.map((payload) => ({ payload, grounding })))
      )
    )
    .pipe(
      Effect.retry(policy),
      Effect.flatMap(({ payload, grounding }) =>
        Effect.try({
          try: () => {
            const parsed = questionBatchSchema.safeParse(normalizeQuestionBatchPayload(payload));
            if (!parsed.success) throw new ValidationError(parsed.error.message);
            const validation = validateGroundedQuestionPack({
              questions: parsed.data.questions,
              topic: grounding.displayName,
              requireFactIds: grounding.facts.length > 0
            });
            if (!validation.ok) throw new ValidationError(validation.reasons.join("; "));
            return {
              questions: validation.questions.slice(0, requestedCount),
              status: "complete" as const,
              events: [
                grounding.event,
                {
                  agentName: "Quiz Builder Agent",
                  eventType: "questions_generated",
                  content: `${parsed.data.questions.length} fast grounded questions generated for ${grounding.displayName}.`,
                  confidence: 0.92,
                  status: "complete" as const
                }
              ].filter((event): event is AgentEventDraft => Boolean(event)),
              facts: grounding.facts,
              topicKey: grounding.topicKey
            };
          },
          catch: (error): LlmError =>
            error instanceof ValidationError ? error : new ValidationError(error instanceof Error ? error.message : String(error))
        })
      ),
      Effect.flatMap((authored) =>
        runSafetyGuard(provider, config, policy, authored.questions).pipe(
          Effect.flatMap((safetyEvent) =>
            provider
              .generateJson<unknown>({
                system: fairnessReviewPrompt(),
                user: fairnessReviewUserPrompt({ questions: authored.questions }),
                schemaName: "FairnessReview",
                timeoutMs: config.timeoutMs,
                temperature: 0.1
              })
              .pipe(
                Effect.retry(policy),
                Effect.flatMap((payload) =>
                  Effect.try({
                    try: () => {
                      const parsed = fairnessReviewSchema.safeParse(payload);
                      if (!parsed.success) throw new ValidationError(parsed.error.message);
                      if (!parsed.data.approved && parsed.data.rejectedCount > 0) {
                        throw new ValidationError(`Fairness Agent rejected ${parsed.data.rejectedCount} question(s).`);
                      }

                      const reviewedQuestions = parsed.data.fixedQuestions.length ? parsed.data.fixedQuestions : authored.questions;
                      return {
                        questions: reviewedQuestions.slice(0, requestedCount),
                        status: "complete" as const,
                        events: [
                          ...authored.events,
                          safetyEvent,
                          {
                            agentName: "Fairness Agent",
                            eventType: "questions_approved",
                            content: parsed.data.issues.length
                              ? `${parsed.data.issues.length} issue(s) repaired before approval.`
                              : "Question length, ambiguity, option uniqueness, and safety guardrails passed.",
                            confidence: 0.96,
                            status: "complete" as const
                          }
                        ].filter((event): event is AgentEventDraft => Boolean(event)),
                        facts: authored.facts,
                        topicKey: authored.topicKey
                      };
                    },
                    catch: (error): LlmError =>
                      error instanceof ValidationError
                        ? error
                        : new ValidationError(error instanceof Error ? error.message : String(error))
                  })
                )
              )
          )
        )
      ),
      Effect.catchAll((error) =>
        fetchGroundingFacts(config, input.topic).pipe(
          Effect.map((grounding) => {
            const groundedTemplate = grounding.facts.length
              ? buildTemplateGroundedQuestions(grounding.displayName, grounding.facts, requestedCount)
              : [];
            return {
              questions: groundedTemplate.length
                ? groundedTemplate
                : buildTopicFallbackQuestions(grounding.displayName, requestedCount),
              status: "fallback" as const,
              events: [
                grounding.event,
                {
                  agentName: "Quiz Builder Agent",
                  eventType: groundedTemplate.length ? "template_grounded_fallback_used" : "fallback_used",
                  content: groundedTemplate.length
                    ? `Using ${groundedTemplate.length} source-backed template questions for ${grounding.displayName} because ${error.name} occurred.`
                    : `Using deterministic ${grounding.displayName} questions because ${error.name} occurred.`,
                  confidence: groundedTemplate.length ? 0.84 : 1,
                  status: "fallback" as const
                },
                {
                  agentName: "Fairness Agent",
                  eventType: "fallback_approved",
                  content: groundedTemplate.length
                    ? "Template-grounded fallback questions cite compact retrieved facts."
                    : "Topic-specific fallback questions are schema-valid and pre-reviewed for a public hackathon audience.",
                  confidence: 1,
                  status: "fallback" as const
                }
              ].filter((event): event is AgentEventDraft => Boolean(event)),
              facts: grounding.facts,
              topicKey: grounding.topicKey
            };
          })
        )
      )
    );
}

function fetchGroundingFacts(
  config: AgentConfig,
  topic: string
): Effect.Effect<{
  topicKey: string;
  displayName: string;
  facts: GroundingFact[];
  event: AgentEventDraft | null;
}, never> {
  const normalized = normalizeIntent(topic);
  const fallback = {
    topicKey: normalized.topicKey,
    displayName: normalized.displayArenaName,
    facts: [] as GroundingFact[],
    event: {
      agentName: "Firecrawl Grounding Agent",
      eventType: "grounding_skipped",
      content: "No Firecrawl facts were available before the generation deadline.",
      confidence: 0.35,
      status: "fallback" as const
    }
  };

  if (!config.grounding?.enabled) return Effect.succeed(fallback);

  return fetchFirecrawlFacts(config.grounding, topic).pipe(
    Effect.map((result) => ({
      topicKey: result.topicKey,
      displayName: result.displayName,
      facts: result.facts,
      event: {
        agentName: "Firecrawl Grounding Agent",
        eventType: "facts_ready",
        content: `${result.facts.length} Firecrawl facts ready for ${result.displayName}${result.creditsUsed === null ? "" : ` (${result.creditsUsed} credits)`}.`,
        confidence: 0.88,
        status: "complete" as const
      }
    })),
    Effect.catchAll((error) =>
      Effect.succeed({
        ...fallback,
        event: {
          ...fallback.event,
          content: `Firecrawl fallback for ${normalized.displayArenaName}: ${error.message}`
        }
      })
    )
  );
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
  const options = normalizeOptions(record.options);
  return {
    questionText: record.questionText ?? record.question_text ?? record.question,
    options,
    correctOption: record.correctOption ?? record.correct_option ?? record.correct,
    explanation: record.explanation,
    topic: record.topic ?? record.topicTag ?? record.topic_tag ?? DEFAULT_SELECTED_TOPIC,
    factIds: record.factIds ?? record.fact_ids,
    sourceTitle: record.sourceTitle ?? record.source_title,
    sourceUrl: record.sourceUrl ?? record.source_url
  };
}

function normalizeOptions(options: unknown): unknown {
  if (Array.isArray(options)) {
    return { A: options[0], B: options[1], C: options[2], D: options[3] };
  }
  return options;
}

function fallbackTopicFromCounts(topicCounts: TopicRoutingInput["topicCounts"], defaultTopic: string): string {
  if (!topicCounts.length) return defaultTopic;
  return topicCounts
    .slice()
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, 3)
    .map((row) => row.topic)
    .join(" + ");
}

function runSafetyGuard(
  provider: LlmProvider,
  config: AgentConfig,
  policy: Schedule.Schedule<unknown, LlmError, never>,
  questions: QuestionInput[]
): Effect.Effect<AgentEventDraft | null, LlmError> {
  if (!config.enableSafetyGuard) return Effect.succeed(null);

  return provider
    .generateJson<unknown>({
      system: safetyGuardPrompt(),
      user: safetyGuardUserPrompt({ questions }),
      schemaName: "SafetyGuardReview",
      timeoutMs: config.timeoutMs,
      temperature: 0
    })
    .pipe(
      Effect.retry(policy),
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => {
            const parsed = safetyGuardReviewSchema.safeParse(normalizeSafetyGuardPayload(payload));
            if (!parsed.success) throw new ValidationError(parsed.error.message);
            if (!parsed.data.safe || parsed.data.riskLevel === "high") {
              throw new ValidationError(`Safety Guard rejected generated questions: ${parsed.data.rationale}`);
            }

            return {
              agentName: "Safety Guard Agent",
              eventType: "content_approved",
              content: `Safety Guard approved content as ${parsed.data.riskLevel} risk.`,
              confidence: 0.95,
              status: "complete" as const
            };
          },
          catch: (error): LlmError =>
            error instanceof ValidationError ? error : new ValidationError(error instanceof Error ? error.message : String(error))
        })
      )
    );
}

function normalizeSafetyGuardPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const record = payload as Record<string, unknown>;
  if ("safe" in record || "riskLevel" in record) return payload;

  const labels = [record["User Safety"], record["Response Safety"], record.userSafety, record.responseSafety]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
  if (labels.length === 0) return payload;

  const safe = labels.every((label) => label === "safe");
  return {
    safe,
    riskLevel: safe ? "low" : "high",
    categories: safe ? [] : labels,
    rationale: safe ? "Safety Guard classified the prompt and response as safe." : "Safety Guard flagged generated content."
  };
}

export function generateHostCommentary(
  provider: LlmProvider,
  config: AgentConfig,
  input: unknown
): Effect.Effect<{ commentary: string; confidence: number; status: "complete" | "fallback" }, never> {
  return provider
    .generateJson<unknown>({
      system: hostCommentaryPrompt(),
      user: hostCommentaryUserPrompt(input),
      schemaName: "HostCommentary",
      timeoutMs: config.timeoutMs,
      temperature: 0.5
    })
    .pipe(
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => hostCommentarySchema.parse(payload),
          catch: (error) => new ValidationError(error instanceof Error ? error.message : String(error))
        })
      ),
      Effect.map((parsed) => ({
        commentary: parsed.commentary,
        confidence: parsed.confidence,
        status: "complete" as const
      })),
      Effect.catchAll(() =>
        Effect.succeed({
          commentary: "Ranks just shifted from committed answers. The room is live.",
          confidence: 1,
          status: "fallback" as const
        })
      )
    );
}

export function generateLearningRecap(
  provider: LlmProvider,
  config: AgentConfig,
  input: unknown
): Effect.Effect<{ summary: string; confidence: number; status: "complete" | "fallback" }, never> {
  return provider
    .generateJson<unknown>({
      system: learningRecapPrompt(),
      user: learningRecapUserPrompt(input),
      schemaName: "LearningRecap",
      timeoutMs: config.timeoutMs,
      temperature: 0.3
    })
    .pipe(
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => learningRecapSchema.parse(payload),
          catch: (error) => new ValidationError(error instanceof Error ? error.message : String(error))
        })
      ),
      Effect.map((parsed) => ({
        summary: `${parsed.summary} Next quiz: ${parsed.nextQuizRecommendation}`,
        confidence: 0.9,
        status: "complete" as const
      })),
      Effect.catchAll(() =>
        Effect.succeed({
          summary:
            "Based on this match: the room answered fastest on the core realtime questions, and the event ledger made every rank jump replayable.",
          confidence: 1,
          status: "fallback" as const
        })
      )
    );
}
