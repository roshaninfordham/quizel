# Capacity Report

Date: 2026-06-07

Deployment measured:

```text
App URL: https://quizel-eta.vercel.app
Join URL: https://quizel-eta.vercel.app/join/ARENA-42
Arena URL: https://quizel-eta.vercel.app/arena/ARENA-42
SpacetimeDB host: https://maincloud.spacetimedb.com
SpacetimeDB module: quizrush-live
Client subscription shape during measurement: subscribeToAllTables
Quiz length during measurement: 10 questions
```

## Current Answer

The deployed system is safe for:

```text
Tracked connected users: 50 passed
Tracked connected users: 100 completed, degraded latency
Tracked connected users: 250 failed during join/intention writes
Admitted active racers: 12 hard cap
```

Keep production admission control at:

```text
MAX_PLAYERS_SOFT=10
MAX_PLAYERS_HARD=12
```

That means a hackathon room can scan the QR and be represented as tracked participants, but the live answering race admits only the measured safe number of active racers. Overflow users are waitlisted/spectators until the subscription/reducer fanout is refactored and re-tested.

## Latest Production Runs

| Run | Connected | Joined | Admitted racers | Waitlisted | Answers committed | FinalResult rows | Current ShareCard rows | Answer p95 | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `stress-50-all-connected-admitted-sharecards` | 50 | 50 | 12 | 38 | 120/120 | 50 | 50 | 420ms | Pass |
| `stress-100-all-connected-admitted-sharecards` | 100 | 100 | 12 | 88 | 120/120 | 100 | 100 | 1285ms | Degraded |
| `stress-250-all-connected-admitted-sharecards` | 250 | 51 | 12 | 39 | 120/120 | 51 | 51 | 1505ms | Fail |

The 250-user run opened 250 WebSocket connections, but 199 join/intention writes failed with `The instance encountered a fatal error`. Do not claim 250 real participants are safe on the current deployed module.

## What The Harness Proves

The production harness:

- Fetches the deployed Vercel join route.
- Opens one SpacetimeDB connection per synthetic phone.
- Uses broad all-table subscriptions to match the current deployed client.
- Calls `join_session` and `submit_player_intent`.
- Lets admission control decide who is admitted versus waitlisted.
- Starts the match.
- Submits answers only from admitted racers, matching real product behavior.
- Waits for committed `Answer`, `Score`, `FinalResult`, and `ShareCard` rows.
- Writes JSON artifacts under `docs/capacity-results/`.

Command examples:

```bash
SUBSCRIBE_MODE=all USERS=50 TOPICS=10 RESET_AFTER=false STATIC_REQUESTS=25 CONNECT_CONCURRENCY=25 JOIN_CONCURRENCY=25 ANSWER_CONCURRENCY=25 RUN_ID=stress-50-all-connected-admitted-sharecards pnpm load:prod

SUBSCRIBE_MODE=all USERS=100 TOPICS=10 RESET_AFTER=false STATIC_REQUESTS=50 CONNECT_CONCURRENCY=50 JOIN_CONCURRENCY=50 ANSWER_CONCURRENCY=25 RUN_ID=stress-100-all-connected-admitted-sharecards pnpm load:prod

SUBSCRIBE_MODE=all USERS=250 TOPICS=10 RESET_AFTER=false STATIC_REQUESTS=50 CONNECT_CONCURRENCY=50 JOIN_CONCURRENCY=50 ANSWER_CONCURRENCY=25 RUN_ID=stress-250-all-connected-admitted-sharecards pnpm load:prod
```

## Visual Rehearsal Load

The cleaned public lobby keeps rehearsal controls off the main screen. The projector keyboard still supports reducer-backed rehearsal: press `A` to stream simulated participants and `S` to start the visual race. These are not fake frontend cards. They call SpacetimeDB/local reducer-compatible `add_simulated_players`, create `Participant` and `Score` rows, and stream into the same roster, bracket, leaderboard, and final/share-card paths.

Use them only as marked rehearsal load when the physical room is small. For real audience capacity claims, use the production load-test table above.

## Why The Cap Exists

Vercel static delivery is healthy; static route p95 was 170ms for 50 and about 100ms for 100/250. The bottleneck is the current realtime fanout:

- Every phone still subscribes broadly.
- `submit_answer` recomputes ranks by sorting session scores.
- Answer bursts update `Answer`, `Score`, `MatchEvent`, `LiveStats`, and share/final state.
- Broad subscriptions push too much state to every client.

Admission control is therefore a correctness feature. It prevents the realtime race from collapsing under untested load.

## Next Capacity Target

Before raising `MAX_PLAYERS_HARD`, implement:

1. Scoped phone subscriptions: own participant, own score, current round/question, own answer, final result, own share card.
2. Projector subscriptions: participants, live stats, top leaderboard, bracket state, recent events only.
3. `LeaderboardTopN` table so phones do not receive every score row.
4. Explicit bracket rows/events for movement instead of deriving all layout client-side.
5. Reduced per-answer `MatchEvent` fanout.
6. Re-run 50, 100, and 250 with the scoped subscription mode.

Only increase the public active-racer cap after the matching artifact passes.
