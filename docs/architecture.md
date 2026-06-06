# Architecture

QuizDuel Live is organized as a monorepo:

- `apps/web`: React phone, host, projector, and tech proof screens.
- `apps/realtime-server`: laptop-local WebSocket reducer gateway for the judged demo.
- `apps/agent-worker`: Effect-based provider-neutral LLM worker.
- `modules/spacetime`: build-verified SpacetimeDB TypeScript module.
- `packages/shared`: shared types, schemas, reducer engine, scoring, and tests.

## System

```mermaid
flowchart LR
    Host[Host Console] -->|create_session / open_lobby| STDB[(SpacetimeDB Module)]
    PhoneJoin[Audience Phones] -->|join_session| STDB
    PlayerPhones[Champion Phones] -->|submit_answer| STDB
    CrowdPhones[Crowd Phones] -->|support_player / playalong_answer| STDB
    Projector[Projector Arena] -->|subscriptions| STDB
    Tech[Tech Proof Screen] -->|subscriptions| STDB

    STDB -->|table updates| Host
    STDB -->|table updates| PhoneJoin
    STDB -->|table updates| PlayerPhones
    STDB -->|table updates| CrowdPhones
    STDB -->|table updates| Projector
    STDB -->|table updates| Tech

    Worker[Effect Agent Worker] -->|subscribe to AgentRequest / Match state| STDB
    Worker -->|LLM calls via generic adapter| LLM[Swappable LLM Provider]
    Worker -->|submit_question_batch / record_agent_event| STDB
```

## Demo Transport

```mermaid
flowchart LR
    Host[Host Console] -->|Reducer call over WS| Gateway[Local Reducer Gateway]
    Phones[Phones on Wi-Fi] -->|Reducer call over WS| Gateway
    Projector[Projector Routes] -->|Snapshot stream| Gateway
    Gateway --> Engine[Shared Reducer Engine]
    Engine --> Gateway
    Gateway --> Host
    Gateway --> Phones
    Gateway --> Projector
```

The local gateway exists so a judged demo can run from one laptop without cloud login. Its reducer names, arguments, and invariants mirror the SpacetimeDB module.

## Realtime Sequence

```mermaid
sequenceDiagram
    participant H as Host
    participant P as Projector
    participant C as Crowd Phone
    participant A as Champion Phone
    participant DB as SpacetimeDB
    participant W as Effect Agent Worker
    participant L as LLM Provider

    H->>DB: create_session()
    H->>DB: request_questions()
    W->>DB: subscribes AgentRequest
    W->>L: generate quiz JSON
    L-->>W: questions
    W->>W: validate + fairness review
    W->>DB: submit_question_batch()
    P->>DB: subscribe Session/Participant/LiveStats
    C->>DB: join_session()
    DB-->>P: participant count update
    H->>DB: assign_champions_randomly()
    A->>DB: submit_answer()
    C->>DB: support_player()
    DB-->>P: live score/support updates
    H->>DB: resolve_round()
    DB-->>P: round result
    W->>DB: record_agent_event(commentary)
    DB-->>P: AI explanation update
```

## Match State

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Lobby: open_lobby()
    Lobby --> Selecting: assign_champions_randomly()
    Selecting --> Active: start_match()
    Active --> Resolving: resolve_round()
    Resolving --> Active: next round
    Resolving --> Finished: final round resolved
    Finished --> Draft: reset_demo()
```

## Scoring Flow

```mermaid
flowchart TD
    Start[resolve_round] --> ReadQ[Read Question + Round]
    ReadQ --> ReadA[Read Player Answers]
    ReadA --> ReadS[Read Support Events]
    ReadS --> Score1[Compute correctness points]
    Score1 --> Score2[Compute speed bonus]
    Score2 --> Score3[Compute capped crowd boost]
    Score3 --> Winner[Determine round winner]
    Winner --> Ledger[Insert Ledger Entries]
    Ledger --> Update[Update Score + EnergyBalance]
    Update --> Result[Mark Round Resolved]
    Result --> Notify[Subscriptions update all clients]
```
