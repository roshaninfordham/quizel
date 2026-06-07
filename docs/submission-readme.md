# Submission Readme

Product: QuizRush Arena

Tagline: A 25-second AI-personalized quiz tournament from one QR code.

Judges should remember: “The whole room scanned one QR code, shared expertise, and became a live AI-generated tournament in 25 seconds.”

## What To Demo

- `make online`
- QR lobby
- phone join
- expertise intent box with optional mic
- detected arena confirmation
- expertise swarm
- agent pipeline
- 25-second match
- live leaderboard and bracket
- room roster showing tracked joined profiles
- final champion
- race replay
- tech overlay

## What Is Real

- Reducer-owned joins, expertise-derived topic votes, answers, scoring, rank recomputation, duplicate rejection, and reset.
- Realtime websocket subscriptions for the laptop demo.
- SpacetimeDB TypeScript module with the same public table/reducer contract.
- Durable FinalResult and ShareCard rows for every participant in tested sessions.
- Heartbeat-based stale participant elimination without deleting score history.
- Effect worker with provider-neutral LLM adapter, NVIDIA routing, validation, safety guard support, and topic-specific fallback questions.
- MatchEvent ledger used by replay.

## What Is Prototype Scope

- Production auth.
- Profiles.
- Automated public tunnel startup.
- Long-term content management.
- Always-on hosted Firecrawl/LLM worker unless deployed separately.

## Backup Plan

If LLM or network fails:

1. Press `R`.
2. Press `A` to add simulated players.
3. Press `S`; `start_match` uses deterministic questions for the selected live topic if needed.
4. Press `T` to show duplicate rejection and reducer metrics.
