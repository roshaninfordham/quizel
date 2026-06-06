# Architecture

QuizRush Arena is built around one judged workflow: a public arena QR, a one-route phone controller, freeform expertise intent, AI-generated questions, a 25-second match, and event-ledger replay.

## System

```mermaid
flowchart LR
    Terminal[make online CLI] --> STDB[(SpacetimeDB)]
    Terminal --> Web[Vite Web App]
    Terminal --> Worker[Effect Agent Worker]
    Terminal --> Gateway[Local Realtime Gateway]

    Phones[Audience Phones] -->|join_session / submit_answer| Gateway
    Projector[Projector Arena] -->|subscriptions| Gateway
    Tech[Tech Overlay] -->|subscriptions| Gateway

    Gateway -->|same reducer contract| STDB
    Worker -->|subscribe AgentRequest / Session state| Gateway
    Worker -->|generic LLM calls| LLM[Swappable LLM Provider]
    Worker -->|submit_question_pack / record_agent_event| Gateway

    Gateway -->|live table snapshots| Phones
    Gateway -->|live table snapshots| Projector
    Gateway -->|live table snapshots| Tech
```

## Realtime Sequence

```mermaid
sequenceDiagram
    participant Host as Presenter Terminal
    participant DB as SpacetimeDB
    participant P as Projector
    participant U as Phone User
    participant W as Effect Worker
    participant L as LLM Provider

    Host->>DB: create_session()
    P->>DB: subscribe Session/Participants/LiveStats
    U->>DB: join_session()
    DB-->>P: joined count update
    U->>DB: submit_topic_vote(expertise-derived topics)
    W->>DB: subscribe TopicVote / AgentRequest
    W->>L: route topic + generate quiz JSON
    L-->>W: questions
    W->>W: validate + fairness review
    W->>DB: submit_question_pack()
    Host->>DB: start_match()
    U->>DB: submit_answer()
    DB-->>P: score/rank update
    DB-->>U: own score update
    DB-->>P: final winner + replay ledger
```

## State Machine

```mermaid
stateDiagram-v2
    [*] --> Lobby
    Lobby --> TopicVoting: first participants join
    TopicVoting --> Generating: request_questions()
    Generating --> Ready: questions approved
    Ready --> Playing: start_match()
    Playing --> Finished: final round resolved
    Finished --> Replay: replay visible
    Replay --> Lobby: reset_demo()
```

## Scoring Flow

```mermaid
flowchart TD
    A[submit_answer] --> B{Round active?}
    B -- No --> X[Reject]
    B -- Yes --> C{Already answered?}
    C -- Yes --> Y[Reject duplicate]
    C -- No --> D[Compute server response_ms]
    D --> E[Check correctness]
    E --> F[Compute score_delta]
    F --> G[Insert Answer]
    G --> H[Update Score]
    H --> I[Recompute ranks]
    I --> J[Insert MatchEvent]
    J --> K[Subscriptions update projector and phones]
```

## Packages

- `apps/web`: projector arena, phone route, tech overlay.
- `apps/realtime-server`: laptop websocket reducer gateway for reliable local demos.
- `apps/agent-worker`: Effect-powered agent worker and provider-neutral LLM adapters.
- `modules/spacetime`: SpacetimeDB table/reducer module matching the shared contract.
- `packages/shared`: reducer engine, types, schemas, scoring, fallback questions, tests.

## SpacetimeDB SDK Direction

The production transport should follow the generated TypeScript binding pattern from the SpacetimeDB skills reference:

```text
spacetime build
spacetime publish
spacetime generate --lang typescript
DbConnection.builder()
subscribe(tables...)
ctx.reducers.reducerName(...)
```

The current public demo keeps the reducer gateway active because it has been verified through venue-safe tunnels. The reducer/table model remains aligned with the SpacetimeDB module so this is a transport swap, not a product rewrite.
