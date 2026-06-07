# Data Model

QuizRush Arena uses reducer-owned game state. Clients call reducers and subscribe to table updates; clients never calculate authoritative score or rank.

## Tables

| Table | Purpose |
| --- | --- |
| `Session` | Session code, status, selected topic, current round, match timestamps. |
| `Participant` | Joined player identity, display name, avatar, admission status, champion status, simulated flag, heartbeat latency. |
| `PlayerIntent` | Raw expertise text/transcript source plus cleaned text, canonical topics, topic key, arena name, confidence, and pack status. |
| `TopicVote` | One latest expertise-derived topic set per participant, stored as rows for live swarm counts. |
| `Question` | Ten approved sprint questions with options, correct option, explanation, and source. |
| `Round` | Server-side start/end timestamps for each rapid question, capped by the 25-second match deadline. |
| `Answer` | One committed answer per participant per round with server response time, client event id, and score component fields. |
| `Score` | Cached total score, correct count, wrong count, response time, fastest answer, streak, normalized score, current rank. |
| `FinalResult` | Snapshot of final score/rank fields created at finish so result screens render quickly. |
| `ShareCard` | Public score-card snapshot with unique slug. |
| `SessionCapacity` | Soft/hard racer caps, admitted count, waitlist count, and capacity status. |
| `AdmissionTicket` | Per-participant admitted/waitlisted/spectator/rejected state. |
| `MatchEvent` | Event ledger for join, topic vote, answer, score delta, rank change, round resolved, match finished. |
| `AgentRequest` | Pending quiz generation/recap work for the Effect worker. |
| `AgentEvent` | Visible agent pipeline events and fallback logs. |
| `LiveStats` | Joined counts split by real/simulated players, answer rate, reducer calls, duplicate rejects, p95 latency. |
| `AuditEvent` | Operator/system audit trail for demo reset and session changes. |
| `OperationTrace` | Per-reducer trace ledger with reducer name, identity, success/failure, duration, and state version. |

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
- The main projector does not show raw ledger rows; replay/ledger data is in the technical drawer.
- `OperationTrace` records reducer execution so the tech overlay can show actual operation pressure and timing.
- Live metrics are refreshed through reducers such as `live_tick`, not client-only counters.
- Freeform expertise is committed as `PlayerIntent` and mirrored into compact `TopicVote` rows for the judged single-arena sprint. Production multi-arena mode should add `Arena` and `ArenaMember` tables.

## Scoring

```text
if correct:
  base = 1000
  speed_bonus = floor(1000 * clamp(1 - response_ms / round_time_limit_ms, 0, 1))
  streak_bonus = previous_answer_correct ? 100 : 0
else:
  base = 0
  speed_bonus = 0
  streak_bonus = 0

score_delta = base + speed_bonus + streak_bonus
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
