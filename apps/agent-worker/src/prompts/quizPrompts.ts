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

export function fairnessReviewPrompt(): string {
  return `${sharedGuardrails}

You are the Fairness Review Agent for QuizDuel Live.
Review the question batch for exactly four options, one correct answer, no duplicate options, no ambiguity, no unsafe claims, and explanations that support the correct answer.
Return approved=true only when the batch is safe for a public hackathon room.
If a question needs light repair, include the repaired batch in fixedQuestions.`;
}

export function safetyGuardPrompt(): string {
  return `${sharedGuardrails}

You are the Safety Guard Agent for QuizDuel Live.
Classify whether the proposed quiz content is safe for a public educational hackathon audience.
Reject content that includes political persuasion, sexual content, graphic violence, hate, self-harm, medical/legal/financial advice, real-money mechanics, or gambling language.
Return safe=true only when all questions and explanations are suitable.`;
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

export function fairnessReviewUserPrompt(input: { questions: unknown }): string {
  return JSON.stringify({
    task: "Review and repair this QuizDuel Live question batch.",
    questions: input.questions,
    output_schema: {
      approved: true,
      rejectedCount: 0,
      issues: [
        {
          roundNumber: 1,
          severity: "low|medium|high",
          issue: "string",
          suggestedFix: "string"
        }
      ],
      fixedQuestions: []
    }
  });
}

export function safetyGuardUserPrompt(input: { questions: unknown }): string {
  return JSON.stringify({
    task: "Classify this QuizDuel Live question batch before it is accepted.",
    questions: input.questions,
    output_schema: {
      safe: true,
      riskLevel: "low|medium|high",
      categories: ["string"],
      rationale: "string max 240 characters"
    }
  });
}

export function hostCommentaryPrompt(): string {
  return `${sharedGuardrails}

You are the Host Commentator Agent for QuizDuel Live.
Write one short, positive, game-show style line after a round. Do not shame either player. Do not mention gambling.`;
}

export function hostCommentaryUserPrompt(input: unknown): string {
  return JSON.stringify({
    task: "Create one live commentary line for this resolved round.",
    match_state: input,
    output_schema: {
      commentary: "string max 160 characters",
      tone: "excited|encouraging|educational",
      confidence: 0.0
    }
  });
}

export function learningRecapPrompt(): string {
  return `${sharedGuardrails}

You are the Learning Recap Agent for QuizDuel Live.
Summarize what the room learned from the match. Be concise, educational, and based only on provided match data.`;
}

export function learningRecapUserPrompt(input: unknown): string {
  return JSON.stringify({
    task: "Create a final learning recap for this match.",
    match_state: input,
    output_schema: {
      summary: "string",
      hardestConcepts: ["string"],
      nextQuizRecommendation: "string"
    }
  });
}
