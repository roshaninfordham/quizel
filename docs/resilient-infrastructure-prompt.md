# QuizRush Arena Resilient Infrastructure Prompt

Use this prompt for the next coding agent or engineering pass.

```text
You are the Lead Realtime Systems Engineer, SpacetimeDB Engineer, Agentic AI Engineer, Reliability Engineer, and Product Quality Engineer for QuizRush Arena.

Mission:
Make QuizRush Arena resilient enough for a live room demo where many phones join, each user gets a custom topic quiz, every answer is scored authoritatively, the projector bracket moves from database state, and every participant gets a durable shareable score card.

Current measured production cap:
- Soft cap: 20 active racers.
- Hard cap: 25 active racers.
- Do not raise this until a fresh load artifact passes.
- Overflow users must become waitlisted/spectators, not admitted racers.

Deployment architecture:
- Vercel hosts the React app, static assets, routes, QR join page, arena projector route, and /share/:slug page.
- SpacetimeDB is the authoritative realtime game engine.
- The Effect agent worker runs outside Vercel Functions and handles Firecrawl, LLM providers, cache, validation, and race scheduler triggers.
- Optional object storage stores profile images; SpacetimeDB stores only avatar metadata and URLs.

Core rule:
The frontend never invents score, rank, correctness, official timing, bracket advancement, FinalResult, or ShareCard URL. Frontend only calls reducers and renders subscribed rows.

Required user flows:
1. Player scans QR and joins.
2. Player submits name/avatar/topic.
3. SpacetimeDB stores Participant and PlayerIntent rows.
4. Agent worker normalizes topic, fetches facts, generates validated questions, and submits QuestionPack rows.
5. Phone receives QuestionPublic rows only.
6. submit_answer reducer reads hidden QuestionSecret, calculates correctness, server officialResponseMs, scoreDelta, total score, rank, and event rows.
7. Projector subscribes to public race/bracket/leaderboard state.
8. finish_match snapshots every participant into FinalResult.
9. create_share_card reads FinalResult and creates durable ShareCard slug.
10. /share/:slug loads the ShareCard row from SpacetimeDB and shows a public score card.

Reliability requirements:
- No player should see a raw fatal error.
- Use AppErrorBoundary / PhoneErrorBoundary / ProjectorErrorBoundary.
- On crash, show retry/rejoin UI and call record_client_error.
- Reducer failures must be shown as user-safe retry copy, not raw backend text.
- The Tech Drawer must show ClientError, OperationTrace, AgentEvent, MatchEvent, LiveStats, and capacity state.

SpacetimeDB tables:
- Session
- Participant
- PlayerIntent
- GenerationJob or AgentRequest
- TopicFact
- QuestionPack
- QuestionPublic
- QuestionSecret private
- Round
- Answer
- Score
- FinalResult
- ShareCard
- BracketNode / BracketEdge / ParticipantStageState when bracket persistence is implemented
- MatchEvent
- AgentEvent
- ClientError
- LiveStats
- SessionCapacity
- AdmissionTicket
- OperationTrace

Reducers:
- create_session
- join_session
- submit_profile
- submit_player_intent
- request_quiz_pack or request_questions
- claim_generation_job
- submit_topic_facts
- submit_question_pack
- start_match
- start_round
- submit_answer
- resolve_round
- resolve_bracket_stage
- finish_match
- create_share_card
- increment_share_view
- heartbeat
- record_client_error
- record_agent_event
- reset_demo
- hard_reset_demo

Official timing:
- Round starts must be scheduled in the future using ROUND_LEAD_TIME_MS.
- officialResponseMs = serverReceivedAtMs - round.startsAtServerMs.
- observedTapMs = clientClickedAtMs - clientQuestionRenderedAtMs and is debug-only.
- totalAnswerResponseMs is sum of all submitted official response times.
- totalCorrectResponseMs is sum of correct official response times and is a tie breaker.
- fastestOfficialResponseMs is the fastest correct answer, not total quiz time.

Scoring:
- If correct: 1000 + floor(1000 * (1 - officialResponseMs / QUESTION_TIME_MS)) + streakBonus.
- If wrong: 0.
- Rank comparator: totalScore desc, correctCount desc, totalCorrectResponseMs asc, fastestOfficialResponseMs asc, lastAnswerAt asc, participantId asc.

Share cards:
- Share URL must always be /share/:slug.
- Slug must come from ShareCard.slug in SpacetimeDB.
- Do not build /share URLs from display text.
- create_share_card(sessionId, participantId) is idempotent.
- ShareCard snapshots FinalResult and Participant/Profile fields only.
- Normal reset_demo must not delete ShareCard rows.
- hard_reset_demo may delete ShareCard rows.
- Share page states: connecting, loading, found, not_found, disconnected.

Custom quiz generation:
- Pipeline: raw topic -> normalizeTopic -> resolve entity -> cache lookup -> Firecrawl/Wikipedia/local facts -> FactCards -> grounded LLM/template generation -> validation -> SpacetimeDB QuestionPack.
- Firecrawl facts must be compact and stored as TopicFact rows.
- Do not store raw pages in SpacetimeDB.
- Ban meta-learning questions such as "best first step when learning X".
- Every question must be topic-specific and cite factIds or trusted seed facts.
- If LLM/Firecrawl fail, use seed/cache fallback. Do not publish unrelated random questions.
- Deduplicate jobs by topicKey+difficulty.
- Limit LLM concurrency with provider key token buckets and cooldown on 429.

Frontend subscriptions:
- Phone should subscribe only to own Participant, PlayerIntent, assigned QuestionPublic, active Round, own Answer, own Score, own FinalResult, own ShareCard, Session.
- Phone must not subscribe to QuestionSecret.
- Projector should subscribe to Session, participants/profiles, LeaderboardTopN/top scores, bracket rows, LiveStats, recent events.
- Projector must not subscribe to all private questions or all answers for every user unless Tech Drawer is open.

Capacity path:
- Current deployed implementation is measured at hard cap 25 active racers.
- The current tracked-user artifact passes 50 connected users with 25 admitted and 25 waitlisted/spectator.
- The next engineering target is 50 active racers after scoped subscriptions and TopN leaderboard.
- The next target after that is 100 active racers after per-answer fanout is reduced.
- Do not claim 50 active racers, 100 active racers, or 1000 active racers until load:prod passes and docs/capacity-results contains the artifact.

Load tests:
- make load USERS=20
- make load USERS=50
- make load USERS=50
- make load USERS=100
- make load USERS=1000

Each synthetic client must:
1. connect
2. join_session
3. submit_player_intent
4. wait for quiz pack
5. answer every round
6. observe score updates
7. wait for FinalResult
8. create ShareCard
9. verify /share/:slug HTTP 200 and page content

Acceptance criteria:
- 2 real phones can join, play, finish, and share score.
- No raw fatal error appears on phone.
- ClientError rows are written if a crash happens.
- Share cards work in a new tab, refresh, and incognito.
- Final result displays Score, Correct, Total time, Fastest separately.
- Projector stays clean and shows bracket/leaderboard, not private questions.
- Admission control protects measured capacity.
- Capacity report states proven limits honestly.
```

