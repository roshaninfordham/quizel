# AI Agents

The worker lives in `apps/agent-worker`.

Agents:

- Quiz Author Agent: generates question JSON.
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
- `MockLlmProvider`
- `FallbackSeedProvider`

Failure path:

1. Missing credentials or provider failure.
2. Retry according to Effect policy.
3. Validate JSON with Zod.
4. On failure, use seeded fallback questions.
5. Record visible `AgentEvent` with `fallback` status.

AI guardrail:

AI may write question batches and AgentEvents through reducers, but it cannot directly mutate answers, Energy, scores, or winners.
