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
        fixedQuestions: demoQuestions.slice(0, 5)
      } as T);
    }

    if (input.schemaName === "TopicRouter") {
      return Effect.succeed({
        selected_topic: "AI + Space + Startups",
        reason: "Most players selected AI, Space, and Startups.",
        topic_weights: [
          { topic: "AI", weight: 0.44 },
          { topic: "Space", weight: 0.31 },
          { topic: "Startups", weight: 0.25 }
        ]
      } as T);
    }

    if (input.schemaName === "HostCommentary") {
      return Effect.succeed({
        commentary: "Ranks just jumped from committed answers. The race is live.",
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
        summary: "The room learned how reducers, realtime subscriptions, and AI fallbacks keep a live tournament fair.",
        hardestConcepts: ["reducer-owned state", "event-ledger replay"],
        nextQuizRecommendation: "Try a deeper realtime systems quiz next."
      } as T);
    }

    return Effect.succeed({
      questions: demoQuestions.slice(0, 5)
    } as T);
  }
}
