# Realtime Flow

Default laptop demo flow:

1. `pnpm dev` starts Vite and the local reducer gateway.
2. `pnpm dev` also starts the Effect agent worker.
3. Host calls reducer actions from `/host`.
4. Phones call reducers over WebSocket.
5. The worker watches snapshots, processes `AgentRequest` rows, calls LLM providers, validates JSON, and writes back through reducers.
6. The gateway runs the shared reducer engine.
7. Every reducer commit broadcasts a fresh state snapshot.
8. Projector, phones, host, and tech overlay render from the same authoritative snapshot.

This local gateway exists so the entire hackathon demo can run from one laptop with phones on the same Wi-Fi. It uses the same reducer names, arguments, scoring constants, and invariants as the SpacetimeDB module, so the judged flow exercises the intended transactional contract without requiring a hosted database during presentation setup.

SpacetimeDB flow:

1. `modules/spacetime` defines the public tables and reducers.
2. Clients call reducers such as `join_session`, `submit_answer`, and `support_player`.
3. Clients subscribe to necessary table rows.
4. SpacetimeDB transactions commit or roll back reducer mutations.
5. Table updates stream to subscribed clients.

Verified integration points:

- `pnpm spacetime:build` builds the module in `modules/spacetime`.
- `pnpm spacetime:generate` generates TypeScript bindings with `DbConnection`, typed table accessors, and typed reducer calls.
- The next direct deployment step is swapping `apps/web/src/lib/spacetime/client.ts` from the local gateway socket to generated `DbConnection` subscriptions while preserving the current domain hooks.

Measured metrics shown:

- Connected clients
- Reducer calls
- Cheer events
- Duplicate answers rejected
- Double-spend attempts blocked
- Approximate p95 sync latency

The UI does not claim zero latency.
