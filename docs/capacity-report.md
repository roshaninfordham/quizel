# Capacity Report

Date: 2026-06-07

Deployment measured:

```text
App URL: https://quizel-eta.vercel.app
Join URL: https://quizel-eta.vercel.app/join/ARENA-42
SpacetimeDB host: https://maincloud.spacetimedb.com
SpacetimeDB module: quizrush-live
Client subscription shape during measurement: subscribeToAllTables for each phone
Quiz length during measurement: 7 questions
Current code after authoritative scoring refactor: 10 questions
```

## Current Answer

The current deployed system should be capped at:

```text
MAX_PLAYERS_SOFT=10
MAX_PLAYERS_HARD=12
```

That is the honest measured capacity for the deployed implementation tested on 2026-06-07 if the requirement is that every player can join, answer every question, receive committed score/rank state, and finish the race. After the authoritative scoring refactor and 10-question switch, the new smoke boundary at 10 users passed. Keep the hard cap at 12 until a fresh 12-user, 10-question run passes.

Do not claim 50, 100, 200, or 1,000 real simultaneous racers for the current deployed system yet. Vercel static delivery is not the bottleneck; the bottleneck is the current SpacetimeDB reducer/subscription shape under answer bursts.

## Measurement Method

Added production load harness:

```bash
make load-smoke
make load USERS=12 TOPICS=4
USERS=100 TOPICS=10 STATIC_REQUESTS=100 CONNECT_CONCURRENCY=50 JOIN_CONCURRENCY=50 ANSWER_CONCURRENCY=200 pnpm load:prod
```

The harness:

- Fetches the deployed Vercel join route.
- Opens one SpacetimeDB connection per synthetic phone.
- Uses broad subscriptions to match the current deployed client behavior.
- Joins each synthetic player.
- Submits player intent rows.
- Starts the match.
- Answers every active round.
- Waits for committed `Answer` rows, `Score` rows, round transitions, and final session status.
- Writes results under `docs/capacity-results/`.

Latest 10-question smoke result after the refactor:

```text
Run: docs/capacity-results/load-2026-06-07T06-55-18-900Z.json
Users: 10
Connected: 10 / 10
Joined: 10 / 10
Committed answers: 100 / 100
Rounds resolved: 10 / 10
Final status: finished
Answer p50: 25ms
Answer p95: 35ms
Static Vercel fetch p95: 175ms
Result: pass
```

Previous 7-question boundary result:

```text
Run: docs/capacity-results/load-2026-06-07T06-16-50-592Z.json
Users: 12
Connected: 12 / 12
Joined: 12 / 12
Committed answers: 84 / 84
Rounds resolved: 7 / 7
Final status: finished
Answer p50: 30ms
Answer p95: 37ms
Static Vercel fetch p95: 206ms
Result: pass
```

## Boundary Results

| Users | Result | Notes |
| ---: | --- | --- |
| 10 | Pass | 100/100 committed answers on the 10-question refactor, p95 answer 35ms, finished. |
| 10 | Pass | Previous 7-question run: 70/70 committed answers, p95 answer 32ms, finished. |
| 11 | Pass | Previous 7-question run: 77/77 committed answers, p95 answer 41ms, finished. |
| 12 | Pass | Previous 7-question run: 84/84 committed answers, p95 answer 37ms, finished. |
| 13 | Fail | Joined, but 0 committed answers in the failed run; SpacetimeDB reported fatal instance errors during round flow. |
| 14 | Fail | Joined, but 0 committed answers in the failed run; round flow stalled. |
| 20 | Fail | Joined, but only 60/140 expected answers committed in repeated runs. |
| 50 | Degraded exploratory | One run committed 350/350 answers, but answer p95 reached 831ms. This is not a safe claim because higher/lower boundary runs showed instability. |
| 100 | Fail | 100 joined, but only 300/700 answers committed; 400 answer reducer calls failed with fatal instance errors and p95 answer latency reached 9256ms. |

## Why Vercel Is Not The Bottleneck

The measured Vercel static route fetches stayed healthy in these tests. The latest 12-user run fetched the deployed join page with p95 206ms.

This app should not use Vercel Functions as the realtime race server. Vercel documents that Vercel Functions do not support acting as a WebSocket server and recommends third-party realtime solutions for realtime communication. Vercel Hobby is also a personal/small-scale free plan with included usage limits, so the live race capacity must be measured from the realtime backend, not inferred from CDN capacity.

Relevant docs:

- https://vercel.com/docs/limits
- https://vercel.com/docs/plans/hobby

## Why SpacetimeDB Is Still The Right Core

SpacetimeDB reducers are still the right authority boundary: reducers mutate database state in transactions with isolation, atomicity, and consistency guarantees. Subscriptions replicate rows in real time and update client caches when rows change.

The current problem is not "SpacetimeDB cannot do realtime quizzes." The current problem is our module/client shape:

- Every phone subscribes to all tables.
- `submit_answer` recomputes ranks by sorting all scores on every answer.
- Every answer inserts multiple `MatchEvent` rows.
- Rank changes can add more event rows during answer bursts.
- Phones receive rows they do not need.
- Broad phone subscriptions still create unnecessary fanout.

Relevant docs:

- https://spacetimedb.com/docs/functions/
- https://spacetimedb.com/docs/clients/subscriptions/
- https://spacetimedb.com/docs/clients/subscriptions/semantics/

## Recommendation For Demo

Use:

```text
Soft cap: 10 active racers
Hard cap: 12 active racers
Spectators: unlimited only as non-answering viewers after a separate spectator view is implemented
```

Demo wording:

```text
This current deployment is measured for 12 simultaneous active racers on the live Vercel + SpacetimeDB setup. We cap admitted racers to protect realtime scoring and queue everyone else as spectators or for the next sprint.
```

Do not say:

```text
Near 0ms latency.
100 users currently work.
1,000 users currently work.
Vercel free tier is the race capacity.
```

## Required Fixes Before Raising The Cap

1. Split `QuestionPublic` from `QuestionSecret`.
2. Make phones subscribe only to their participant, current round, public question, own score, and top leaderboard rows.
3. Move projector to `LeaderboardTopN`, not all `Score` rows.
4. Add explicit `BracketSlot` / `AdvancementEvent` rows for a fully persistent fixture history.
5. Stop inserting public `score_delta` events for zero-point or non-product replay rows.
6. Keep authoritative scoring in `submit_answer`, but reduce fanout and per-answer work.
7. Add a load target only after those changes:

```bash
make load USERS=50 TOPICS=10
make load USERS=100 TOPICS=10
make load USERS=250 TOPICS=25
```

The next credible target after refactor is 50 active racers, then 100, then 250. Each increase requires a passing capacity artifact in `docs/capacity-results/`.
