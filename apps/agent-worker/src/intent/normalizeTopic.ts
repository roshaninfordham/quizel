export type TopicType = "place" | "science" | "technology" | "history" | "sports" | "culture" | "food" | "general";
export type DifficultyHint = "beginner" | "intermediate" | "expert";

export interface NormalizeTopicInput {
  rawText: string;
}

export interface NormalizedTopic {
  rawText: string;
  cleanedText: string;
  canonicalTopic: string;
  displayTopic: string;
  topicKey: string;
  topicType: TopicType;
  difficultyHint: DifficultyHint;
  confidence: number;
}

const fillerPhrases = [
  "quiz on",
  "test me on",
  "questions about",
  "i want",
  "give me",
  "make quiz",
  "compete in"
];

const aliasRules: Array<{ match: RegExp; topic: string; type: TopicType; confidence: number }> = [
  { match: /\b(andaman|andaman islands|andaman and nicobar|andaman nicobar)\b/i, topic: "Andaman Islands", type: "place", confidence: 0.94 },
  { match: /\b(space|astronomy|rocket|rockets|nasa|orbit|planet|planets|galaxy|stars?)\b/i, topic: "Space", type: "science", confidence: 0.92 },
  { match: /\b(ai|artificial intelligence|llm|llms|machine learning)\b/i, topic: "Artificial Intelligence", type: "technology", confidence: 0.86 },
  { match: /\b(agent|agents|agentic)\b/i, topic: "AI Agents", type: "technology", confidence: 0.84 },
  { match: /\b(startup|startups|founder|growth|venture|vc)\b/i, topic: "Startup Strategy", type: "general", confidence: 0.82 },
  { match: /\b(db|database|databases|sql|postgres|redis|spacetimedb)\b/i, topic: "Databases", type: "technology", confidence: 0.84 },
  { match: /\b(f1|formula 1|formula one)\b/i, topic: "Formula 1", type: "sports", confidence: 0.9 },
  { match: /\b(fruit|fruits|nutrition)\b/i, topic: "Fruit Science", type: "food", confidence: 0.82 },
  { match: /\b(history|ancient|empire|civilization)\b/i, topic: "History", type: "history", confidence: 0.74 },
  { match: /\b(sports|football|soccer|cricket|tennis|basketball)\b/i, topic: "Sports", type: "sports", confidence: 0.74 }
];

export function normalizeTopic(input: NormalizeTopicInput): NormalizedTopic {
  const rawText = input.rawText.replace(/\s+/g, " ").trim();
  const difficultyHint = inferDifficulty(rawText);
  const lowered = rawText.toLowerCase();
  const withoutFiller = fillerPhrases.reduce((value, phrase) => value.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi"), " "), lowered);
  const cleanedText = removeRepeatedNgrams(withoutFiller.replace(/[^\p{L}\p{N}\s+.-]/gu, " ").replace(/\s+/g, " ").trim());

  if (!cleanedText) {
    return buildResult(rawText, "General Knowledge", "general", difficultyHint, 0.35, "general knowledge");
  }

  const matched: Array<{ topic: string; type: TopicType; confidence: number }> = [];
  for (const rule of aliasRules) {
    if (rule.match.test(cleanedText)) matched.push({ topic: rule.topic, type: rule.type, confidence: rule.confidence });
  }

  const topics = dedupeTopics(matched.map((item) => item.topic));
  if (topics.length) {
    const canonicalTopic = composeTopics(topics);
    const type = matched[0]?.type ?? "general";
    const confidence = Math.min(0.98, Math.max(...matched.map((item) => item.confidence)) + Math.min(0.04, topics.length * 0.01));
    return buildResult(rawText, canonicalTopic, type, difficultyHint, confidence, cleanedText);
  }

  const custom = titleCase(cleanedText);
  const confidence = custom.length < 3 ? 0.35 : 0.58;
  if (confidence < 0.45) {
    return buildResult(rawText, "General Knowledge", "general", difficultyHint, confidence, cleanedText);
  }
  return buildResult(rawText, custom, "general", difficultyHint, confidence, cleanedText);
}

function buildResult(
  rawText: string,
  canonicalTopic: string,
  topicType: TopicType,
  difficultyHint: DifficultyHint,
  confidence: number,
  cleanedText: string
): NormalizedTopic {
  const displayTopic = canonicalTopic;
  return {
    rawText,
    cleanedText,
    canonicalTopic,
    displayTopic,
    topicKey: `${slugify(canonicalTopic)}::${difficultyHint}`,
    topicType,
    difficultyHint,
    confidence
  };
}

function composeTopics(topics: string[]): string {
  const normalized = topics.map((topic) => {
    if (topic === "AI Agents" && topics.includes("Artificial Intelligence")) return "AI Agents";
    return topic;
  });
  const deduped = dedupeTopics(normalized).filter((topic, index, all) => !(topic === "Artificial Intelligence" && all.includes("AI Agents")));
  return deduped.join(" x ");
}

function removeRepeatedNgrams(text: string): string {
  let words = text.split(/\s+/).filter(Boolean);
  for (const size of [3, 2, 1]) {
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
    words = output.filter(Boolean);
  }
  return words.join(" ");
}

function repeatKey(word: string): string {
  const lower = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return lower.length > 3 && lower.endsWith("s") ? lower.slice(0, -1) : lower;
}

function dedupeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const topic of topics) {
    const key = slugify(topic);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(topic);
  }
  return result;
}

function inferDifficulty(rawText: string): DifficultyHint {
  if (/\b(expert|advanced|hard|professional)\b/i.test(rawText)) return "expert";
  if (/\b(beginner|basic|easy|intro)\b/i.test(rawText)) return "beginner";
  return "intermediate";
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["ai", "llm", "db", "sql", "api", "f1"].includes(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
