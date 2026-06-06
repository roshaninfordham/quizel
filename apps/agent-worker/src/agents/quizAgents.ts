import { Duration, Effect, Schedule } from "effect";
import { questionBatchSchema, type Difficulty, type QuestionCount } from "@quizduel/shared";
import type { QuestionInput } from "@quizduel/shared";
import { demoQuestions } from "../fallbacks/demoQuestions";
import { ValidationError, type LlmError } from "../llm/errors";
import type { LlmProvider } from "../llm/provider";
import {
  fairnessReviewPrompt,
  fairnessReviewUserPrompt,
  hostCommentaryPrompt,
  hostCommentaryUserPrompt,
  learningRecapPrompt,
  learningRecapUserPrompt,
  quizAuthorPrompt,
  quizAuthorUserPrompt
} from "../prompts/quizPrompts";
import { fairnessReviewSchema, hostCommentarySchema, learningRecapSchema } from "../schemas/agentSchemas";

export interface AgentConfig {
  timeoutMs: number;
  maxRetries: number;
}

export interface QuizGenerationInput {
  topic: string;
  difficulty: Difficulty;
  questionCount: QuestionCount;
}

export interface QuizGenerationResult {
  questions: QuestionInput[];
  status: "complete" | "fallback";
  events: Array<{
    agentName: string;
    eventType: string;
    content: string;
    confidence: number;
    status: "complete" | "fallback" | "failed";
  }>;
}

export function generateQuizQuestions(
  provider: LlmProvider,
  config: AgentConfig,
  input: QuizGenerationInput
): Effect.Effect<QuizGenerationResult, never> {
  const policy = Schedule.exponential(Duration.millis(250)).pipe(Schedule.compose(Schedule.recurs(config.maxRetries)));

  return provider
    .generateJson<unknown>({
      system: quizAuthorPrompt(),
      user: quizAuthorUserPrompt(input),
      schemaName: "QuizQuestionBatch",
      timeoutMs: config.timeoutMs,
      temperature: 0.4
    })
    .pipe(
      Effect.retry(policy),
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => {
            const parsed = questionBatchSchema.safeParse(payload);
            if (!parsed.success) {
              throw new ValidationError(parsed.error.message);
            }
            return {
              questions: parsed.data.questions.slice(0, input.questionCount),
              status: "complete" as const,
              events: [
                {
                  agentName: "Quiz Author Agent",
                  eventType: "questions_generated",
                  content: `${parsed.data.questions.length} questions generated for ${input.topic}.`,
                  confidence: 0.92,
                  status: "complete" as const
                },
                {
                  agentName: "Fairness Review Agent",
                  eventType: "questions_approved",
                  content: "Schema, option uniqueness, and public-audience guardrails passed.",
                  confidence: 0.96,
                  status: "complete" as const
                }
              ]
            };
          },
          catch: (error): LlmError =>
            error instanceof ValidationError ? error : new ValidationError(error instanceof Error ? error.message : String(error))
        })
      ),
      Effect.flatMap((authored) =>
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
                  if (!parsed.success) {
                    throw new ValidationError(parsed.error.message);
                  }
                  if (!parsed.data.approved && parsed.data.rejectedCount > 0) {
                    throw new ValidationError(`Fairness Review rejected ${parsed.data.rejectedCount} question(s).`);
                  }

                  return {
                    questions: parsed.data.fixedQuestions.slice(0, input.questionCount),
                    status: "complete" as const,
                    events: [
                      authored.events[0],
                      {
                        agentName: "Fairness Review Agent",
                        eventType: "questions_approved",
                        content: parsed.data.issues.length
                          ? `${parsed.data.issues.length} issue(s) repaired before approval.`
                          : "Schema, option uniqueness, ambiguity, and public-audience guardrails passed.",
                        confidence: 0.96,
                        status: "complete" as const
                      }
                    ].filter((event): event is NonNullable<typeof event> => Boolean(event))
                  };
                },
                catch: (error): LlmError =>
                  error instanceof ValidationError
                    ? error
                    : new ValidationError(error instanceof Error ? error.message : String(error))
              })
            )
          )
      ),
      Effect.catchAll((error) =>
        Effect.succeed({
          questions: demoQuestions.slice(0, input.questionCount),
          status: "fallback" as const,
          events: [
            {
              agentName: "Quiz Author Agent",
              eventType: "fallback_used",
              content: `Using deterministic seed questions because ${error.name} occurred.`,
              confidence: 1,
              status: "fallback" as const
            },
            {
              agentName: "Fairness Review Agent",
              eventType: "fallback_approved",
              content: "Seeded demo questions are pre-reviewed for a public hackathon audience.",
              confidence: 1,
              status: "fallback" as const
            }
          ]
        })
      )
    );
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
          commentary: "That round moved fast. The explanation is locked in for the whole room.",
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
            "Based on this match: realtime reducers kept answers fair, capped Crowd support kept scoring balanced, and fallback AI kept the quiz reliable.",
          confidence: 1,
          status: "fallback" as const
        })
      )
    );
}
