import { DEFAULT_SELECTED_TOPIC } from "@quizrush/shared";

export interface ParsedIntentPreview {
  rawText: string;
  topics: string[];
  arenaName: string;
  difficulty: "Beginner" | "Intermediate" | "Expert";
  summary: string;
  confidence: number;
}

const topicRules: Array<{ topic: string; match: RegExp }> = [
  { topic: "AI Agents", match: /\b(ai|agent|agents|llm|machine learning|model|models|prompt|prompts|automation)\b/i },
  { topic: "Space Tech", match: /\b(space|rocket|rockets|nasa|orbit|satellite|satellites|mars|moon|spacex|astronomy)\b/i },
  { topic: "Database Systems", match: /\b(database|databases|db|sql|spacetimedb|redis|postgres|backend|distributed)\b/i },
  { topic: "Startup Strategy", match: /\b(startup|startups|founder|founders|vc|venture|pitch|product|growth|business)\b/i },
  { topic: "Math Logic", match: /\b(math|probability|logic|algebra|calculus|statistics|puzzle|puzzles)\b/i },
  { topic: "World History", match: /\b(history|empire|empires|war|ancient|civilization|geography|politics)\b/i },
  { topic: "Sports Strategy", match: /\b(sports|football|soccer|f1|formula|basketball|cricket|tennis|nba|nfl)\b/i },
  { topic: "Science", match: /\b(science|physics|chemistry|biology|climate|energy|research)\b/i },
  { topic: "Gaming", match: /\b(game|games|gaming|esports|minecraft|fortnite|zelda|pokemon)\b/i },
  { topic: "US Visa System", match: /\b(us visa|visa system|immigration|uscis|embassy|consulate|green card|h-?1b|f-?1|b-?1|b-?2)\b/i }
];

const unsafeWords = /\b(kill|hate|sex|weapon|bomb|gambling|betting|wager|payout|profit)\b/i;

export function parseIntentPreview(rawText: string): ParsedIntentPreview {
  const cleaned = rawText.replace(/\s+/g, " ").trim();
  const safeText = cleaned.replace(unsafeWords, "general knowledge");
  const topics = topicRules.filter((rule) => rule.match.test(safeText)).map((rule) => rule.topic).slice(0, 3);
  const finalTopics = topics.length ? topics : [customTopicFromIntent(safeText)];
  const difficulty = inferDifficulty(safeText);

  return {
    rawText: cleaned,
    topics: finalTopics,
    arenaName: arenaName(finalTopics),
    difficulty,
    summary: cleaned ? summarizeIntent(cleaned, finalTopics) : "Tell us what you know best and AI will place you into a fair sprint.",
    confidence: cleaned ? Math.min(0.94, 0.62 + finalTopics.length * 0.1) : 0.35
  };
}

function customTopicFromIntent(text: string): string {
  const stripped = text
    .replace(/\b(i want to|i wanna|i would like to|i know about|i know|i am good at|i'm good at|compete in|compete on|give quiz competition for|quiz competition for|quiz on|quiz about|questions about|about|on)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s+.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const candidate = stripped || text.trim();
  if (!candidate) return "General Knowledge";
  return toTitleCase(candidate.split(/\s+/).slice(0, 6).join(" ")).slice(0, 48);
}

export function topicsForReducers(rawText: string): string[] {
  return parseIntentPreview(rawText).topics;
}

function arenaName(topics: string[]): string {
  if (!topics.length) return DEFAULT_SELECTED_TOPIC;
  return topics.map((topic) => topic.replace(/\s+(Systems|Strategy|Tech|Logic)$/i, "")).join(" x ");
}

function inferDifficulty(text: string): ParsedIntentPreview["difficulty"] {
  if (/\b(expert|advanced|hard|deep|professional|research|phd|senior)\b/i.test(text)) return "Expert";
  if (/\b(beginner|basic|easy|intro|new to|learning)\b/i.test(text)) return "Beginner";
  return "Intermediate";
}

function summarizeIntent(text: string, topics: string[]): string {
  if (text.length <= 86) return text;
  return `${topics.slice(0, 3).join(", ")} from your expertise note`;
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["us", "usa", "uk", "ai", "llm", "db", "sql", "api", "h1b", "h-1b", "f1", "f-1", "b1", "b-1", "b2", "b-2"].includes(lower)) {
        return lower.toUpperCase();
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
