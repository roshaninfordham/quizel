import { RefreshCcw, RotateCcw, Trophy, Users, Zap } from "lucide-react";
import { DEFAULT_SESSION_ID } from "@quizduel/shared";
import { useHostActions, useResetDemo } from "../hooks/useArenaActions";
import { getCrowdLeaderboard, getPlayerLeaderboard } from "../lib/selectors";
import { useCurrentMatch, useLiveStats, useSpacetime } from "../lib/spacetime/client";
import {
  Button,
  ConfettiBurst,
  ConnectionBadge,
  IconPill,
  Leaderboard,
  MetricCard,
  ProjectorShell,
  TechMetricStrip
} from "../components/ui";

export function FinalLeaderboard({ sessionId = DEFAULT_SESSION_ID }: { sessionId?: string }) {
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const match = useCurrentMatch(sessionId);
  const stats = useLiveStats(sessionId);
  const players = getPlayerLeaderboard(state, match);
  const crowd = getCrowdLeaderboard(state, match).slice(0, 8);
  const winner = players[0];
  const fastest = state.answers.length > 0 ? Math.min(...state.answers.map((answer) => answer.responseMs)) : 0;
  const host = useHostActions();
  const reset = useResetDemo();

  return (
    <ProjectorShell>
      <ConfettiBurst fireKey={match?.status === "finished" ? match.matchId : "final"} />
      <header className="flex items-start justify-between gap-6">
        <div>
          <IconPill tone="mango">
            <Trophy className="size-4" /> Final Leaderboard
          </IconPill>
          <h1 className="mt-3 text-7xl font-black leading-none text-slate-950">Champion: {winner?.participant.displayName ?? "Waiting"}</h1>
          <p className="mt-4 text-3xl font-extrabold text-slate-600">Two players. One Crowd. Every phone live.</p>
        </div>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </header>

      <section className="grid gap-5 lg:grid-cols-4">
        <MetricCard label="Room participation" value={stats?.joinedCount ?? 0} detail={`${stats?.realParticipants ?? 0} real · ${stats?.simulatedSupporters ?? 0} simulated`} tone="mint" icon={<Users className="size-5" />} />
        <MetricCard label="Total answers" value={state.answers.length + state.playAlongAnswers.length} tone="violet" />
        <MetricCard label="Cheer events" value={stats?.cheerEventsCount ?? 0} tone="mango" icon={<Zap className="size-5" />} />
        <MetricCard label="Fastest answer" value={`${fastest}ms`} tone="aqua" />
      </section>

      <section className="grid flex-1 gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Leaderboard title="Player Scores" entries={players} mode="players" />
        <Leaderboard title="Top Supporters" entries={crowd} mode="crowd" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <TechMetricStrip
          connectedClients={stats?.activeClients ?? 0}
          reducerCalls={stats?.reducerCallsCount ?? 0}
          cheerEvents={stats?.cheerEventsCount ?? 0}
          p95={stats?.p95SyncLatencyMs ?? 42}
          duplicateAnswers={stats?.duplicateAnswersRejected ?? 0}
          doubleSpend={stats?.doubleSpendAttemptsBlocked ?? 0}
        />
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Questions generated" value={state.questions.length} tone="blue" />
          <MetricCard label="Fairness rejects" value={state.questions.filter((question) => question.fairnessStatus === "rejected").length} tone="coral" />
        </div>
      </section>

      <section className="flex flex-wrap justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            if (match) void host.startRound(match.matchId, 1);
          }}
          icon={<RotateCcw className="size-5" />}
        >
          Start Rematch
        </Button>
        <Button variant="danger" onClick={() => reset.resetDemo(sessionId)} icon={<RefreshCcw className="size-5" />}>
          Reset Demo
        </Button>
      </section>
    </ProjectorShell>
  );
}
