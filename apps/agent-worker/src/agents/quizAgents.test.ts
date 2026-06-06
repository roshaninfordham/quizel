import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../llm/provider";
import { LlmProviderError } from "../llm/errors";
import { generateQuizQuestions } from "./quizAgents";
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
      return Effect.succeed({ questions: demoQuestions.slice(0, 3) } as T);
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
  it("missing LLM_API_KEY triggers fallback seed questions", async () => {
    const result = await Effect.runPromise(
      generateQuizQuestions(new FailingProvider(), { timeoutMs: 100, maxRetries: 0 }, {
        topic: "AI + Space + Startups",
        difficulty: "beginner",
        questionCount: 3
      })
    );

    expect(result.status).toBe("fallback");
    expect(result.questions).toHaveLength(3);
    expect(result.events[0]?.eventType).toBe("fallback_used");
  });

  it("malformed LLM JSON triggers fallback seed questions", async () => {
    const result = await Effect.runPromise(
      generateQuizQuestions(new MalformedProvider(), { timeoutMs: 100, maxRetries: 0 }, {
        topic: "AI + Space + Startups",
        difficulty: "beginner",
        questionCount: 3
      })
    );

    expect(result.status).toBe("fallback");
    expect(result.questions[0]?.questionText).toContain("SpacetimeDB");
  });

  it("records Safety Guard approval when guard is enabled", async () => {
    const result = await Effect.runPromise(
      generateQuizQuestions(new MockLlmProvider(), { timeoutMs: 100, maxRetries: 0, enableSafetyGuard: true }, {
        topic: "AI + Space + Startups",
        difficulty: "beginner",
        questionCount: 3
      })
    );

    expect(result.status).toBe("complete");
    expect(result.events.some((event) => event.agentName === "Safety Guard Agent")).toBe(true);
  });

  it("normalizes native safety labels and keeps approved authored questions", async () => {
    const result = await Effect.runPromise(
      generateQuizQuestions(new NativeSafetyProvider(), { timeoutMs: 100, maxRetries: 0, enableSafetyGuard: true }, {
        topic: "AI + Space + Startups",
        difficulty: "beginner",
        questionCount: 3
      })
    );

    expect(result.status).toBe("complete");
    expect(result.questions).toHaveLength(3);
    expect(result.events.map((event) => event.agentName)).toContain("Safety Guard Agent");
  });
});