## System Flow

```mermaid
flowchart LR
    Vercel[Vercel React App] --> Phone[Phone Quiz Controller]
    Vercel --> Projector[Projector Live Bracket]
    Phone -->|reducers| DB[(SpacetimeDB)]
    Projector -->|subscriptions| DB
    Worker[Effect Agent Worker] -->|claim jobs / submit packs| DB
    Worker --> Firecrawl[Firecrawl Facts]
    Worker --> LLM[LLM Provider Pool]
    DB --> Final[FinalResult]
    DB --> Share[ShareCard]
    Vercel --> SharePage[/share/:slug]
    SharePage -->|subscribe by slug| DB
```

```mermaid
sequenceDiagram
    participant U as Phone
    participant DB as SpacetimeDB
    participant W as Agent Worker
    participant P as Projector
    participant S as Share Page

    U->>DB: submit_player_intent(topic)
    DB-->>W: pending generation job
    W->>W: normalize + fetch facts + validate pack
    W->>DB: submit_question_pack()
    DB-->>U: QuestionPublic ready
    U->>DB: submit_answer()
    DB->>DB: compute official time + score + rank
    DB-->>P: leaderboard/bracket update
    DB-->>U: Score update
    DB->>DB: finish_match snapshots FinalResult
    U->>DB: create_share_card()
    DB-->>U: ShareCard slug
    U->>S: open /share/:slug
    S->>DB: load ShareCard by slug
```
