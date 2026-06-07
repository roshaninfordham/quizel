# Submission Readme

Product: QuizRush Arena

Tagline: A live audience activation game for technical events and learning rooms.

Judges should remember: “One QR. Custom quizzes. Live bracket. Shareable scorecards.”

## What To Demo

- `make online`
- QR lobby with DevRel/hackathon/bootcamp positioning
- phone join
- expertise intent box with optional mic
- topic confirmation
- real topic bubbles from submitted intents
- DB-backed live agent build pipeline
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
