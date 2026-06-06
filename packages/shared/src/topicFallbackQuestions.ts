import type { QuestionInput } from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export function buildTopicFallbackQuestions(topicInput: string, questionCount: number): QuestionInput[] {
  const topic = normalizeTopic(topicInput);
  const lower = topic.toLowerCase();
  const pack = lower.includes("visa") || lower.includes("immigration") ? visaQuestionPack(topic) : genericQuestionPack(topic);
  const questions: QuestionInput[] = [];
  for (let index = 0; index < questionCount; index += 1) {
    const source = pack[index % pack.length] ?? pack[0];
    if (!source) break;
    questions.push({
      ...source,
      questionText: source.questionText.replace(/\{topic\}/g, topic),
      explanation: source.explanation.replace(/\{topic\}/g, topic),
      topic
    });
  }
  return questions;
}

export function normalizeTopic(topicInput: string): string {
  const cleaned = topicInput.replace(/\s+/g, " ").trim();
  if (!cleaned) return "General Knowledge";
  return cleaned
    .split(" + ")
    .map((part) => toTitleCase(part.trim()))
    .filter(Boolean)
    .slice(0, 3)
    .join(" + ")
    .slice(0, 80);
}

function visaQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In the {topic}, what is a visa generally used for?", ["Requesting entry", "Owning property", "Paying taxes", "Voting"], "A", "A visa is generally used to request permission to travel to a country for a stated purpose.", topic),
    q("Which document is a visa usually attached to or linked with?", ["Passport", "School ID", "Receipt", "Boarding pass"], "A", "Visas are usually placed in or electronically linked to a passport.", topic),
    q("What does a visa category usually describe?", ["Travel purpose", "Favorite city", "Phone model", "Hotel rating"], "A", "A visa category usually describes the purpose of travel, such as study, work, tourism, or exchange.", topic),
    q("Who commonly reviews visa applications outside the US?", ["Consular officer", "Airline pilot", "Hotel manager", "Bank teller"], "A", "Consular officers review many visa applications at embassies or consulates.", topic),
    q("What does overstaying usually mean?", ["Staying too long", "Booking early", "Flying direct", "Packing light"], "A", "Overstaying means remaining beyond the authorized period of stay.", topic),
    q("At a US port of entry, who makes the admission decision?", ["Border officer", "Taxi driver", "Tour guide", "Travel blogger"], "A", "A border officer makes the final admission decision at the port of entry.", topic),
    q("Why do forms ask for travel purpose?", ["Match the visa", "Pick an airline", "Choose a meal", "Rate a hotel"], "A", "Travel purpose helps match a person to the correct visa category and review path.", topic)
  ];
}

function genericQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, what helps make answers reliable?", ["Clear definitions", "Random guesses", "Hidden rules", "Long delays"], "A", "Clear definitions make a fast quiz on {topic} fair and answerable.", topic),
    q("What is the best first step when learning {topic}?", ["Know key terms", "Skip basics", "Ignore context", "Avoid examples"], "A", "Key terms give players a shared starting point for {topic}.", topic),
    q("A good {topic} question should be...", ["Unambiguous", "Tricky only", "Personal", "Unverifiable"], "A", "Unambiguous questions keep a rapid tournament fair.", topic),
    q("Which signal should shape this arena?", ["Player intent", "Screen size", "Join order", "Button color"], "A", "QuizRush uses submitted expertise intent to shape the arena topic.", topic),
    q("For a fair {topic} sprint, scoring should reward...", ["Accuracy and speed", "Random taps", "Slow loading", "Duplicate answers"], "A", "The race rewards correct answers and fast server-received response time.", topic),
    q("What should an AI quiz avoid in {topic}?", ["Unsafe claims", "Clear options", "Short text", "One answer"], "A", "The agent guardrails avoid unsafe claims and ambiguous answer choices.", topic),
    q("Why keep {topic} questions short?", ["Fast reading", "More scrolling", "Harder tapping", "Less fairness"], "A", "Short questions fit phone screens and keep the 25-second sprint moving.", topic)
  ];
}

function q(
  questionText: string,
  options: [string, string, string, string],
  correctOption: (typeof OPTION_KEYS)[number],
  explanation: string,
  topic: string
): QuestionInput {
  return {
    questionText,
    options: {
      A: options[0],
      B: options[1],
      C: options[2],
      D: options[3]
    },
    correctOption,
    explanation,
    topic
  };
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["us", "usa", "uk", "ai", "llm", "db", "sql", "api"].includes(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
