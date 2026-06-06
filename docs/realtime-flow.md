# Realtime Flow

## QR Join

```text
Phone scans QR
-> /join/ARENA-42
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

## 25-Second Match

```text
Projector key S
-> start_match reducer
-> round 1 starts with server starts_at/ends_at
-> phones render current question
-> submit_answer reducer per tap
-> duplicate check
-> response_ms computed from server time
-> Score row updated
-> ranks recomputed
-> MatchEvent(answer/score_delta/rank_change)
-> projector and phone subscriptions update
```

## Replay

Replay reads `MatchEvent` ordered by `created_at`. It does not trust client animations as the source of truth.
