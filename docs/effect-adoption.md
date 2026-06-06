# Effect Adoption

Effect is the TypeScript foundation for code that touches external systems or needs operational guarantees.

Use Effect for:

- LLM provider calls
- retries and timeouts
- typed configuration
- service boundaries and dependency injection
- worker orchestration
- metrics/logging
- future CLI or background jobs

Do not use Effect for:

- SpacetimeDB reducers, because reducers must stay deterministic and isolated from external I/O.
- Simple React rendering logic.
- Pure scoring functions, unless they need dependency injection or async behavior.

Current implementation:

- `apps/agent-worker/src/effects/config.ts`: typed config loaded through `Config`.
- `apps/agent-worker/src/llm/service.ts`: `LlmProviderService` tag and provider construction.
- `apps/agent-worker/src/effects/program.ts`: composed worker program with `Layer` provisioning.
- `apps/agent-worker/src/agents/quizAgents.ts`: retry, validation, fallback, and typed errors.

Pattern for new TS integrations:

```ts
import { Context, Effect, Layer } from "effect";

class ExternalService extends Context.Tag("app/ExternalService")<
  ExternalService,
  { readonly run: () => Effect.Effect<string, Error> }
>() {}

const ExternalServiceLive = Layer.succeed(ExternalService, {
  run: () => Effect.succeed("ok")
});

const program = Effect.gen(function* () {
  const service = yield* ExternalService;
  return yield* service.run();
});

Effect.runPromise(Effect.provide(program, ExternalServiceLive));
```

The rule is simple: keep reducers pure and deterministic; put outside-world TypeScript workflows behind Effect services.
