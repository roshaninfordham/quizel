import { Effect, Layer } from "effect";
import { generateQuizQuestions } from "../agents/quizAgents";
import { LlmProviderLive, LlmProviderService } from "../llm/service";
import { WorkerConfigLive, WorkerConfigService } from "./config";

export const QuizGenerationProgram = Effect.gen(function* () {
  const config = yield* WorkerConfigService;
  const provider = yield* LlmProviderService;

  const result = yield* generateQuizQuestions(
    provider,
    {
      timeoutMs: config.llm.timeoutMs,
      maxRetries: config.llm.maxRetries,
      enableSafetyGuard: config.llm.safetyGuardEnabled
    },
    {
      topic: config.demo.topic,
      difficulty: config.demo.difficulty,
      questionCount: config.demo.questionCount
    }
  );

  yield* Effect.logInfo("Quiz generation completed", {
    status: result.status,
    questionCount: result.questions.length,
    topic: config.demo.topic,
    providerName: config.llm.providerName
  });

  return result;
});

export const AgentWorkerLive = Layer.provideMerge(LlmProviderLive, WorkerConfigLive);
