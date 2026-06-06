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

## Expertise Swarm

```text
Phone submits freeform expertise text
-> deterministic intent preview maps text to compact topics
-> submit_topic_vote reducer
-> TopicVote rows replaced for participant
-> MatchEvent(topic_vote)
-> projector recomputes live bars
-> request_questions reducer starts immediately from the phone confirmation
```

## Question Generation

```text
phone confirmation or 5-second expertise window closes
-> request_questions reducer
-> AgentRequest pending
-> Effect worker routes topic + generates quiz
-> Zod validation + optional safety guard
-> submit_question_pack reducer
-> Question rows inserted
-> Session status ready
```

The phone starts the agent request as soon as the player confirms the arena, while the projector keeps a backup automation after the expertise window. It also starts a deterministic 700ms fallback timer. If approved LLM questions are not committed quickly, topic-specific fallback questions are submitted so the judged flow never waits on model latency or falls back to an unrelated quiz. Late LLM packs are ignored once a match has already started with an existing question pack.

## 25-Second Match

```text
questions ready
-> start_match reducer
-> round 1 starts with server starts_at/ends_at inside the match deadline
-> phones render current question
-> submit_answer reducer per tap
-> duplicate check
-> response_ms computed from server time
-> Score row updated
-> ranks recomputed
-> MatchEvent(answer/score_delta/rank_change)
-> projector and phone subscriptions update
```

The sprint uses seven rapid questions inside one `match_started_at + 25s` budget. Rounds can advance early when the room has answered, but no round can extend past the match deadline:

```text
round 1: starts at match start
round N: starts immediately after prior resolve
final round: capped by match_started_at + 25s
```

The projector calls `live_tick` every 500ms so p95 latency, reducer calls, active clients, and answer rates are refreshed by reducer-owned state. The `A` key streams 100 simulated players in small `add_simulated_players` reducer batches, and the active race uses `simulate_answer_burst` reducer calls to commit simulated answers quickly. Those simulated users are marked in state and exist only for honest room-load demonstration.

## Replay

Replay reads `MatchEvent` ordered by `created_at`. It does not trust client animations as the source of truth.
