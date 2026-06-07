import { Effect } from "effect";
import { normalizeIntent, topicKeyPart, type TopicFact } from "@quizrush/shared";

export interface FirecrawlGroundingConfig {
  enabled: boolean;
  apiKey: string;
  apiBaseUrl: string;
  timeoutMs: number;
  limit: number;
  maxFacts: number;
  country: string;
}

export type GroundingFact = Omit<TopicFact, "sessionId" | "createdAt">;

export interface FirecrawlGroundingResult {
  topicKey: string;
  displayName: string;
  facts: GroundingFact[];
  creditsUsed: number | null;
}

interface FirecrawlSearchResult {
  title?: string;
  description?: string;
  url?: string;
  markdown?: string;
  summary?: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    url?: string;
  };
}

interface FirecrawlSearchResponse {
  success?: boolean;
  data?: {
    web?: FirecrawlSearchResult[];
  };
  creditsUsed?: number;
  warning?: string | null;
}

export function fetchFirecrawlFacts(
  config: FirecrawlGroundingConfig,
  topic: string
): Effect.Effect<FirecrawlGroundingResult, Error> {
  const normalized = normalizeIntent(topic);
  const displayName = normalized.displayArenaName;
  const topicKey = normalized.topicKey || topicKeyPart(displayName);

  if (!config.enabled) return Effect.fail(new Error("Firecrawl grounding disabled."));
  if (!config.apiKey) return Effect.fail(new Error("FIRECRAWL_API_KEY is not configured."));

  return Effect.tryPromise({
    try: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(300, config.timeoutMs));
      try {
        const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}/v2/search`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            query: `"${displayName}" facts overview`,
            limit: Math.max(1, Math.min(10, config.limit)),
            sources: ["web"],
            country: config.country || "US",
            timeout: Math.max(500, config.timeoutMs),
            ignoreInvalidURLs: true,
            scrapeOptions: {
              formats: [{ type: "summary" }, { type: "markdown" }],
              onlyMainContent: true
            }
          }),
          signal: controller.signal
        });

        if (!response.ok) throw new Error(`Firecrawl returned HTTP ${response.status}.`);
        const payload = (await response.json()) as FirecrawlSearchResponse;
        if (payload.success === false) throw new Error(payload.warning ?? "Firecrawl search failed.");

        const facts = factsFromResults(topicKey, displayName, payload.data?.web ?? [], config.maxFacts);
        if (!facts.length) throw new Error(`Firecrawl returned no usable facts for ${displayName}.`);
        return {
          topicKey,
          displayName,
          facts,
          creditsUsed: typeof payload.creditsUsed === "number" ? payload.creditsUsed : null
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error(`Firecrawl timed out after ${config.timeoutMs}ms.`);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error)))
  });
}

function factsFromResults(topicKey: string, displayName: string, results: FirecrawlSearchResult[], maxFacts: number): GroundingFact[] {
  const facts: GroundingFact[] = [];
  const seen = new Set<string>();
  const topicTokens = tokensFor(displayName);

  for (const result of results.slice(0, 5)) {
    const sourceTitle = clean(result.title ?? result.metadata?.title ?? "Firecrawl result", 120);
    const sourceUrl = clean(result.url ?? result.metadata?.sourceURL ?? result.metadata?.url ?? "https://firecrawl.dev", 260);
    const text = [result.description, result.metadata?.description, result.summary, result.markdown]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join("\n");
    const candidates = extractSentences(text).sort((a, b) => sentenceScore(b, topicTokens) - sentenceScore(a, topicTokens));

    for (const sentence of candidates) {
      if (facts.length >= maxFacts) return facts;
      const factText = clean(sentence, 320);
      const key = factText.toLowerCase();
      if (seen.has(key) || factText.length < 32 || looksUnusable(factText)) continue;
      seen.add(key);
      facts.push({
        factId: `${topicKey}-fc-${facts.length + 1}-${slug(factText)}`.slice(0, 80),
        topicKey,
        displayName,
        sourceTitle,
        sourceUrl,
        sourceType: "firecrawl",
        factText,
        confidence: trustedSourceConfidence(sourceUrl)
      });
    }
  }

  return facts;
}

function extractSentences(text: string): string[] {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*_`>|()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|(?:\n|;)+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 24 && item.length <= 260);
}

function sentenceScore(sentence: string, topicTokens: Set<string>): number {
  const sentenceTokens = tokensFor(sentence);
  let score = 0;
  for (const token of topicTokens) {
    if (sentenceTokens.has(token)) score += 2;
  }
  if (/\b(is|are|was|were|located|known|founded|created|part of|capital|largest|first|only)\b/i.test(sentence)) score += 1;
  if (/\bclick|subscribe|cookie|login|advertisement|privacy policy\b/i.test(sentence)) score -= 4;
  return score;
}

function looksUnusable(value: string): boolean {
  return /\b(cookie|subscribe|newsletter|sign in|privacy policy|terms of use|advertisement|enable javascript)\b/i.test(value);
}

function trustedSourceConfidence(url: string): number {
  if (/\b(wikipedia|wikidata|britannica|nasa|nih|edu|gov|unesco|who)\b/i.test(url)) return 0.9;
  return 0.78;
}

function tokensFor(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function clean(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}
