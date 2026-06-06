# Demo Script

## 90 Seconds

0:00-0:10

“Most live quizzes are static polls. QuizRush Arena turns the whole room into a 25-second AI-personalized tournament from one QR code.”

0:10-0:25

Run `make online-public`. Show the projector arena and QR.

“Scan this. No app, no login. Your phone becomes the controller.”

0:25-0:40

Audience joins and types or speaks expertise. Point to the live count and expertise swarm.

“Every join and expertise signal is committed through a reducer and synced to the projector.”

Optional backup: press `A` to stream 100 marked simulated players if the room is small. Say, “These are marked simulated load so we can prove the high-fan-in path honestly.”

0:40-0:55

“The Effect worker routes the room’s expertise intent, calls the LLM, validates the JSON, runs fairness/safety guardrails, and falls back to seed questions if anything fails.”

0:55-1:20

The match starts automatically. Phones answer seven rapid questions inside the 25-second race clock.

“Now watch the leaderboard and top-16 bracket move after every tap. Scores are not client-side guesses; response time, correctness, rank, and duplicate-answer rejection happen in reducer-owned state.”

1:20-1:35

Winner screen and replay.

“The replay is reconstructed from the MatchEvent ledger. This is the 25-second state race, not a canned animation.”

1:35-1:45

Press `T`.

“This overlay shows reducer calls, answer rate, duplicate rejections, p95 latency, current tables, subscriptions, and agent events.”

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

“Production auth, profiles, and a permanent cloud deployment. The realtime match engine, public tunnel launch, reducer invariants, scoring, replay ledger, AI validation/fallback, and UI flow are working.”
