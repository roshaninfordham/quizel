# Scoring

The official score is calculated inside `submit_answer`. The phone can animate immediately after a tap, but score, correctness, response time, and rank come from subscribed rows.

```mermaid
flowchart TD
    A[Answer received] --> B[Read active Round]
    B --> C{Admitted participant?}
    C -- No --> X[Reject]
    C -- Yes --> D{Duplicate round answer or clientEventId?}
    D -- Yes --> Y[Reject duplicate]
    D -- No --> E[Server timestamp]
    E --> F[Read hidden correct option]
    F --> G{Correct?}
    G -- Yes --> H[1000 base + speed bonus + streak bonus]
    G -- No --> I[0 points]
    H --> J[Insert Answer row]
    I --> J
    J --> K[Update Score row]
    K --> L[Recompute rank]
    L --> M[Subscriptions update phone/projector]
```

## Formula

```text
responseMsServer = serverReceivedAtMs - round.startsAtMs
responseMsClamped = clamp(responseMsServer, 0, 2500)

if correct:
  correctnessPoints = 1000
  speedBonus = floor(1000 * (1 - responseMsClamped / 2500))
  streakBonus = previousAnswerWasCorrect ? 100 : 0
else:
  correctnessPoints = 0
  speedBonus = 0
  streakBonus = 0

scoreDelta = correctnessPoints + speedBonus + streakBonus
```

## Rank Comparator

```text
1. totalScore desc
2. correctCount desc
3. totalResponseMsServer asc
4. fastestResponseMsServer asc
5. lastAnswerAtMs asc
6. participantId asc
```

## Stored Per Answer

- selected option
- hidden correctness result
- server response time
- client timestamp for analytics only
- client event id for idempotency
- correctness points
- speed bonus
- streak bonus
- score delta
- server receipt timestamp

The client cannot set official score, rank, correctness, or response time.
