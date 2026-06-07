# Timing And Scoring

SpacetimeDB is authoritative for official timing, correctness, score, rank, and final result.

## Timing

Rounds are scheduled in the future:

```text
startsAtServerMs = serverNow + ROUND_LEAD_TIME_MS
endsAtServerMs = startsAtServerMs + QUESTION_TIME_MS
```

Official response time:

```text
officialResponseMs = serverReceivedAtMs - startsAtServerMs
```

Observed tap time:

```text
observedResponseMs = clientClickedAtMs - clientQuestionRenderedAtMs
```

Observed tap time is stored only for diagnostics and can be flagged as suspicious. It never decides score or rank.

## Scoring

```text
if correct:
  scoreDelta = 1000 + floor(1000 * (1 - officialResponseMs / QUESTION_TIME_MS)) + streakBonus
else:
  scoreDelta = 0
```

Rank comparator:

```text
totalScore desc
correctCount desc
totalOfficialResponseMs asc
fastestOfficialResponseMs asc
lastAnswerAtMs asc
participantId asc
```

## Mermaid

```mermaid
sequenceDiagram
  participant U as Phone
  participant DB as SpacetimeDB
  participant S as QuestionSecret
  participant R as Score/FinalResult

  U->>DB: submit_answer(roundId, option, observed timing)
  DB->>DB: check round active and server time
  DB->>S: read hidden correct option
  DB->>DB: calculate officialResponseMs
  DB->>R: update score/rank
  DB-->>U: subscribed Answer + Score rows
```
