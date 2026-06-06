# Data Model

QuizRush Arena uses reducer-owned game state. Clients call reducers and subscribe to table updates; clients never calculate authoritative score or rank.

## Tables

| Table | Purpose |
| --- | --- |
| `Session` | Session code, status, selected topic, current round, match timestamps. |
| `Participant` | Joined player identity, display name, avatar, simulated flag, heartbeat latency. |
| `PlayerIntent` | Raw expertise text/transcript source plus cleaned text, canonical topics, topic key, arena name, confidence, and pack status. |
| `TopicVote` | One latest expertise-derived topic set per participant, stored as rows for live swarm counts. |
| `Question` | Seven approved sprint questions with options, correct option, explanation, and source. |
| `Round` | Server-side start/end timestamps for each rapid question, capped by the 25-second match deadline. |
| `Answer` | One committed answer per participant per round. |
| `Score` | Cached total score, correct count, response time, fastest answer, current rank. |
| `MatchEvent` | Event ledger for join, topic vote, answer, score delta, rank change, round resolved, match finished. |
| `AgentRequest` | Pending quiz generation/recap work for the Effect worker. |
| `AgentEvent` | Visible agent pipeline events and fallback logs. |
| `LiveStats` | Joined counts split by real/simulated players, answer rate, reducer calls, duplicate rejects, p95 latency. |
| `AuditEvent` | Operator/system audit trail for demo reset and session changes. |

## Session Status

```text
lobby -> topic_voting -> generating -> ready -> playing -> finished -> replay
```

## Critical Invariants

- All core mutations happen through reducers.
- A participant answers at most once per round.
- Response time is computed from server time.
- Score and rank are server-authoritative.
- Wrong answers receive no speed bonus.
- Duplicate answers are rejected and counted.
- AI can submit question packs and agent events, but cannot mutate scores.
- Replay is reconstructed from `MatchEvent`, not from client-only animation state.
- Live metrics are refreshed through reducers such as `live_tick`, not client-only counters.
- Freeform expertise is committed as `PlayerIntent` and mirrored into compact `TopicVote` rows for the judged single-arena sprint. Production multi-arena mode should add `Arena` and `ArenaMember` tables.

## Scoring

```text
if correct:
  base = 1000
  speed_bonus = floor(1000 * clamp(1 - response_ms / round_time_limit_ms, 0, 1))
else:
  base = 0
  speed_bonus = 0

score_delta = base + speed_bonus
```

Tie-breakers:

```text
1. higher total_score
2. higher correct_count
3. lower total_response_ms
4. lower fastest_response_ms
5. earlier final answer timestamp
6. deterministic participant_id ordering
```
