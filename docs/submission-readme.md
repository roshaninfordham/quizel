# Submission Readme

Product: QuizRush Live

Tagline: A 25-second real-time quiz tournament from one QR code.

Judges should remember: “The whole room scanned one QR code and became a live tournament bracket in 25 seconds.”

## What To Demo

- `make online`
- QR lobby
- phone join
- topic swarm
- agent pipeline
- 25-second match
- live leaderboard and bracket
- final champion
- race replay
- tech overlay

## What Is Real

- Reducer-owned joins, topic votes, answers, scoring, rank recomputation, duplicate rejection, and reset.
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
