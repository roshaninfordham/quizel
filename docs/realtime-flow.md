# Realtime Flow

Default demo flow:

1. `pnpm dev` starts Vite and the local reducer gateway.
2. Host calls reducer actions from `/host`.
3. Phones call reducers over WebSocket.
4. The gateway runs the shared reducer engine.
5. Every reducer commit broadcasts a fresh state snapshot.
6. Projector, phones, host, and tech overlay render from the same authoritative snapshot.

SpacetimeDB flow:

1. `modules/spacetime` defines the public tables and reducers.
2. Clients call reducers such as `join_session`, `submit_answer`, and `support_player`.
3. Clients subscribe to necessary table rows.
4. SpacetimeDB transactions commit or roll back reducer mutations.
5. Table updates stream to subscribed clients.

Measured metrics shown:

- Connected clients
- Reducer calls
- Cheer events
- Duplicate answers rejected
- Double-spend attempts blocked
- Approximate p95 sync latency

The UI does not claim zero latency.
