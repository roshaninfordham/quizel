# Risks and Guardrails

- No gambling mechanics: no betting, staking, wagering, odds, payout, or profit language.
- No real money: Energy and Trust XP are non-redeemable educational game XP.
- No transfer: users cannot send Energy to other users or withdraw value.
- Positive Crowd action only: Cheer supports a Champion; there is no negative voting.
- AI hallucination fallback: model output is schema-validated and replaced with seed content on failure.
- Duplicate answer prevention: reducer rejects second player answer for the same round.
- Energy double-spend prevention: reducer checks and deducts Energy atomically before inserting SupportEvent.
- Server-authoritative timing: response time is calculated from reducer-side round start and receive time.
- Demo-mode honesty: simulated supporters are marked as simulated in LiveStats.
- Reconnect behavior: clients show a reconnecting banner and render the latest authoritative snapshot.
- Prototype scope: local reducer gateway is the default demo transport; the SpacetimeDB module is build-verified and ready for generated binding integration.

Required disclaimer:

QuizDuel Live uses non-redeemable educational game XP only. There is no purchase, cash prize, withdrawal, transfer, or real-world value.
