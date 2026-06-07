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
Tracked connected users above 50: not claimed in this build
Admitted active racers: 25 hard cap
Recommended live demo target: 10-20 real phones
```

Keep production admission control at:

```text
MAX_PLAYERS_SOFT=20
MAX_PLAYERS_HARD=25
```

That means a hackathon room can scan the QR and be represented as tracked participants, but the live answering race admits only the measured safe number of active racers. Overflow users are waitlisted/spectators instead of seeing fatal reducer errors.

## Latest Production Runs

| Run | Connected | Joined | Admitted racers | Waitlisted | Answers committed | FinalResult rows | Current ShareCard rows | Answer p95 | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `load-2026-06-07T10-52-34-263Z` | 20 | 20 | 20 | 0 | 200/200 | 20 | 20 | 122ms | Pass |
| `load-2026-06-07T10-52-53-445Z` | 50 | 50 | 25 | 25 | 250/250 | 50 | 50 | 516ms | Pass |
| `stress-100-all-connected-admitted-sharecards` | 100 | 100 | 12 | 88 | 120/120 | 100 | 100 | 1285ms | Old degraded baseline |
| `stress-250-all-connected-admitted-sharecards` | 250 | 51 | 12 | 39 | 120/120 | 51 | 51 | 1505ms | Old failed baseline |

The old 250-user baseline opened 250 WebSocket connections, but 199 join/intention writes failed with `The instance encountered a fatal error`. This build fixes the real demo target by moving phone packs to participant-scoped rows, disabling real-user auto-start, and making late joins become tracked spectators. Do not claim 100+ active racers until a new post-fix 100/250 run passes.

## What The Harness Proves

The production harness:

- Fetches the deployed Vercel join route.
- Opens one SpacetimeDB connection per synthetic phone.
- Uses broad all-table subscriptions to match the current deployed client.
- Calls `join_session` and `submit_player_intent`.
- Calls participant-scoped `request_questions`, matching the phone Enter Race flow.
- Lets admission control decide who is admitted versus waitlisted.
- Starts the match.
- Submits answers only from admitted racers, matching real product behavior.
- Waits for committed `Answer`, `Score`, `FinalResult`, and `ShareCard` rows.
- Writes JSON artifacts under `docs/capacity-results/`.

Command examples:

```bash
USERS=20 TOPICS=5 STATIC_REQUESTS=10 CONNECT_CONCURRENCY=20 JOIN_CONCURRENCY=20 ANSWER_CONCURRENCY=60 pnpm load:prod

USERS=50 TOPICS=5 STATIC_REQUESTS=20 CONNECT_CONCURRENCY=25 JOIN_CONCURRENCY=25 ANSWER_CONCURRENCY=80 pnpm load:prod
```

## Visual Rehearsal Load

The cleaned public lobby keeps rehearsal controls off the main screen. The projector keyboard still supports reducer-backed rehearsal: press `A` to stream simulated participants and `S` to start the visual race. These are not fake frontend cards. They call SpacetimeDB/local reducer-compatible `add_simulated_players`, create `Participant` and `Score` rows, and stream into the same roster, bracket, leaderboard, and final/share-card paths.

Use them only as marked rehearsal load when the physical room is small. For real audience capacity claims, use the production load-test table above.

## Why The Cap Exists

Vercel static delivery is healthy; static route p95 was 170ms for 50 and about 100ms for 100/250. The bottleneck is the current realtime fanout:

- The production client still subscribes broadly.
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
