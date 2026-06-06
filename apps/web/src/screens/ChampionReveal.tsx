import { Crown, Play, Users } from "lucide-react";
import { DEFAULT_SESSION_ID } from "@quizduel/shared";
import { useHostActions } from "../hooks/useArenaActions";
import { getPlayerParticipants, getScore } from "../lib/selectors";
import { useCurrentMatch, useLiveStats, useSession, useSpacetime } from "../lib/spacetime/client";
import { Button, ConfettiBurst, ConnectionBadge, IconPill, MetricCard, PlayerCard, ProjectorShell } from "../components/ui";

export function ChampionReveal({ sessionId = DEFAULT_SESSION_ID }: { sessionId?: string }) {
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const session = useSession(sessionId);
  const stats = useLiveStats(session?.sessionId);
  const match = useCurrentMatch(session?.sessionId);
  const players = getPlayerParticipants(state, match);
  const host = useHostActions();

  return (
    <ProjectorShell>
      <header className="flex items-start justify-between gap-6">
        <div>
          <IconPill tone="mango">
            <Crown className="size-4" /> Tonight&apos;s Champions
          </IconPill>
          <h1 className="mt-3 text-7xl font-black leading-none text-slate-950">Tonight&apos;s Champions</h1>
          <p className="mt-4 text-3xl font-extrabold text-slate-600">Two players battle. The whole room cheers live.</p>
        </div>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </header>

      <ConfettiBurst fireKey={match?.matchId} />

      <section className="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_360px_1fr]">
        <PlayerCard
          participant={players[0]}
          score={getScore(state, match?.matchId, players[0]?.participantId)}
          side="Player 1"
          active
        />

        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-xl">
          <p className="text-sm font-extrabold uppercase text-slate-500">Topic</p>
          <h2 className="mt-2 text-4xl font-black text-violet-700">{session?.topic ?? "AI + Space + Startups"}</h2>
          <div className="mt-6 grid gap-3">
            <MetricCard label="Crowd size" value={stats?.crowdCount ?? 0} tone="aqua" icon={<Users className="size-5" />} />
            <div className="rounded-lg bg-slate-950 p-4 text-left text-white">
              <p className="text-sm font-extrabold uppercase text-cyan-200">AI Host</p>
              <p className="mt-2 text-xl font-black leading-tight">
                The Crowd is live, the Champions are locked, and every tap is synced.
              </p>
            </div>
          </div>
          <Button
            disabled={!match || host.loading}
            onClick={() => match && host.startMatch(match.matchId)}
            className="mt-6 w-full"
            icon={<Play className="size-5" />}
          >
            Start Match
          </Button>
        </div>

        <PlayerCard
          participant={players[1]}
          score={getScore(state, match?.matchId, players[1]?.participantId)}
          side="Player 2"
          active
        />
      </section>
    </ProjectorShell>
  );
}
