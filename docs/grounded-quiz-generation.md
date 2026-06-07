# Grounded Quiz Generation

QuizRush must never generate generic meta questions for a specific topic. The failure mode to avoid is:

```text
Topic: Andaman Islands
Bad: What is the best first step when learning Andaman Islands?
```

The accepted path is:

```text
raw topic
-> normalize intent
-> resolve canonical topic
-> use exact/alias/semantic cache when available
-> fetch compact facts with Firecrawl when the worker is configured
-> use grounded deterministic pack or grounded LLM pack
-> validate pack
-> commit TopicFact rows and source metadata
-> commit questions through SpacetimeDB reducers
-> clients receive questions through subscriptions
```

## Current Guardrails

- `normalizeIntent("Andaman")` resolves to `Andaman Islands`.
- `buildTopicFallbackQuestions("Andaman")` returns factual Andaman Islands questions.
- Deterministic packs carry `factIds`.
- Firecrawl-backed packs carry `factIds`, `sourceTitle`, and `sourceUrl`.
- The worker rejects banned meta-question patterns.
- Unsupported long-tail fallback uses real general-knowledge facts rather than pretending to know the requested topic.

## Banned Patterns

These patterns are rejected:

```text
What is the best first step when learning [topic]?
A good [topic] question should be...
Which signal should shape this arena?
What should an AI quiz avoid in [topic]?
Why keep [topic] questions short?
Which is a valid quiz question?
What should you do before studying [topic]?
```

## Next Engineering Step

## Firecrawl Grounding

The Effect worker can call Firecrawl's API directly when these variables are configured:

```text
FIRECRAWL_ENABLED=true
FIRECRAWL_API_KEY=...
FIRECRAWL_TIMEOUT_MS=1500
FIRECRAWL_SEARCH_LIMIT=4
FIRECRAWL_MAX_FACTS=10
```

The worker uses Firecrawl search with scraped summary/markdown formats, extracts 5-10 compact facts, writes those facts through the `submit_topic_facts` reducer, and then asks the LLM to generate questions using only those facts. Large raw pages are never stored in SpacetimeDB.

Runtime path:

```text
player intent
-> request_questions reducer
-> AgentRequest row
-> Firecrawl Grounding Agent
-> compact TopicFact rows
-> grounded LLM generation from FactCards only
-> validation
-> SpacetimeDB submit_question_pack
```

Reducers should remain the only game-critical mutation path. The worker can fetch sources and generate packs, but scores, ranks, answer locking, and final state must stay server-authoritative in SpacetimeDB.

If Firecrawl or the LLM misses the deadline, the app records a fallback agent event and keeps the race live with the safest available pack. The demo should describe this honestly as deadline-based realtime grounding, not zero-millisecond AI generation.
