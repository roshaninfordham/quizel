export type DifficultyHint = "beginner" | "intermediate" | "expert";

export interface NormalizedIntent {
  rawText: string;
  cleanedText: string;
  canonicalTopics: string[];
  topicKey: string;
  displayArenaName: string;
  difficultyHint: DifficultyHint;
  confidence: number;
}

const fillerPatterns = [
  /\b(i want to|i wanna|i would like to|i'd like to|i know about|i know|i am good at|i'm good at)\b/gi,
  /\b(test me on|quiz me on|give quiz competition for|quiz competition for|compete in|compete on)\b/gi,
  /\b(quiz|quizzes|questions|question|competition|compete|arena|topic|about|on)\b/gi
];

const unsafeWords = /\b(kill|hate|sex|weapon|bomb|gambling|betting|wager|payout|profit)\b/i;

const topicRules: Array<{ topic: string; match: RegExp }> = [
  { topic: "Andaman Islands", match: /\b(andaman|andaman islands|andaman and nicobar|andaman nicobar|port blair|cellular jail|havelock|swaraj dweep)\b/i },
  { topic: "US Visa System", match: /\b(us visa|u\.s\. visa|visa system|immigration|uscis|embassy|consulate|green card|h-?1b|f-?1|b-?1|b-?2)\b/i },
  { topic: "AI Agents", match: /\b(ai|artificial intelligence|agent|agents|llm|llms|machine learning|model|models|prompt|prompts|automation)\b/i },
  { topic: "SpacetimeDB", match: /\b(spacetime\s*db|spacetimedb|space\s*time\s*db)\b/i },
  { topic: "Space Technology", match: /\b(space|rocket|rockets|nasa|orbit|satellite|satellites|mars|moon|spacex|astronomy)\b/i },
  { topic: "Database Systems", match: /\b(database|databases|db|sql|spacetimedb|redis|postgres|backend|distributed)\b/i },
  { topic: "Startup Strategy", match: /\b(startup|startups|founder|founders|vc|venture|pitch|product|growth|business)\b/i },
  { topic: "Formula 1", match: /\b(f1|formula 1|formula one|grand prix|motorsport|race car|racing)\b/i },
  { topic: "Argentina", match: /\b(argentina|buenos aires|patagonia|pampas|andes|messi|tango)\b/i },
  { topic: "Fruit Science", match: /\b(fruit|fruits|nutrition|nutrient|nutrients|diet|biology|botany|food science)\b/i },
  { topic: "Math Logic", match: /\b(math|probability|logic|algebra|calculus|statistics|puzzle|puzzles)\b/i },
  { topic: "World History", match: /\b(history|empire|empires|war|ancient|civilization|geography|politics)\b/i },
  { topic: "Sports Strategy", match: /\b(sports|football|soccer|f1|formula 1|formula one|basketball|cricket|tennis|nba|nfl|world cup)\b/i },
  { topic: "Gaming", match: /\b(game|games|gaming|esports|minecraft|fortnite|zelda|pokemon)\b/i },
  { topic: "Science", match: /\b(science|physics|chemistry|climate|energy|research)\b/i }
];

const topicDisplay: Record<string, string> = {
  "AI Agents": "AI",
  "Space Technology": "Space",
  "SpacetimeDB": "SpacetimeDB",
  "Database Systems": "Databases",
  "Startup Strategy": "Startups",
  "Formula 1": "Formula 1",
  "Argentina": "Argentina",
  "Fruit Science": "Fruit Science",
  "Math Logic": "Math Logic",
  "World History": "History",
  "Sports Strategy": "Sports Strategy",
  "US Visa System": "US Visa System",
  "Andaman Islands": "Andaman Islands"
};

