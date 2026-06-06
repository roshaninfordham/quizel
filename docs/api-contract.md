# API Contract

The web app calls domain hooks, which call reducers through `apps/web/src/lib/spacetime/client.ts`. The same reducer names are implemented by `packages/shared` and `modules/spacetime`.

## Reducers

| Reducer | Args | Effect |
| --- | --- | --- |
| `create_session` | `{ code, questionCount }` | Creates a clean lobby session. |
| `join_session` | `{ code, displayName, avatar }` | Adds or updates one participant and creates a score row. |
| `submit_topic_vote` | `{ sessionId, topics }` | Replaces participant topic votes and writes a `topic_vote` event. |
| `request_questions` | `{ sessionId, topic?, questionCount? }` | Sets status to `generating` and inserts `AgentRequest`. |
| `submit_question_pack` | `{ sessionId, selectedTopic, requestId?, questions }` | Validates and stores approved questions, then sets status to `ready`. |
| `start_match` | `{ sessionId }` | Resets scores and starts round 1 with server timestamps. |
| `start_round` | `{ sessionId, questionOrder }` | Activates a specific question round. |
| `submit_answer` | `{ roundId, selectedOption, clientSentAt? }` | Rejects duplicates, computes response time/score, updates rank, writes replay events. |
| `resolve_round` | `{ roundId }` | Idempotently resolves the round and starts next round or finishes match. |
| `finish_match` | `{ sessionId, force? }` | Finishes the match and writes the final winner event. |
| `heartbeat` | `{ sessionId, clientLatencyMs? }` | Updates last-seen and latency stats. |
| `reset_demo` | `{ sessionId? }` | Returns the demo to a clean lobby. |
| `add_simulated_players` | `{ sessionId, count }` | Adds marked simulated players for honest load demos. |
| `record_agent_event` | `{ sessionId, agentName, eventType, content, confidence, status }` | Appends an agent pipeline event. |

## LLM Schemas

### Topic Router

```json
{
  "selected_topic": "AI + Space + Startups",
  "reason": "Most players selected AI, Space, and Startups.",
  "topic_weights": [{ "topic": "AI", "weight": 0.44 }]
}
```

### Quiz Builder

```json
{
  "questions": [
    {
      "questionText": "Which system is built for live shared state?",
      "options": {
        "A": "Redis",
        "B": "SpacetimeDB",
        "C": "Email",
        "D": "CSV"
      },
      "correctOption": "B",
      "explanation": "SpacetimeDB combines database state, reducers, and realtime subscriptions.",
      "topic": "Realtime systems"
    }
  ]
}
```

### Fairness Agent

```json
{
  "approved": true,
  "rejectedCount": 0,
  "issues": [],
  "fixedQuestions": []
}
```

### Recap Agent

```json
{
  "summary": "The room was fastest on realtime state questions.",
  "hardestConcepts": ["event-ledger replay"],
  "nextQuizRecommendation": "Try a deeper realtime systems quiz next."
}
```
