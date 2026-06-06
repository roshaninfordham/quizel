import { Effect } from "effect";
import { demoQuestions } from "../../fallbacks/demoQuestions";
import type { LlmError } from "../errors";
import type { GenerateJsonInput, LlmProvider } from "../provider";

export class FallbackSeedProvider implements LlmProvider {
  public generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    if (input.schemaName === "FairnessReview") {
      return Effect.succeed({
        approved: true,
        rejectedCount: 0,
        issues: [],
        fixedQuestions: demoQuestions
      } as T);
    }

    if (input.schemaName === "HostCommentary") {
      return Effect.succeed({
        commentary: "Great round. The room answered, cheered, and stayed synced live.",
        tone: "encouraging",
        confidence: 1
      } as T);
    }

    if (input.schemaName === "SafetyGuardReview") {
      return Effect.succeed({
        safe: true,
        riskLevel: "low",
        categories: [],
        rationale: "Seeded demo content is pre-reviewed for the public hackathon demo."
      } as T);
    }

    if (input.schemaName === "LearningRecap") {
      return Effect.succeed({
        summary:
          "Based on this match, the room saw how realtime reducers keep answers, Energy, scoring, and leaderboards consistent.",
        hardestConcepts: ["server-authoritative timing", "capped crowd boost", "schema-validated AI output"],
        nextQuizRecommendation: "Try a deeper realtime systems quiz next."
      } as T);
    }

    return Effect.succeed({
      questions: demoQuestions
    } as T);
  }
}
