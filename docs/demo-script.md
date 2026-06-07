# Demo Script

## 90 Seconds

0:00-0:10

“Most live quizzes are static polls. QuizRush Arena turns the whole room into a 25-second AI-personalized tournament from one QR code.”

0:10-0:25

Open `https://quizel-eta.vercel.app/arena/ARENA-42`. Show the projector arena and QR.

“Scan this. No app, no login. Your phone becomes the controller.”

0:25-0:40

Audience joins and types a topic. Point to the live count, real roster avatars, and topic bubbles.

“Every join, profile, topic, and quiz-pack assignment is committed through a SpacetimeDB reducer and synced to the projector.”

Optional backup: press `A` to stream 100 marked simulated players if the room is small. Say, “These are marked simulated load so we can prove the high-fan-in path honestly.”

0:40-0:55

“The Effect worker routes the room’s expertise intent, calls the LLM, validates the JSON, runs fairness/safety guardrails, and falls back to topic-specific questions if anything fails.”

0:55-1:20

Start the race with `S` after the room is ready. Phones answer ten rapid private questions inside the race clock.

“Now watch the public live bracket move after committed taps. The projector never shows private quiz questions. Scores are not client-side guesses; response time, correctness, rank, and duplicate-answer rejection happen in reducer-owned state.”

1:20-1:35

Winner screen.

“The result is already available because scores were updated incrementally during the race. The technical ledger is hidden from users but available in the drawer.”

1:35-1:45

Press `T`.

“This drawer shows reducer calls, answer rate, duplicate rejections, p95 latency, scoring formulas, capacity, SpacetimeDB flow, and the MatchEvent ledger.”

Close:

“QuizRush Arena is not just a quiz. It is a room-scale realtime state race powered by SpacetimeDB.”

## Q&A

Why SpacetimeDB?

“The game needs authoritative transactional state plus live subscriptions. Joins, answers, score, rank, and replay cannot desync.”

Why AI?

“AI routes the room’s expertise intent, generates the sprint challenge, reviews fairness, and produces recap/commentary. It is a content pipeline, not a chatbot bolted onto the side.”

Is this gambling?

“No. There is no money, no purchase, no payout, no transfer, no stored-value account, and no real-world value.”

What is technically hard?

“Hundreds of simultaneous taps must not create duplicate answers or inconsistent ranks. Reducers make the state transition authoritative, and subscriptions update every screen.”

What is mocked?

“Production auth and permanent user profiles. The Vercel frontend, SpacetimeDB reducer module, realtime match engine, reducer invariants, scoring, capacity cap, share cards, AI validation/fallback, and UI flow are working.”
