import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../llm/provider";
import { LlmProviderError } from "../llm/errors";
import { generateQuizQuestions, routeTopic } from "./quizAgents";
import { MockLlmProvider } from "../llm/providers/MockLlmProvider";
import { demoQuestions } from "../fallbacks/demoQuestions";

class FailingProvider implements LlmProvider {
  public generateJson<T>() {
    return Effect.fail(new LlmProviderError("Missing LLM_API_KEY")) as Effect.Effect<T, LlmProviderError>;
  }
}

class MalformedProvider implements LlmProvider {
  public generateJson<T>() {
    return Effect.succeed({ nope: true } as T);
  }
}

class NativeSafetyProvider implements LlmProvider {
  public generateJson<T>(input: Parameters<LlmProvider["generateJson"]>[0]) {
    if (input.schemaName === "QuizQuestionBatch") {
      return Effect.succeed({ questions: demoQuestions.slice(0, 5) } as T);
    }
    if (input.schemaName === "SafetyGuardReview") {
      return Effect.succeed({ "User Safety": "safe", "Response Safety": "safe" } as T);
    }
    if (input.schemaName === "FairnessReview") {
      return Effect.succeed({
        approved: true,
        rejectedCount: 0,
        issues: [],
        fixedQuestions: []
      } as T);
    }
    return Effect.succeed({} as T);
  }
}

describe("agent fallback behavior", () => {
  it("routes crowd topic votes into a selected tournament topic", async () => {
    const result = await Effect.runPromise(
      routeTopic(new MockLlmProvider(), { timeoutMs: 100, maxRetries: 0 }, {
        topicCounts: [
          { topic: "AI", count: 8, percent: 44 },
          { topic: "Space", count: 6, percent: 33 }
        ],
        defaultTopic: "AI + Space + Startups"
      })
    );

    expect(result.status).toBe("complete");
    expect(result.selectedTopic).toContain("AI");
  });

  it("missing LLM_API_KEY triggers topic-specific fallback questions", async () => {
    const result = await Effect.runPromise(
      generateQuizQuestions(new FailingProvider(), { timeoutMs: 100, maxRetries: 0 }, {
        topic: "US Visa System",
        questionCount: 5
      })
    );

    expect(result.status).toBe("fallback");
    expect(result.questions).toHaveLength(5);
    expect(result.questions[0]?.topic).toBe("US Visa System");
    expect(result.questions.map((question) => question.questionText).join(" ").toLowerCase()).toContain("visa");
    expect(result.events[0]?.eventType).toBe("fallback_used");
  });

  it("malformed LLM JSON triggers topic-specific fallback questions", async () => {
    const result = await Effect.runPromise(
      generateQuizQuestions(new MalformedProvider(), { timeoutMs: 100, maxRetries: 0 }, {
        topic: "US Visa System",
        questionCount: 5
      })
    );

    expect(result.status).toBe("fallback");
    expect(result.questions).toHaveLength(5);
    expect(result.questions[0]?.questionText.toLowerCase()).toContain("visa");
  });

  it("records Safety Guard approval when guard is enabled", async () => {
    const result = await Effect.runPromise(
      generateQuizQuestions(new MockLlmProvider(), { timeoutMs: 100, maxRetries: 0, enableSafetyGuard: true }, {
        topic: "AI + Space + Startups",
        questionCount: 5
      })
    );

    expect(result.status).toBe("complete");
    expect(result.events.some((event) => event.agentName === "Safety Guard Agent")).toBe(true);
  });

  it("normalizes native safety labels and keeps approved authored questions", async () => {
    const result = await Effect.runPromise(
      generateQuizQuestions(new NativeSafetyProvider(), { timeoutMs: 100, maxRetries: 0, enableSafetyGuard: true }, {
        topic: "AI + Space + Startups",
        questionCount: 5
      })
    );

    expect(result.status).toBe("complete");
    expect(result.questions).toHaveLength(5);
    expect(result.events.map((event) => event.agentName)).toContain("Safety Guard Agent");
  });
});
