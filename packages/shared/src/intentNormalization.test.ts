import { describe, expect, it } from "vitest";
import { isDuplicateTranscript, normalizeIntent, normalizeTranscript, removeRepeatedNgrams } from "./intentNormalization";
import { buildTopicFallbackQuestions } from "./topicFallbackQuestions";

describe("intent normalization", () => {
  it("commits clean speech text without repeated interim words", () => {
    expect(normalizeTranscript("Fruit Fruits Fruits")).toBe("fruit");
    expect(removeRepeatedNgrams("ai agents ai agents databases")).toBe("ai agents databases");
  });

  it("detects duplicate speech callbacks", () => {
    expect(isDuplicateTranscript("fruit science", "fruit science", 600)).toBe(true);
    expect(isDuplicateTranscript("fruit science and nutrition", "fruit science", 600)).toBe(false);
  });

  it("turns repeated fruit speech into Fruit Science", () => {
    const intent = normalizeIntent("Fruit Fruits Fruits");

    expect(intent.cleanedText).toBe("fruit");
    expect(intent.canonicalTopics).toEqual(["Fruit Science"]);
    expect(intent.topicKey).toBe("fruit_science");
    expect(intent.displayArenaName).toBe("Fruit Science");
  });

  it("does not append broad Science to Fruit Science", () => {
    expect(normalizeIntent("Fruit Science").displayArenaName).toBe("Fruit Science");
  });

  it("keeps arbitrary US visa expertise as the selected arena", () => {
    const intent = normalizeIntent("I want to give quiz competition for US visa system using my voice");
    const questions = buildTopicFallbackQuestions(intent.displayArenaName, 7);

    expect(intent.canonicalTopics).toEqual(["US Visa System"]);
    expect(intent.displayArenaName).toBe("US Visa System");
    expect(questions[0]?.questionText.toLowerCase()).toContain("visa");
  });

  it("normalizes AI database startup expertise for reducers", () => {
    const intent = normalizeIntent("AI AI startup databases");

    expect(intent.canonicalTopics).toEqual(["AI Agents", "Database Systems", "Startup Strategy"]);
    expect(intent.displayArenaName).toBe("AI x Databases x Startups");
  });

  it("falls back to a clean custom arena instead of generic science", () => {
    const intent = normalizeIntent("ancient Tamil astronomy mixed with AI startups");

    expect(intent.displayArenaName).toBe("AI x Space x Startups");
    expect(intent.displayArenaName).not.toContain("Tamil Tamil");
  });
});
