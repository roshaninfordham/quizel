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
  "Do not use gambling language.",
  "Questions must be answerable in a few seconds from provided facts or widely accepted general knowledge."
].join("\n");

export function topicRouterPrompt(): string {
  return `${sharedGuardrails}

You are the Topic Router Agent for QuizRush Arena.
Merge crowd expertise signals into one short tournament topic. Prefer the top themes and keep the output judge-readable.`;
}

export function quizAuthorPrompt(): string {
  return `${sharedGuardrails}

You are the Quiz Builder Agent for QuizRush Arena.
Generate the requested number of fast multiple-choice questions with four short options and one unambiguous correct answer.
If fact cards are provided, use only those fact cards for factual claims and include at least one matching factId per question.`;
}

export function fairnessReviewPrompt(): string {
  return `${sharedGuardrails}

You are the Fairness Agent for QuizRush Arena.
Review the question batch for exactly four options, one correct answer, no duplicate options, no ambiguity, no unsafe claims, and explanations that support the correct answer.
Return approved=true only when the batch is safe for a public hackathon room.
If a question needs light repair, include the repaired batch in fixedQuestions.`;
}

export function safetyGuardPrompt(): string {
  return `${sharedGuardrails}

You are the Safety Guard Agent for QuizRush Arena.
Classify whether the proposed quiz content is safe for a public educational hackathon audience.
Reject content that includes political persuasion, sexual content, graphic violence, hate, self-harm, medical/legal/financial advice, real-money mechanics, or gambling language.
Return safe=true only when all questions and explanations are suitable.`;
}

export function topicRouterUserPrompt(input: {
  topicCounts: Array<{ topic: string; count: number; percent: number }>;
  defaultTopic: string;
}): string {
  return JSON.stringify({
    task: "Select the QuizRush Arena tournament topic from live expertise signals.",
    topic_counts: input.topicCounts,
    default_topic: input.defaultTopic,
    output_schema: {
      selected_topic: "AI + Space + Startups",
      reason: "Most players selected AI, Space, and Startups.",
      topic_weights: [{ topic: "AI", weight: 0.44 }]
    }
  });
}

export function quizAuthorUserPrompt(input: {
  topic: string;
  questionCount: number;
  facts?: Array<{
    factId: string;
    sourceTitle: string;
    sourceUrl: string;
    factText: string;
    confidence: number;
  }>;
}): string {
  const facts = input.facts ?? [];
  return JSON.stringify({
    task: "Generate a QuizRush Arena 25-second tournament question batch.",
    topic: input.topic,
    question_count: input.questionCount,
    fact_cards: facts,
    rules: [
      `Exactly ${input.questionCount} questions.`,
      "Each question and option must be short enough for phone screens.",
      "Options A, B, C, and D must all be plausible.",
      "Only one option can be correct.",
      facts.length
        ? "Every question must be directly supported by at least one supplied fact card."
        : "No citations, unless provided by the prompt.",
      facts.length ? "Use only supplied factIds in factIds." : "If no fact cards are supplied, keep questions widely known and conservative.",
      "No political, medical, legal, financial, or gambling content."
    ],
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
          topic: "string",
          factIds: facts.length ? ["one-or-more factId strings from fact_cards"] : [],
          sourceTitle: facts.length ? "sourceTitle from the supporting fact card" : undefined,
          sourceUrl: facts.length ? "sourceUrl from the supporting fact card" : undefined
        }
      ]
    }
  });
}

export function fairnessReviewUserPrompt(input: { questions: unknown }): string {
  return JSON.stringify({
    task: "Review and repair this QuizRush Arena question batch.",
    questions: input.questions,
    checks: [
      "matches the requested question count",
      "each question has exactly four options",
      "no duplicate options",
      "one correct answer",
      "short enough for rapid answers",
      "public-audience safe",
      "explanation matches the correct answer"
    ],
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
    task: "Classify this QuizRush Arena question batch before it is accepted.",
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

You are the Host Commentator Agent for QuizRush Arena.
Write one short, positive, game-show style line after a round. Do not shame low-scoring players. Do not mention gambling.`;
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

You are the Recap Agent for QuizRush Arena.
Summarize what the room learned from the 25-second match. Be concise, educational, and based only on provided match data.`;
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
