# AI Agents

The AI layer runs outside reducers in `apps/agent-worker`. Reducers remain deterministic and isolated; the worker observes `AgentRequest` and live session state, calls LLM providers, validates JSON, then writes back through reducers.

## Agents

| Agent | Job | Reducer Output |
| --- | --- | --- |
| Topic Router Agent | Merge topic votes into one tournament topic. | `record_agent_event`, selected topic for generation. |
| Quiz Builder Agent | Generate exactly five short MCQ questions. | `submit_question_pack`. |
| Safety Guard Agent | Optional model-based safety classification. | `record_agent_event`; rejects unsafe content before use. |
| Fairness Agent | Validate options, ambiguity, length, and explanation correctness. | `record_agent_event`; repaired pack if needed. |
| Host Commentator Agent | Short positive commentary after resolved rounds. | `record_agent_event`. |
| Recap Agent | Final learning recap from match data. | `record_agent_event`. |

## Provider Routing

`LLM_PROVIDER_NAME=auto` chooses the first configured provider. It supports generic OpenAI-compatible APIs, OpenAI, NVIDIA, Anthropic, Gemini, mock, and seed fallback.

Configured NVIDIA roles:

- Topic/Quiz Builder: `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- Fairness/Reasoning: `nvidia/nemotron-3-super-120b-a12b`
- Fast commentary/recap: `nvidia/llama-3.1-nemotron-nano-8b-v1`
- Safety: `nvidia/llama-3.1-nemotron-safety-guard-8b-v3`

Real API keys live only in `.env.local`.

## Guardrails

All prompts include:

- Return valid JSON only.
- Do not include markdown.
- Do not invent sources or citations.
- Keep content suitable for a public hackathon audience.
- Avoid political, sexual, violent, hateful, medical/legal/financial advice, and gambling content.
- Use the output schema exactly.
- Keep questions and explanations short.

## Reliability

Effect provides:

- typed configuration
- provider service layers
- retries with exponential backoff
- timeouts
- structured errors
- schema validation
- fallback seed questions
- reconnecting realtime worker loop

Fallback path:

```text
LLM failure or malformed JSON
-> validation error
-> deterministic seed questions
-> AgentEvent(status=fallback)
-> match remains playable
```