export function normalizeTranscript(text: string): string {
  return removeRepeatedNgrams(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s+.-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function removeRepeatedNgrams(text: string): string {
  let words = text.split(/\s+/).filter(Boolean);
  for (const size of [3, 2, 1]) {
    words = removeAdjacentRepeatedSequence(words, size);
  }
  return words.join(" ").replace(/\s+/g, " ").trim();
}

export function isDuplicateTranscript(newText: string, previousText: string, receivedWithinMs = 0): boolean {
  const next = normalizeTranscript(newText);
  const previous = normalizeTranscript(previousText);
  if (!next || !previous) return false;
  if (next === previous) return true;
  if (next.startsWith(previous) || previous.startsWith(next)) {
    const shorter = Math.min(next.length, previous.length);
    const longer = Math.max(next.length, previous.length);
    if (shorter / longer > 0.8) return true;
  }
  return receivedWithinMs <= 1500 && similarity(next, previous) > 0.85;
}

export function normalizeIntent(rawText: string): NormalizedIntent {
  const raw = rawText.replace(/\s+/g, " ").trim();
  const transcript = normalizeTranscript(raw);
  const safeText = unsafeWords.test(transcript) ? "general knowledge" : transcript;
  const cleanedText = cleanIntentText(safeText);
  const matched = topicRules.filter((rule) => rule.match.test(cleanedText)).map((rule) => rule.topic);
  const canonicalTopics = suppressBroadTopics(dedupeTopics(matched.length ? matched : [customTopicFromText(cleanedText)])).slice(0, 3);
  const displayArenaName = arenaName(canonicalTopics);

  return {
    rawText: raw,
    cleanedText,
    canonicalTopics,
    topicKey: canonicalTopics.map(topicKeyPart).sort().join("::") || "general_knowledge",
    displayArenaName,
    difficultyHint: inferDifficulty(raw),
    confidence: raw ? Math.min(0.96, 0.64 + canonicalTopics.length * 0.1) : 0.35
  };
}

export function topicKeyPart(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["us", "u.s.", "usa", "uk", "ai", "llm", "db", "sql", "api", "h1b", "h-1b", "f1", "f-1", "b1", "b-1", "b2", "b-2"].includes(lower)) {
        return lower.replace(/\./g, "").toUpperCase();
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function cleanIntentText(text: string): string {
  let cleaned = text;
  for (const pattern of fillerPatterns) cleaned = cleaned.replace(pattern, " ");
  return cleaned.replace(/\s+/g, " ").trim();
}

function customTopicFromText(text: string): string {
  const cleaned = text
    .replace(/\b(and|or|the|a|an|my|strongest|best|please)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "General Knowledge";
  return toTitleCase(cleaned.split(/\s+/).slice(0, 5).join(" ")).slice(0, 48);
}

function arenaName(topics: string[]): string {
  if (!topics.length) return "General Knowledge";
  return topics.map((topic) => topicDisplay[topic] ?? toTitleCase(topic)).join(" x ");
}

function inferDifficulty(text: string): DifficultyHint {
  if (/\b(expert|advanced|hard|deep|professional|research|phd|senior)\b/i.test(text)) return "expert";
  if (/\b(beginner|basic|easy|intro|new to|learning)\b/i.test(text)) return "beginner";
  return "intermediate";
}

function dedupeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const topic of topics) {
    const key = topicKeyPart(topic);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(topic);
  }
  return deduped;
}

function suppressBroadTopics(topics: string[]): string[] {
  if (topics.includes("SpacetimeDB")) {
    return topics.filter((topic) => topic !== "Database Systems" && topic !== "Space Technology");
  }
  if (topics.includes("Formula 1")) {
    return topics.filter((topic) => topic !== "Sports Strategy");
  }
  const hasSpecificScience = topics.some((topic) =>
    ["Fruit Science", "Space Technology", "SpacetimeDB", "Database Systems", "AI Agents"].includes(topic)
  );
  if (!hasSpecificScience) return topics;
  return topics.filter((topic) => topic !== "Science");
}

function removeAdjacentRepeatedSequence(words: string[], size: number): string[] {
  if (words.length < size * 2) return words;
  const output: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const current = words.slice(index, index + size).map(repeatKey).join(" ");
    const previous = output.slice(Math.max(0, output.length - size)).map(repeatKey).join(" ");
    if (output.length >= size && current === previous) {
      index += size - 1;
      continue;
    }
    output.push(words[index] ?? "");
  }
  return output.filter(Boolean);
}

function repeatKey(word: string): string {
  const lower = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (lower.length > 3 && lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}

function similarity(a: string, b: string): number {
  const aTokens = new Set(a.split(/\s+/).map(repeatKey));
  const bTokens = new Set(b.split(/\s+/).map(repeatKey));
  const union = new Set([...aTokens, ...bTokens]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  return intersection / union.size;
}
