# Capacity Report

Date: 2026-06-07

Deployment measured:

```text
App URL: https://quizel-eta.vercel.app
Join URL: https://quizel-eta.vercel.app/join/ARENA-42
Arena URL: https://quizel-eta.vercel.app/arena/ARENA-42
SpacetimeDB host: https://maincloud.spacetimedb.com
SpacetimeDB module: quizrush-live
Client subscription shape during measurement: scoped/lean SQL subscriptions
Quiz length during measurement: 10 questions
```

## Current Answer

The deployed system is safe for:

```text
Tracked connected users: 100 passed
Admitted active racers: 100 hard cap
Recommended live demo target: 10-100 real phones
250 connected audience: measured, not claimed for active race pressure
```

Keep production admission control at:

```text
MAX_PLAYERS_SOFT=100
MAX_PLAYERS_HARD=100
```

That means a hackathon room can scan the QR and be represented as tracked participants, but the live answering race admits only the measured safe number of active racers. Overflow users are waitlisted/spectators instead of seeing fatal reducer errors.

## Latest Production Runs

| Run | Connected | Joined | Admitted racers | Waitlisted | Answers committed | FinalResult rows | Current ShareCard rows | Answer p95 | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `load-2026-06-07T11-39-53-229Z` | 50 | 50 | 50 | 0 | 500/500 | 50 | 50 | 1053ms | Functional, latency degraded |
| `load-2026-06-07T11-43-11-645Z` | 100 | 100 | 100 | 0 | 1000/1000 | 100 | 100 | 691ms | Pass |
| `load-2026-06-07T11-57-29-406Z` | 250 | 250 | 100 | 150 | 400/1000 | 250 | 250 | 8799ms | Fail under overflow pressure |

The 100-racer run is the production claim. The 250-audience run proves the room can create tracked rows and waitlist overflow users, but it also shows that answer pressure from 250 live connections still causes late/failed answer commits. Do not advertise 250 active or 250-audience reliability until a newer passing artifact replaces it.

## What The Harness Proves

The production harness:

- Fetches the deployed Vercel join route.
- Opens one SpacetimeDB connection per synthetic phone.
- Uses scoped/lean SpacetimeDB subscriptions instead of all-table replication.
- Calls `join_session` and `submit_player_intent`.
- Calls participant-scoped `request_questions`, matching the phone Enter Race flow.
- Lets admission control decide who is admitted versus waitlisted.
- Starts the match.
- Submits answers only from admitted racers, matching real product behavior.
- Waits for committed `Answer`, `Score`, `FinalResult`, and `ShareCard` rows.
- Writes JSON artifacts under `docs/capacity-results/`.

Command examples:

```bash
USERS=50 TOPICS=5 STATIC_REQUESTS=10 CONNECT_CONCURRENCY=25 JOIN_CONCURRENCY=25 ANSWER_CONCURRENCY=100 SUBSCRIBE_MODE=lean pnpm load:prod

USERS=100 TOPICS=10 STATIC_REQUESTS=20 CONNECT_CONCURRENCY=50 JOIN_CONCURRENCY=50 ANSWER_CONCURRENCY=100 SUBSCRIBE_MODE=lean pnpm load:prod
```

## Visual Rehearsal Load

The cleaned public lobby keeps rehearsal controls off the main screen. The projector keyboard still supports reducer-backed rehearsal: press `A` to stream simulated participants and `S` to start the visual race. These are not fake frontend cards. They call SpacetimeDB/local reducer-compatible `add_simulated_players`, create `Participant` and `Score` rows, and stream into the same roster, bracket, leaderboard, and final/share-card paths.

Use them only as marked rehearsal load when the physical room is small. For real audience capacity claims, use the production load-test table above.

## Why The Cap Exists

Vercel static delivery is healthy; the latest 100-racer run fetched deployed routes with static p95 under 100ms. The remaining bottleneck is live realtime pressure:

- 100 active racers pass with scoped subscriptions and deferred global rank recomputation.
- 250 connected clients still add enough subscription/reducer pressure to produce late answers in the current module.
- The projector renders a capped visual bracket and aggregate counts rather than thousands of DOM nodes.

Admission control is therefore a correctness feature. It prevents the realtime race from collapsing under untested load.

## Next Capacity Target

Before raising `MAX_PLAYERS_HARD` above 100, implement:

1. `LeaderboardTopN` table so phones/projector do not need every `Score` row.
2. Explicit persisted bracket rows/events for movement instead of deriving all layout client-side.
3. Reduced per-answer `MatchEvent` fanout.
4. A race scheduler that does not rely on 40 duplicate resolve calls from the harness.
5. Re-run 100, 250, and 500 with scoped subscriptions.

Only increase the public active-racer cap after the matching artifact passes.
