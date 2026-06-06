# Realtime Flow

## QR Join

```text
Phone scans QR
-> /join/ARENA-42
-> browser opens laptop LAN/tunnel URL, not localhost
-> websocket connects to the same origin at /quizrush-ws
-> join_session reducer
-> Participant + Score row inserted
-> LiveStats joined_count updates
-> projector subscription renders avatar and count
```

## Topic Swarm

```text
Phone locks topics
-> submit_topic_vote reducer
-> TopicVote rows replaced for participant
-> MatchEvent(topic_vote)
-> projector recomputes live bars
```

## Question Generation

```text
Projector key G
-> request_questions reducer
-> AgentRequest pending
-> Effect worker routes topic + generates quiz
-> Zod validation + optional safety guard
-> submit_question_pack reducer
-> Question rows inserted
-> Session status ready
```

The projector also starts a deterministic fallback timer. If approved LLM questions are not committed quickly, seed questions are submitted so the judged flow never waits on model latency. Late LLM packs are ignored once a match has already started with an existing question pack.

## 25-Second Match

```text
Projector key S
-> start_match reducer
-> round 1 starts with server starts_at/ends_at anchored to match_started_at
-> phones render current question
-> submit_answer reducer per tap
-> duplicate check
-> response_ms computed from server time
-> Score row updated
-> ranks recomputed
-> MatchEvent(answer/score_delta/rank_change)
-> projector and phone subscriptions update
```

All five rounds are anchored to the same `match_started_at` value:

```text
round 1: +0s  to +5s
round 2: +5s  to +10s
round 3: +10s to +15s
round 4: +15s to +20s
round 5: +20s to +25s
```

The projector calls `live_tick` every 500ms so p95 latency, reducer calls, active clients, and answer rates are refreshed by reducer-owned state. The `A` key streams 100 simulated players in small `add_simulated_players` reducer batches, and the active race uses `simulate_answer_burst` reducer calls to commit simulated answers quickly. Those simulated users are marked in state and exist only for honest room-load demonstration.

## Replay

Replay reads `MatchEvent` ordered by `created_at`. It does not trust client animations as the source of truth.
