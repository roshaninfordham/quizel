import { Duration, Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../llm/provider";
import { LlmProviderError } from "../llm/errors";
import { selectInstantQuizPack } from "./InstantQuizEngine";

class SlowFailingProvider implements LlmProvider {
  public generateJson<T>() {
    return Effect.sleep(Duration.millis(250)).pipe(
      Effect.zipRight(Effect.fail(new LlmProviderError("provider timed out")))
    ) as Effect.Effect<T, LlmProviderError>;
  }
}

class FastCustomProvider implements LlmProvider {
  public generateJson<T>() {
    return Effect.succeed({
      questions: Array.from({ length: 7 }, (_, index) => ({
        question_text: `Custom visa sprint question ${index + 1}?`,
        options: {
          A: "Correct",
          B: "Wrong one",
          C: "Wrong two",
          D: "Wrong three"
        },
        correct_option: "A",
        explanation: "This is a short validated explanation.",
        topic: "US Visa System"
      }))
    } as T);
  }
}

describe("InstantQuizEngine", () => {
  it("returns an exact cache pack for US visa system before generic fallback", async () => {
    const pack = await Effect.runPromise(
      selectInstantQuizPack(new SlowFailingProvider(), { timeoutMs: 50 }, {
        topic: "US visa system",
        questionCount: 7
      })
    );

    expect(pack.sourceType).toBe("exact_cache");
    expect(pack.arenaName).toBe("US Visa System");
    expect(pack.questions[0]?.questionText.toLowerCase()).toContain("visa");
    expect(pack.questions.map((question) => question.questionText).join(" ")).not.toContain("SpacetimeDB");
  });

  it("dedupes speech-like fruit input into a fruit science pack", async () => {
    const pack = await Effect.runPromise(
      selectInstantQuizPack(new SlowFailingProvider(), { timeoutMs: 50 }, {
        topic: "Fruit Fruits Fruits",
        questionCount: 7
      })
    );

    expect(pack.sourceType).toBe("exact_cache");
    expect(pack.arenaName).toBe("Fruit Science");
    expect(pack.questions[0]?.questionText.toLowerCase()).toContain("fruit");
  });

  it("uses a deterministic template for weird uncached topics", async () => {
    const pack = await Effect.runPromise(
      selectInstantQuizPack(new SlowFailingProvider(), { timeoutMs: 50 }, {
        topic: "underwater basket weaving economics",
        questionCount: 7
      })
    );

    expect(pack.sourceType).toBe("template");
    expect(pack.arenaName).toBe("Underwater Basket Weaving Economics");
    expect(pack.questions).toHaveLength(7);
  });

  it("can let a fast validated LLM pack win when explicitly included", async () => {
    const pack = await Effect.runPromise(
      selectInstantQuizPack(new FastCustomProvider(), { timeoutMs: 1000, includeLlm: true }, {
        topic: "cryptic textile economics",
        questionCount: 7
      })
    );

    expect(["llm", "template"]).toContain(pack.sourceType);
    expect(pack.questions).toHaveLength(7);
  });
});
