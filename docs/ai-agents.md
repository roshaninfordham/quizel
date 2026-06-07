# AI Agents

The AI layer runs outside reducers in `apps/agent-worker`. Reducers remain deterministic and isolated; the worker observes `AgentRequest` and live session state, calls LLM providers, validates JSON, then writes back through reducers.

## Agents

| Agent | Job | Reducer Output |
| --- | --- | --- |
| Intent Parser / Topic Router Agent | Merge expertise-derived topic signals into one tournament topic. | `record_agent_event`, selected topic for generation. |
| Arena Router Agent | Visible pipeline step for grouping similar expertise into fair arenas. Current MVP uses deterministic topic clustering for one sprint arena. | `record_agent_event` in the UI pipeline. |
| Quiz Builder Agent | Generate the configured sprint question count as short MCQs. | `submit_question_pack`. |
| Safety Guard Agent | Optional model-based safety classification. | `record_agent_event`; rejects unsafe content before use. |
| Fairness Agent | Validate options, ambiguity, length, and explanation correctness. | `record_agent_event`; repaired pack if needed. |
| Host Commentator Agent | Short positive commentary after resolved rounds. | `record_agent_event`. |
| Recap Agent | Final learning recap from match data. | `record_agent_event`. |

## Provider Routing

`LLM_PROVIDER_NAME=auto` chooses the first configured provider. It supports generic OpenAI-compatible APIs, OpenAI, NVIDIA, Anthropic, Gemini, mock, and seed fallback.

Configured NVIDIA roles:

- Topic routing, host commentary, and recap: `nvidia/llama-3.1-nemotron-nano-8b-v1`
- Grounded quiz authoring: `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- Fairness/reasoning review: `nvidia/nemotron-3-super-120b-a12b`
- Safety review: `nvidia/llama-3.1-nemotron-safety-guard-8b-v3`

Each NVIDIA route has its own key, concurrency limit, queue timeout, and cooldown. If a route is saturated, rate-limited, malformed, or slow, the worker records a fallback event and publishes the fastest valid deterministic or source-backed pack so real players are not blocked.

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
- topic-specific fallback questions
- reconnecting realtime worker loop
- NVIDIA role-level concurrency limits and cooldowns

Fallback path:

```text
LLM failure, route saturation, rate limit, timeout, or malformed JSON
-> validation error
-> deterministic topic-specific questions
-> AgentEvent(status=fallback)
-> match remains playable
```
