import { buildTopicFallbackQuestions, QUESTION_COUNT, topicKeyPart, type QuestionInput } from "@quizrush/shared";

export interface CachedQuizPack {
  topicKey: string;
  title: string;
  aliases: string[];
  tags: string[];
  questions: QuestionInput[];
}

const packTopics = [
  "US Visa System",
  "Andaman Islands",
  "Fruit Science",
  "AI Agents",
  "SpacetimeDB",
  "Database Systems",
  "Startup Strategy",
  "Space Technology",
  "Formula 1",
  "Argentina",
  "Math Logic",
  "World History",
  "Sports Strategy",
  "General Knowledge"
];

export const cachedQuizPacks: CachedQuizPack[] = packTopics.map((title) => ({
  topicKey: topicKeyPart(title),
  title,
  aliases: aliasesFor(title),
  tags: [title, ...aliasesFor(title)],
  questions: buildTopicFallbackQuestions(title, QUESTION_COUNT)
}));

function aliasesFor(title: string): string[] {
  switch (title) {
    case "US Visa System":
      return ["visa", "immigration", "uscis", "green card", "h1b", "f1 visa"];
    case "Andaman Islands":
      return ["andaman", "andaman and nicobar", "port blair", "cellular jail", "havelock", "swaraj dweep"];
    case "Fruit Science":
      return ["fruit", "fruits", "nutrition", "biology", "food science"];
    case "AI Agents":
      return ["ai", "llm", "agents", "automation", "prompts"];
    case "SpacetimeDB":
      return ["spacetimedb", "spacetime db", "realtime database", "reducers", "subscriptions"];
    case "Database Systems":
      return ["database", "databases", "db", "sql", "spacetimedb", "postgres"];
    case "Startup Strategy":
      return ["startup", "startups", "founder", "pitch", "venture", "growth"];
    case "Space Technology":
      return ["space", "rocket", "satellite", "orbit", "nasa", "spacex"];
    case "Formula 1":
      return ["f1", "formula one", "grand prix", "motorsport", "racing"];
    case "Argentina":
      return ["argentina", "buenos aires", "andes", "patagonia", "south america"];
    case "Math Logic":
      return ["math", "logic", "probability", "statistics", "puzzles"];
    case "World History":
      return ["history", "ancient", "empire", "civilization", "geography"];
    case "Sports Strategy":
      return ["sports", "football", "soccer", "f1", "cricket", "world cup"];
    default:
      return ["general", "knowledge", "trivia"];
  }
}
