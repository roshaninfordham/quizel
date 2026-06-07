import type { QuestionInput } from "@quizrush/shared";

export interface TemplateGroundingFact {
  factId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  factText?: string;
}

export function buildTemplateGroundedQuestions(
  topic: string,
  facts: TemplateGroundingFact[],
  questionCount: number
): QuestionInput[] {
  const usableFacts = facts
    .map((fact, index) => ({
      factId: cleanId(fact.factId, topic, index),
      sourceTitle: cleanText(fact.sourceTitle ?? "Retrieved source", 120),
      sourceUrl: fact.sourceUrl,
      factText: cleanText(fact.factText ?? "", 220)
    }))
    .filter((fact) => fact.factText.length >= 24);

  if (!usableFacts.length) return [];

  const questions: QuestionInput[] = [];
  for (let index = 0; index < questionCount; index += 1) {
    const fact = usableFacts[index % usableFacts.length];
    if (!fact) break;
    const sourceNumber = index + 1;
    const topicLabel = cleanText(topic || "this topic", 48);
    const correct = optionText(fact.factText);

    questions.push({
      questionText: `Which retrieved fact #${sourceNumber} about ${topicLabel} is correct?`,
      options: {
        A: correct,
        B: `It is unrelated to ${topicLabel}.`.slice(0, 72),
        C: `It only describes how to study ${topicLabel}.`.slice(0, 72),
        D: `It says no public facts were found.`
      },
      correctOption: "A",
      explanation: fact.factText,
      topic: topicLabel,
      factIds: [fact.factId],
      sourceTitle: fact.sourceTitle,
      sourceUrl: fact.sourceUrl
    });
  }

  return questions;
}

function optionText(value: string): string {
  const sentence = value
    .replace(/\s+/g, " ")
    .replace(/^[*-]\s*/, "")
    .trim();
  if (sentence.length <= 72) return sentence;
  return `${sentence.slice(0, 69).replace(/\s+\S*$/, "")}...`;
}

function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanId(value: string | undefined, topic: string, index: number): string {
  const fallback = `${topic || "topic"} fact ${index + 1}`;
  return (value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
