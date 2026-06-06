# Realtime Performance

QuizRush Arena does not claim fixed sub-millisecond internet latency. The credible claim is:

> SpacetimeDB is the authoritative real-time match engine, and the UI displays measured p95 latency live.

## What Is Measured

- `answers/sec`: committed answers per second.
- `reducer calls`: reducer activity from joins, answers, ticks, generation, reset, and simulation.
- `duplicate taps rejected`: actual duplicate answer rejections.
- `p95 latency`: live approximate sync metric shown in the UI.
- `MatchEvents recorded`: append-only replay events.

## Realtime State Rules

- Client taps can animate immediately for feel.
- Authoritative answer lock, score, rank, and replay state come from reducer commits.
- `submit_answer` uses server time for `response_ms`.
- One answer per participant per round is enforced by reducers.
- Round advancement and match finish are server-authoritative reducer operations.

## Subscription Strategy

Phone:

- own participant
- own score
- current round/question
- own answer
- session phase

Projector:

- session
- live stats
- participants/recent roster
- current round/question
- top leaderboard rows
- recent match events
- agent events

Replay:

- ordered `MatchEvent` ledger

## Tunnel Reality

Public tunnels are for demo reachability, not a latency guarantee. `make online-public` now verifies both the public HTTP page and `/quizrush-ws` websocket before printing a QR.

## SpacetimeDB Skills-Based Transport Plan

Use generated TypeScript bindings:

```bash
pnpm spacetime:generate
```

Then wire the browser transport around:

```ts
import { DbConnection, tables } from "./module_bindings";

DbConnection.builder()
  .withUri(import.meta.env.VITE_SPACETIMEDB_HOST)
  .withDatabaseName(import.meta.env.VITE_SPACETIMEDB_MODULE)
  .onConnect((ctx) => {
    ctx.subscriptionBuilder().subscribe([
      tables.session,
      tables.liveStats,
      tables.score,
      tables.matchEvent,
    ]);
  })
  .build();
```

The judged laptop flow currently uses the local reducer gateway for reliability through public tunnels. The direct SpacetimeDB SDK transport should replace that gateway once generated binding names and subscription shapes are verified in this repo.
