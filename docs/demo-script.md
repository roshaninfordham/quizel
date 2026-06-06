# Demo Script

0:00-0:10

Most quiz apps make one person play and everyone else watch. QuizDuel Live turns the whole room into the game.

0:10-0:25

Scan this QR code. Choose whether you want to be a Champion or join the Crowd.

0:25-0:40

SpacetimeDB is selecting two players and syncing everyone else into the live crowd.

0:40-1:20

Players answer the quiz. The Crowd cheers with Energy. Watch the scores, support bars, and leaderboards update instantly.

1:20-1:40

The AI agents generated and reviewed these questions, then explain each answer after the round.

1:40-2:00

Every answer, Cheer, score, and leaderboard update is a reducer transaction and subscription update. This is a realtime social learning game, not a static quiz.

Close:

Two players. One Crowd. Every phone live.

## Q&A

Why SpacetimeDB?

Because the game needs authoritative transactional state plus live subscriptions. Answers, Energy spending, scoring, and leaderboards cannot be inconsistent.

Why AI?

AI generates quiz content, reviews fairness, hosts commentary, and summarizes learning. It is not just a chatbot; it drives the live match content.

Is this gambling?

No. No money, no purchase, no cash-out, no transfer, no real-world value. Energy is non-redeemable educational game XP.

What is technically hard?

Hundreds of simultaneous taps must not double-spend Energy, duplicate answers, or desync screens. Reducers make state changes transactional and subscriptions update all clients live.

What is mocked?

Production auth, payments, and long-term profiles are out of scope. The live QR join, realtime match, scoring, Energy deduction, leaderboard, and AI/fallback pipeline are implemented for the demo. Generated SpacetimeDB React bindings are the next integration step.
