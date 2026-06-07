import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LlmProvider } from "../llm/provider";
import { LlmProviderError } from "../llm/errors";
import { generateQuizQuestions, routeTopic } from "./quizAgents";
import { MockLlmProvider } from "../llm/providers/MockLlmProvider";
import { FallbackSeedProvider } from "../llm/providers/FallbackSeedProvider";
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

class GroundedProvider implements LlmProvider {
  public generateJson<T>(input: Parameters<LlmProvider["generateJson"]>[0]) {
    if (input.schemaName === "QuizQuestionBatch") {
      const prompt = JSON.parse(input.user) as {
        topic: string;
        question_count: number;
        fact_cards: Array<{ factId: string; sourceTitle: string; sourceUrl: string }>;
      };
      const facts = prompt.fact_cards;
      return Effect.succeed({
        questions: Array.from({ length: prompt.question_count }, (_, index) => {
          const fact = facts[index % facts.length];
          return {
            questionText: `Which sourced fact matches ${prompt.topic} #${index + 1}?`,
            options: {
              A: `Fact ${index + 1}`,
              B: `Distractor ${index + 1}`,
              C: `Wrong ${index + 1}`,
              D: `Other ${index + 1}`
            },
            correctOption: "A",
            explanation: `Fact ${index + 1} is supported by the source.`,
            topic: prompt.topic,
            factIds: [fact?.factId],
            sourceTitle: fact?.sourceTitle,
            sourceUrl: fact?.sourceUrl
          };
        })
      } as T);
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    expect(result.events.map((event) => event.eventType)).toContain("fallback_used");
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

  it("grounds generated questions with Firecrawl fact ids when configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              web: [
                {
                  title: "Andaman Islands - Wikipedia",
                  url: "https://en.wikipedia.org/wiki/Andaman_Islands",
                  description:
                    "The Andaman Islands are an archipelago in the northeastern Indian Ocean. Port Blair is the capital of the Andaman and Nicobar Islands.",
                  markdown:
                    "The islands are part of India's Andaman and Nicobar Islands union territory. Barren Island is known for India's only confirmed active volcano."
                }
              ]
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const result = await Effect.runPromise(
      generateQuizQuestions(
        new GroundedProvider(),
        {
          timeoutMs: 100,
          maxRetries: 0,
          grounding: {
            enabled: true,
            apiKey: "fc-test",
            apiBaseUrl: "https://api.firecrawl.dev",
            timeoutMs: 100,
            limit: 2,
            maxFacts: 6,
            country: "US"
          }
        },
        {
          topic: "Andaman",
          questionCount: 5
        }
      )
    );

    expect(result.status).toBe("complete");
    expect(result.topicKey).toContain("andaman");
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.questions.every((question) => question.factIds?.length && question.sourceUrl)).toBe(true);
    expect(result.events.map((event) => event.agentName)).toContain("Firecrawl Grounding Agent");
  });

  it("uses Firecrawl facts for template questions when no LLM provider is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              web: [
                {
                  title: "Quantum sensor overview",
                  url: "https://example.edu/quantum-sensors",
                  description:
                    "Quantum sensors use quantum states to measure physical quantities with high sensitivity. Atomic clocks are a well-known example of quantum sensing technology.",
                  markdown:
                    "Magnetometers can use quantum effects to detect tiny magnetic fields. Quantum sensing is used in navigation, timing, and precision measurement."
                }
              ]
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const result = await Effect.runPromise(
      generateQuizQuestions(
        new FallbackSeedProvider(),
        {
          timeoutMs: 100,
          maxRetries: 0,
          grounding: {
            enabled: true,
            apiKey: "fc-test",
            apiBaseUrl: "https://api.firecrawl.dev",
            timeoutMs: 100,
            limit: 2,
            maxFacts: 6,
            country: "US"
          }
        },
        {
          topic: "quantum sensors",
          questionCount: 5
        }
      )
    );

    const joined = result.questions.map((question) => `${question.questionText} ${question.options.A} ${question.explanation}`).join(" ");
    expect(result.status).toBe("complete");
    expect(result.facts.length).toBeGreaterThan(0);
    expect(joined).toMatch(/quantum|sensor|magnetometer|atomic/i);
    expect(joined).not.toMatch(/Red Planet|Romeo|photosynthesis/i);
    expect(result.questions.every((question) => question.factIds?.length && question.sourceUrl)).toBe(true);
  });
});
