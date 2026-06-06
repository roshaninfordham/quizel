# AI Agents

The worker lives in `apps/agent-worker`.

Agents:

- Quiz Author Agent: generates question JSON.
- Safety Guard Agent: classifies generated content before it can be accepted.
- Fairness Review Agent: validates shape, options, ambiguity, and public-audience safety.
- Host Commentator Agent: produces short positive commentary.
- Learning Recap Agent: summarizes what the room learned.

Provider abstraction:

```ts
interface LlmProvider {
  generateJson<T>(input: {
    system: string;
    user: string;
    schemaName: string;
    timeoutMs: number;
    temperature: number;
  }): Effect.Effect<T, LlmError>;
}
```

Implemented providers:

- `GenericHttpLlmProvider`
- `NvidiaLlmProvider`
- `AnthropicLlmProvider`
- `GeminiLlmProvider`
- `MockLlmProvider`
- `FallbackSeedProvider`

Effect runtime structure:

- `WorkerConfigService`: typed environment configuration loaded with `Config`.
- `LlmProviderService`: provider-neutral LLM interface exposed through `Context.Tag`.
- `AgentWorkerLive`: layer composition for config plus provider construction.
- `QuizGenerationProgram`: runnable Effect program for quiz generation and fallback handling.

Failure path:

1. Missing credentials or provider failure.
2. Retry according to Effect policy.
3. Validate JSON with Zod.
4. On failure, use seeded fallback questions.
5. Record visible `AgentEvent` with `fallback` status.

AI guardrail:

AI may write question batches and AgentEvents through reducers, but it cannot directly mutate answers, Energy, scores, or winners.

Provider selection:

- `LLM_PROVIDER_NAME=auto` selects the first configured provider.
- Explicit `LLM_PROVIDER_NAME=generic|openai|nvidia|anthropic|gemini` forces a provider.
- Missing or failing providers fall back to seeded demo questions and visible fallback AgentEvents.
- Secrets are read from `.env.local` or process env and are never committed.

NVIDIA routing:

- `NVIDIA_AUTHOR_MODEL` generates the quiz batch.
- `NVIDIA_REASONING_MODEL` reviews fairness and ambiguity.
- `NVIDIA_SMALL_MODEL` handles low-latency commentary and learning recap.
- `NVIDIA_SAFETY_MODEL` is used when `SAFETY_GUARD_ENABLED=true`.
