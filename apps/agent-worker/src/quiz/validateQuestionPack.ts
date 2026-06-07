import { questionBatchSchema, type QuestionInput } from "@quizrush/shared";

const META_QUESTION_PATTERNS = [
  /best first step when learning/i,
  /good .+ question should/i,
  /which option is most relevant/i,
  /which signal should shape/i,
  /what should an ai quiz avoid/i,
  /why keep .+ questions short/i,
  /valid quiz question/i,
  /before studying/i,
  /how to study/i,
  /learning .+ is best/i,
  /know key terms/i,
  /skip basics/i,
  /ignore context/i,
  /avoid examples/i
];

export interface QuestionPackValidation {
  ok: boolean;
  qualityScore: number;
  reasons: string[];
  questions: QuestionInput[];
}

export function validateGroundedQuestionPack(input: {
  questions: QuestionInput[];
  topic: string;
  requireFactIds?: boolean;
}): QuestionPackValidation {
  const parsed = questionBatchSchema.safeParse({ questions: input.questions });
  if (!parsed.success) {
    return { ok: false, qualityScore: 0, reasons: [parsed.error.message], questions: [] };
  }

  const reasons: string[] = [];
  const seenQuestions = new Set<string>();
  const topicProfile = topicSpecificTerms(input.topic);
  let score = 100;

  for (const question of parsed.data.questions) {
    const normalizedQuestion = normalizeForCompare(question.questionText);
    if (seenQuestions.has(normalizedQuestion)) {
      reasons.push(`Duplicate question: ${question.questionText}`);
      score -= 20;
    }
    seenQuestions.add(normalizedQuestion);

    if (META_QUESTION_PATTERNS.some((pattern) => pattern.test(question.questionText))) {
      reasons.push(`Meta question rejected: ${question.questionText}`);
      score -= 40;
    }

    if (topicProfile && !containsAny(`${question.questionText} ${question.explanation} ${Object.values(question.options).join(" ")}`, topicProfile.requiredTerms)) {
      reasons.push(`Question is not specific to ${input.topic}: ${question.questionText}`);
      score -= 30;
    }

    const optionValues = Object.values(question.options).map(normalizeForCompare);
    if (new Set(optionValues).size !== optionValues.length) {
      reasons.push(`Duplicate options in: ${question.questionText}`);
      score -= 25;
    }

    if (input.requireFactIds && !question.factIds?.length) {
      reasons.push(`Missing fact grounding: ${question.questionText}`);
      score -= 20;
    }

    if (question.questionText.length > 130) {
      reasons.push(`Question too long: ${question.questionText}`);
      score -= 10;
    }
  }

  const qualityScore = Math.max(0, Math.min(100, score));
  return {
    ok: qualityScore >= 80 && reasons.length === 0,
    qualityScore,
    reasons,
    questions: parsed.data.questions
  };
}

export function isMetaQuestion(questionText: string): boolean {
  return META_QUESTION_PATTERNS.some((pattern) => pattern.test(questionText));
}

function normalizeForCompare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function containsAny(value: string, terms: RegExp[]): boolean {
  return terms.some((term) => term.test(value));
}

function topicSpecificTerms(topic: string): { requiredTerms: RegExp[] } | null {
  const normalized = normalizeForCompare(topic);
  const focusedTopic = !/\b(ai|artificial intelligence|startup|database|history|sports|fruit|and)\b/.test(normalized);
  if (focusedTopic && /\bspace|astronomy|rocket|nasa|planet|orbit\b/.test(normalized)) {
    return {
      requiredTerms: [
        /\bspace\b/i,
        /\bplanet|planets|mars|venus|jupiter|mercury|earth|saturn|neptune|uranus\b/i,
        /\bstar|sun|galaxy|galaxies|astronomy|telescope|hubble|exoplanet\b/i,
        /\borbit|satellite|moon|rocket|nasa|apollo|voyager|spacecraft|mission\b/i
      ]
    };
  }
  if (focusedTopic && /\bandaman\b/.test(normalized)) {
    return {
      requiredTerms: [
        /\bandaman|nicobar|port blair|cellular jail|havelock|swaraj|barren island|jarawa\b/i,
        /\bbay of bengal|union territory|island|archipelago|volcano\b/i
      ]
    };
  }
  return null;
}
