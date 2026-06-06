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
- final champion
- race replay
- tech overlay

## What Is Real

- Reducer-owned joins, expertise-derived topic votes, answers, scoring, rank recomputation, duplicate rejection, and reset.
- Realtime websocket subscriptions for the laptop demo.
- SpacetimeDB TypeScript module with the same public table/reducer contract.
- Effect worker with provider-neutral LLM adapter, NVIDIA routing, validation, safety guard support, and fallback seed questions.
- MatchEvent ledger used by replay.

## What Is Prototype Scope

- Production auth.
- Profiles.
- Automated public tunnel startup.
- Direct generated SpacetimeDB web bindings as the default transport.
- Long-term content management.

## Backup Plan

If LLM or network fails:

1. Press `R`.
2. Press `A` to add simulated players.
3. Press `S`; `start_match` uses deterministic fallback questions if needed.
4. Press `T` to show duplicate rejection and reducer metrics.
