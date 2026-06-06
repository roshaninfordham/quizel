# QuizRush Arena

A 25-second AI-personalized quiz tournament from one QR code.

> The whole room scanned one QR code, shared expertise, and became a live AI-generated tournament in 25 seconds.

QuizRush Arena uses educational game scoring only. There is no purchase, cash prize, withdrawal, transfer, or real-world value.

## What It Does

QuizRush Arena turns a room into a live multiplayer quiz race. The presenter runs `make online-public`, the projector shows a giant QR code, everyone joins from a phone, players type or speak their expertise, deterministic intent parsing converts that into live arena topics, AI agents generate and review seven rapid questions, and the arena shows every answer, score, rank jump, fixture movement, winner, and replay live.

## Demo Flow

1. Run `make online-public` for phones on any network, or `make online` for same-Wi-Fi testing.
2. Projector opens `/arena/ARENA-42`.
3. Audience scans the QR and joins `/join/ARENA-42`.
4. Everyone types or speaks what they know; fixed topic chips are no longer the main UX.
5. The phone shows a detected arena such as `AI Agents x Space Tech x Database Systems`.
6. The 5-second intent window closes automatically.
7. The Effect worker requests LLM questions and falls back to seed questions after 700ms if needed.
8. The match starts automatically and phones answer seven rapid questions inside one 25-second race clock.
9. Projector updates leaderboard and top-16 fixture lanes from committed state.
10. Winner screen shows champion, score, fastest answer, sound, and confetti.
11. Replay reads the `MatchEvent` ledger to show how the race changed.
12. Press `T` to show the SpacetimeDB tech proof overlay.

Projector keyboard controls:

```text
S = start match
G = generate questions
A = add 100 simulated players
T = toggle tech overlay
F = force finish
R = reset demo
```

## Run

```bash
pnpm install
make online-public
```

Default local URLs:

- Projector: http://localhost:5173/arena/ARENA-42
- Phone QR: `make online` prints a LAN URL such as `http://YOUR_LAPTOP_IP:5173/join/ARENA-42`
- Tech proof: http://localhost:5173/tech/ARENA-42
- Phone realtime gateway: `ws://YOUR_LAPTOP_IP:5173/quizrush-ws`
- Worker realtime gateway: ws://127.0.0.1:8787

For room phones on the same Wi-Fi, use the printed QR. If the detected IP is wrong, set it explicitly:

```bash
QUIZRUSH_LAN_HOST=192.168.1.23 make online
```

If venue Wi-Fi blocks phone-to-laptop traffic or friends are on different networks, use the public tunnel target:

```bash
make online-public
```

`make online-public` tries verified public tunnels in this order: Cloudflare Tunnel, `localhost.run`, then ngrok. It only prints the QR after the public page and websocket both pass preflight. Install Cloudflare Tunnel once with:

```bash
brew install cloudflared
```

You can force a provider during rehearsal:

```bash
make online-cloudflare
make online-localhostrun
make online-ngrok
```

Ngrok free URLs can hit provider warnings or account bandwidth limits. Cloudflare quick tunnels have a 200 in-flight request limit and no uptime SLA. `localhost.run` is useful when venue DNS blocks fresh `trycloudflare.com` hostnames.

For a manual tunnel, expose the web app and set `PUBLIC_BASE_URL`. The websocket rides through the same public origin by default:

```bash
PUBLIC_BASE_URL=https://your-web-tunnel.example make online
```

Only set `PUBLIC_REALTIME_URL` if you intentionally run a separate websocket tunnel.

## Architecture

