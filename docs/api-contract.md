# API Contract

Reducer names use snake_case to match SpacetimeDB generated client conventions.

## Reducers

- `create_session(topic, difficulty, question_count)`
- `open_lobby(session_id)`
- `request_questions(session_id, topic, difficulty, question_count)`
- `submit_question_batch(session_id, questions_json, request_id?)`
- `record_agent_event(session_id, agent_name, event_type, content, confidence, status)`
- `join_session(join_code, display_name, role_requested, interests_json)`
- `heartbeat(session_id)`
- `assign_champions_randomly(session_id)`
- `player_ready(match_id)`
- `start_match(match_id)`
- `start_round(match_id, round_number)`
- `submit_answer(round_id, selected_option)`
- `submit_playalong_answer(round_id, selected_option)`
- `support_player(round_id, player_id, amount, client_event_id?)`
- `resolve_round(round_id)`
- `finish_match(match_id)`
- `reset_demo(session_id)`
- `add_simulated_supporters(session_id, count)`

## LLM Schema

```json
{
  "questions": [
    {
      "questionText": "string",
      "options": {
        "A": "string",
        "B": "string",
        "C": "string",
        "D": "string"
      },
      "correctOption": "A",
      "explanation": "string",
      "difficulty": "beginner",
      "topicTags": ["string"]
    }
  ]
}
```

## Scoring

- Correct answer: 1000 points.
- Speed bonus: up to 500 points.
- Crowd boost: 10 points per 25 Energy, capped at 200.
- Wrong answers receive no speed bonus.
- Round resolution is idempotent.
