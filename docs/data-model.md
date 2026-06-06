# Data Model

The authoritative model is implemented in `modules/spacetime/src/index.ts` and mirrored in `packages/shared/src/types.ts`.

Primary tables:

- `Session`: room settings, topic, status, current match.
- `Participant`: audience identity, display name, requested role, assigned role.
- `Match`: selected Champions and match status.
- `Question`: generated or fallback quiz content.
- `Round`: active/resolved round timing and winner.
- `Answer`: one player answer per round.
- `PlayAlongAnswer`: one Crowd play-along answer per round.
- `SupportEvent`: positive Cheer events only.
- `EnergyBalance`: current spendable Energy and Trust XP.
- `Score`: cached player/supporter leaderboard rows.
- `LedgerEntry`: append-only audit ledger for Energy, Trust XP, and player score deltas.
- `AgentRequest`: external worker request queue.
- `AgentEvent`: visible agent status, commentary, explanations, and fallbacks.
- `LiveStats`: cached live metrics for projector and tech overlay.
- `AuditEvent`: reducer action feed.

Critical invariants:

- Only reducers mutate game state.
- One player answer per round.
- One Crowd play-along answer per round.
- Cheer amount is exactly 25 Energy.
- Energy cannot go below zero.
- Round scoring is idempotent.
- Crowd boost is capped at 200 points.
- AI cannot directly mutate scores.