```mermaid
flowchart LR
    Terminal[make online CLI] --> STDB[(SpacetimeDB Module)]
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

The SpacetimeDB module in `modules/spacetime` is the authoritative table/reducer contract. The laptop demo also includes `apps/realtime-server`, a local websocket reducer gateway that mirrors the same contract for reliable room demos while generated SpacetimeDB bindings are optional.

## What Works

- Public projector arena at `/arena/:code`.
- Single phone route at `/join/:code`.
- Optional tech proof at `/tech/:code`.
- Freeform expertise input with deterministic intent preview and optional Web Speech API mic enhancement.
- Realtime joins, expertise-derived topic votes, answers, scores, ranks, bracket, winner, and replay.
- Tasteful generated howler.js sound effects with phone sound off by default.
- Live projector metrics refreshed by reducer-owned `live_tick` updates.
- Simulated 100-player room load streamed in small reducer batches from the `A` key.
- Simulated answer bursts during the 25-second race for fast leaderboard/bracket movement.
- Reducer-owned game state in `packages/shared` and `modules/spacetime`.
- One answer per participant per round.
- Server-authoritative response time and score calculation.
- Duplicate answer rejection and metric tracking.
- `MatchEvent` replay ledger.
- Effect-based LLM worker with provider routing, retries, validation, safety guard support, and seed fallback.
- NVIDIA model routing through environment variables in `.env.local`.
- Deterministic fallback questions if LLM calls fail.

## What Is Prototype Scope

- Production auth, payments, stored-value accounts, profiles, chat, and content marketplace are intentionally omitted.
- The default judged laptop transport is the local realtime gateway for reliability. The SpacetimeDB module builds and exposes the same public reducers/tables for direct integration.
- Cloudflare/ngrok tunnel startup is automated by `make online-public` when the provider CLI is installed. You can still set `PUBLIC_BASE_URL` manually for a trusted domain.

## AI Agents

- Intent Parser / Topic Router Agent: selects a tournament topic from live expertise signals.
- Arena Router Agent: represented in the UI pipeline and currently backed by deterministic topic clustering for the single sprint arena.
- Quiz Builder Agent: generates exactly seven short MCQ questions for the 25-second sprint.
- Safety Guard Agent: optional safety review.
- Fairness Guard: validates options, ambiguity, length, and public safety.
- Host Commentator Agent: writes short round commentary.
- Recap Agent: summarizes what the room learned.

Real keys belong only in `.env.local`. `.env.example` contains placeholders.

## Commands

```bash
make online
make online-public
make online-cloudflare
make online-localhostrun
make online-ngrok
make reset
make seed
pnpm typecheck
pnpm test
pnpm build
pnpm spacetime:build
```

## SpacetimeDB

```bash
curl -sSf https://install.spacetimedb.com | sh
pnpm spacetime:build
pnpm spacetime:start
pnpm spacetime:publish:local
```

Core reducers:

```text
create_session
join_session
submit_topic_vote
request_questions
submit_question_pack
start_match
start_round
submit_answer
resolve_round
finish_match
heartbeat
live_tick
reset_demo
add_simulated_players
simulate_answer_burst
record_agent_event
```

Production transport plan from the SpacetimeDB skills reference:

- Generate TypeScript bindings from `modules/spacetime`.
- Use generated `DbConnection`, `tables`, and reducers from `apps/web/src/lib/spacetime/module_bindings`.
- Subscribe phones only to own participant/score/current round data.
- Subscribe projector to LiveStats, recent MatchEvents, agent events, and top leaderboard rows.
- Keep reducers as the only game-critical mutation path; external LLM calls stay in the Effect worker.

The current room-demo transport is the verified local websocket reducer gateway because it gives reliable public QR joins through tunnels today. The SpacetimeDB module builds and mirrors the same reducer/table contract for the direct SDK transport pass.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm --filter @quizrush/web build
```

Manual golden path:

- Join from two browser tabs or phones.
- Type expertise such as `AI agents, space startups, and databases`.
- Confirm the detected arena.
- The expertise window, generation/fallback, and match start run automatically.
- Press `A` only when you want to stream 100 marked simulated players for load.
- `G` and `S` remain emergency/manual controls.
- Answer on phones.
- Tap the same answer twice and verify duplicate rejection in tech overlay.
- Let seven rapid rounds resolve inside the 25-second race clock.
- Verify winner, leaderboard, replay, and reset.

See `docs/` for architecture diagrams, data model, realtime flow, AI guardrails, demo script, risks, and reducer API contract.
