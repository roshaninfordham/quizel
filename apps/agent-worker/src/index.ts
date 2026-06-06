import { Effect } from "effect";
import { GenericHttpLlmProvider } from "./llm/providers/GenericHttpLlmProvider";
import { FallbackSeedProvider } from "./llm/providers/FallbackSeedProvider";
import { generateQuizQuestions } from "./agents/quizAgents";

const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 12_000);
const maxRetries = Number(process.env.LLM_MAX_RETRIES ?? 2);

const provider =
  process.env.LLM_API_KEY && process.env.LLM_API_BASE_URL && process.env.LLM_MODEL_ID
    ? new GenericHttpLlmProvider({
        baseUrl: process.env.LLM_API_BASE_URL,
        apiKey: process.env.LLM_API_KEY,
        modelId: process.env.LLM_MODEL_ID,
        jsonMode: process.env.LLM_JSON_MODE !== "false",
        providerName: process.env.LLM_PROVIDER_NAME ?? "generic"
      })
    : new FallbackSeedProvider();

const program = generateQuizQuestions(provider, { timeoutMs, maxRetries }, {
  topic: "AI + Space + Startups",
  difficulty: "beginner",
  questionCount: 3
});

Effect.runPromise(program).then((result) => {
  console.info(JSON.stringify(result, null, 2));
});
