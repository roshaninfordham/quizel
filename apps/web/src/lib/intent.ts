import { normalizeIntent } from "@quizrush/shared";

export interface ParsedIntentPreview {
  rawText: string;
  topics: string[];
  arenaName: string;
  difficulty: "Beginner" | "Intermediate" | "Expert";
  summary: string;
  confidence: number;
}

export function parseIntentPreview(rawText: string): ParsedIntentPreview {
  const normalized = normalizeIntent(rawText);
  const cleaned = normalized.cleanedText || normalized.rawText;

  return {
    rawText: normalized.rawText,
    topics: normalized.canonicalTopics,
    arenaName: normalized.displayArenaName,
    difficulty: titleDifficulty(normalized.difficultyHint),
    summary: cleaned ? summarizeIntent(cleaned, normalized.canonicalTopics) : "Tell us what you know best and AI will place you into a fair sprint.",
    confidence: normalized.confidence
  };
}

export function topicsForReducers(rawText: string): string[] {
  return parseIntentPreview(rawText).topics;
}

function titleDifficulty(value: "beginner" | "intermediate" | "expert"): ParsedIntentPreview["difficulty"] {
  if (value === "beginner") return "Beginner";
  if (value === "expert") return "Expert";
  return "Intermediate";
}

function summarizeIntent(text: string, topics: string[]): string {
  if (text.length <= 86) return text;
  return `${topics.slice(0, 3).join(", ")} from your expertise note`;
}
