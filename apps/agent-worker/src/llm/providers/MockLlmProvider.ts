import { Effect } from "effect";
import { buildTopicFallbackQuestions } from "@quizrush/shared";
import type { LlmError } from "../errors";
import type { GenerateJsonInput, LlmProvider } from "../provider";

export class MockLlmProvider implements LlmProvider {
  public generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    const topic = topicFromInput(input);
    const questions = buildTopicFallbackQuestions(topic, questionCountFromInput(input));

    if (input.schemaName === "FairnessReview") {
      return Effect.succeed({
        approved: true,
        rejectedCount: 0,
        issues: [],
        fixedQuestions: []
      } as T);
    }

    if (input.schemaName === "TopicRouter") {
      return Effect.succeed({
        selected_topic: topic,
        reason: `Most live expertise signals point to ${topic}.`,
        topic_weights: [{ topic, weight: 1 }]
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
      questions
    } as T);
  }
}

function topicFromInput(input: GenerateJsonInput): string {
  try {
    const parsed = JSON.parse(input.user) as { topic?: string; default_topic?: string; topic_counts?: Array<{ topic?: string }> };
    return parsed.topic || parsed.default_topic || parsed.topic_counts?.[0]?.topic || "General Knowledge";
  } catch {
    return "General Knowledge";
  }
}

function questionCountFromInput(input: GenerateJsonInput): number {
  try {
    const parsed = JSON.parse(input.user) as { question_count?: number };
    return parsed.question_count || 7;
  } catch {
    return 7;
  }
}
