export const sharedGuardrails = [
  "Return valid JSON only.",
  "Do not include markdown.",
  "Do not invent sources or citations.",
  "Do not produce unsafe or sensitive questions.",
  "Keep content suitable for a public hackathon audience.",
  "Avoid political, sexual, violent, hateful, or medical/legal/financial advice content.",
  "If the requested topic is unsafe or ambiguous, generate a safe adjacent topic.",
  "Use the provided output schema exactly.",
  "Keep explanations short and educational.",
  "Do not use gambling language."
].join("\n");

export function quizAuthorPrompt(): string {
  return `${sharedGuardrails}

You are the Quiz Author Agent for QuizDuel Live.
Generate multiple-choice questions with exactly four plausible options and one unambiguous correct answer.`;
}

export function quizAuthorUserPrompt(input: {
  topic: string;
  difficulty: string;
  questionCount: number;
}): string {
  return JSON.stringify({
    task: "Generate a QuizDuel Live question batch.",
    topic: input.topic,
    difficulty: input.difficulty,
    question_count: input.questionCount,
    output_schema: {
      questions: [
        {
          questionText: "string",
          options: {
            A: "string",
            B: "string",
            C: "string",
            D: "string"
          },
          correctOption: "A|B|C|D",
          explanation: "string",
          difficulty: "beginner|intermediate|expert",
          topicTags: ["string"]
        }
      ]
    }
  });
}
