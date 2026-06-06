import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../llm/provider";
import { LlmProviderError } from "../llm/errors";
import { generateQuizQuestions } from "./quizAgents";

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
});
