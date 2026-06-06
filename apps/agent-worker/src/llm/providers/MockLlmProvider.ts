import { Effect } from "effect";
import { demoQuestions } from "../../fallbacks/demoQuestions";
import type { LlmError } from "../errors";
import type { GenerateJsonInput, LlmProvider } from "../provider";

export class MockLlmProvider implements LlmProvider {
  public generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    if (input.schemaName === "FairnessReview") {
      return Effect.succeed({
        approved: true,
        rejectedCount: 0,
        issues: [],
        fixedQuestions: demoQuestions.slice(0, 3)
      } as T);
    }

    if (input.schemaName === "HostCommentary") {
      return Effect.succeed({
        commentary: "The room moved as one. Fast answers, positive support, and a clean explanation.",
        tone: "excited",
        confidence: 0.9
      } as T);
    }

    if (input.schemaName === "SafetyGuardReview") {
      return Effect.succeed({
        safe: true,
        riskLevel: "low",
        categories: [],
        rationale: "Mock provider content is safe for the public demo."
      } as T);
    }

    if (input.schemaName === "LearningRecap") {
      return Effect.succeed({
        summary: "The room learned how reducers, realtime subscriptions, and AI fallbacks keep a live quiz fair.",
        hardestConcepts: ["reducer-owned state", "capped crowd boost"],
        nextQuizRecommendation: "Try a deeper realtime systems quiz next."
      } as T);
    }

    return Effect.succeed({
      questions: demoQuestions.slice(0, 3)
    } as T);
  }
}
