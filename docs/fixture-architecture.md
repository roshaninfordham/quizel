# Fixture Architecture

QuizRush Arena now treats the projector as a public tournament broadcast. Phones show the private quiz; the projector shows the live Champion Path derived from committed SpacetimeDB rows.

```mermaid
flowchart LR
    Phone[Phone Private Quiz] -->|join_session / submit_answer| DB[(SpacetimeDB)]
    Worker[Effect Agent Worker] -->|submit_topic_facts / submit_question_pack| DB
    DB --> Score[Score Rows]
    DB --> Final[FinalResult Rows]
    DB --> Stats[LiveStats]
    DB --> Ledger[MatchEvent Ledger]
    Projector[Projector Fixture] -->|subscribes participants + scores + stats| DB
    Drawer[Tech Drawer] -->|opens ledger/metrics only on demand| DB
    Share[Share Page] -->|reads ShareCard| DB
```

```mermaid
sequenceDiagram
    participant U as Phone
    participant DB as SpacetimeDB
    participant P as Projector
    participant T as Tech Drawer

    U->>DB: submit_answer(roundId, option, clientEventId)
    DB->>DB: validate admitted participant
    DB->>DB: reject duplicate answer/event id
    DB->>DB: compute responseMsServer
    DB->>DB: compute correctness + scoreDelta
    DB->>DB: update Answer + Score + MatchEvent
    DB-->>U: own Answer/Score subscription
    DB-->>P: Score/LiveStats subscription moves fixture
    DB-->>T: Ledger/metrics visible if drawer open
```

## Product Split

- Phone: name, avatar, topic, private questions, answer buttons, own result, share score.
- Projector: QR lobby, Champion Path fixture, leaderboard, winner reveal, capacity strip.
- Tech drawer: formulas, reducers, latency, capacity, MatchEvent ledger.

The projector does not render quiz questions or correct answers. This keeps personalized topics private and prevents the public screen from becoming a debug dashboard.

## Current Implementation

The current deployed fixture is derived from authoritative `Score`, `Participant`, `LiveStats`, and `FinalResult` rows. Avatar movement follows subscribed rank/score changes committed by reducers.

The next production scaling pass should add explicit `BracketStage`, `BracketSlot`, `AdvancementEvent`, and `EliminationEvent` tables if the tournament visualization must preserve a full historical bracket independent of rank.
