# Risks And Guardrails

## Product Safety

- No gambling mechanics.
- No real money.
- No purchase.
- No payout.
- No stored-value account.
- No cash prize.
- No withdrawal or transfer.
- Educational game scoring only.

UI disclaimer:

> QuizRush Live uses educational game scoring only. There is no purchase, cash prize, withdrawal, transfer, or real-world value.

## Realtime Integrity

- One answer per participant per round.
- Server-authoritative timers.
- Server-authoritative response time.
- Score and rank calculated in reducers.
- Duplicate answers rejected and counted in `LiveStats`.
- Replay generated from `MatchEvent`, not client animation state.
- Heartbeats update active-client and latency estimates.

## AI Guardrails

- LLM output must be valid JSON.
- Zod validates every question pack.
- Fairness Agent checks option count, duplicate options, ambiguity, safety, and explanation quality.
- Safety Guard can classify content before acceptance.
- Seed fallback keeps the match playable when API keys are missing, slow, or malformed.
- AI cannot mutate score or rank.

## Demo Honesty

- Simulated players are marked `is_simulated=true`.
- The tech overlay shows real and simulated counts separately.
- The default laptop gateway mirrors the SpacetimeDB reducer contract for reliable local demos.
- Direct SpacetimeDB module build and reducer/table contract live in `modules/spacetime`.

## Network Risk

- Phones need a reachable public or LAN URL.
- `PUBLIC_BASE_URL` should be set to a Cloudflare/ngrok URL for rooms outside the laptop network.
- If the websocket disconnects, the UI shows a reconnecting state.
