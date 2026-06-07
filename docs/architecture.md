# Architecture

QuizRush Arena is built around one judged workflow: a public arena QR, a one-route phone controller, freeform topic intent, AI-generated or cached private questions, a 25-second match, live bracket movement, and durable share-card replay.

## Production System

```mermaid
flowchart LR
    Vercel["Vercel frontend<br/>/arena, /join, /share"] --> Phones["Audience phones"]
    Vercel --> Projector["Projector arena"]
    Vercel --> SharePage["Public score card route<br/>/share/:slug"]

    Phones -->|join_session / submit_profile / submit_player_intent| DB[("SpacetimeDB<br/>quizrush-live")]
    Phones -->|request_questions / submit_answer / create_share_card| DB
    Projector -->|subscribe Session, Participant, BracketNode, LeaderboardTopN, LiveStats| DB
    SharePage -->|subscribe ShareCard by slug| DB

    Worker["Effect agent worker"] -->|claim GenerationJob| DB
    Worker -->|submit TopicFact + QuestionPack| DB
    Worker --> Firecrawl["Firecrawl search/scrape"]
    Worker --> LLM["NVIDIA NIM / LLM provider pool"]

    DB --> GameRows["Session, Participant, PlayerIntent"]
    DB --> QuizRows["QuestionPack, QuestionPublic, QuestionSecret"]
    DB --> RaceRows["Round, Answer, Score, BracketNode"]
    DB --> ResultRows["FinalResult, ShareCard, MatchEvent, LiveStats"]
```

Vercel only serves the application shell and routes. SpacetimeDB owns the realtime game state: profiles, intents, quiz pack assignment, hidden answers, official timing, score, rank, bracket movement, final results, and share-card slugs. The Effect worker performs external I/O, then writes compact facts and validated packs back through reducers.

## Realtime Sequence

```mermaid
sequenceDiagram
    participant Host as Presenter
    participant DB as SpacetimeDB
    participant P as Projector
    participant U as Phone User
    participant W as Effect Worker
    participant F as Firecrawl
    participant L as LLM Provider
    participant S as Share Page

    Host->>DB: create_session()
    P->>DB: subscribe Session/Participants/LiveStats
    U->>DB: join_session()
    DB-->>P: Participant roster update
    U->>DB: submit_player_intent(topic)
    DB-->>W: GenerationJob pending
    W->>F: fetch facts when cache misses
    W->>L: generate grounded quiz JSON when needed
    W->>W: validate schema + topic grounding
    W->>DB: submit_question_pack()
    DB-->>U: participant QuestionPublic rows
    Host->>DB: start_match()
    U->>DB: submit_answer()
    DB->>DB: compute official time, correctness, score, rank
    DB-->>P: leaderboard and bracket update
    DB-->>U: own score update
    DB->>DB: finalize_race()
    DB-->>U: FinalResult row
    U->>DB: create_share_card()
    DB-->>U: ShareCard slug
    U->>S: open /share/:slug
    S->>DB: subscribe ShareCard by slug
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
- `apps/realtime-server`: local websocket reducer gateway for offline rehearsal only.
- `apps/agent-worker`: Effect-powered agent worker and provider-neutral LLM adapters.
- `modules/spacetime`: SpacetimeDB table/reducer module matching the shared contract.
- `packages/shared`: reducer engine, types, schemas, scoring, fallback questions, tests.

## SpacetimeDB Usage

- Phones call reducers for `join_session`, `submit_profile`, `submit_player_intent`, `request_questions`, `submit_answer`, and `create_share_card`.
- The projector subscribes to public rows only: `Session`, `Participant`, `PlayerIntent`, `BracketNode`, `LeaderboardTopN`, `FinalResult`, and `LiveStats`.
- Phones subscribe to their own private quiz surface: assigned `QuestionPublic` rows, `Round`, `Score`, `FinalResult`, and `ShareCard`.
- The agent worker claims `GenerationJob` rows, fetches facts outside the database, validates packs, and submits compact `TopicFact`, `QuestionPack`, `QuestionPublic`, and `QuestionSecret` rows through reducers.
- The share page loads a durable `ShareCard` row by slug. It never reconstructs score cards from URL text.

Production transport follows the generated TypeScript binding pattern from the SpacetimeDB skills reference:

```text
spacetime build
spacetime publish
spacetime generate --lang typescript
DbConnection.builder()
subscribe(tables...)
ctx.reducers.reducerName(...)
```

The local reducer gateway remains available for offline rehearsal, but the deployed architecture is Vercel plus the `quizrush-live` SpacetimeDB module.
