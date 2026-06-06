import { Database, Radio, ShieldCheck } from "lucide-react";
import { DEFAULT_SESSION_ID } from "@quizduel/shared";
import { useCurrentMatch, useCurrentRound, useLiveStats, useSpacetime } from "../lib/spacetime/client";
import { ConnectionBadge, IconPill, LiveFeed, MetricCard, ProjectorShell, TechMetricStrip } from "../components/ui";

export function TechProof({ sessionId = DEFAULT_SESSION_ID }: { sessionId?: string }) {
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const stats = useLiveStats(sessionId);
  const match = useCurrentMatch(sessionId);
  const round = useCurrentRound(match?.matchId);
  const feed = state.auditEvents
    .filter((event) => event.sessionId === sessionId)
    .slice(-10)
    .reverse()
    .map((event) => ({ id: event.eventId, message: `${event.eventType}: ${event.message}`, createdAt: event.createdAt }));

  const tableCounts = [
    ["Session", state.sessions.length],
    ["Participant", state.participants.length],
    ["Match", state.matches.length],
    ["Question", state.questions.length],
    ["Round", state.rounds.length],
    ["Answer", state.answers.length],
    ["PlayAlongAnswer", state.playAlongAnswers.length],
    ["SupportEvent", state.supportEvents.length],
    ["EnergyBalance", state.energyBalances.length],
    ["Score", state.scores.length],
    ["LedgerEntry", state.ledgerEntries.length],
    ["AgentEvent", state.agentEvents.length],
    ["AuditEvent", state.auditEvents.length]
  ];

  return (
    <ProjectorShell>
      <header className="flex items-start justify-between gap-6">
        <div>
          <IconPill tone="aqua">
            <Database className="size-4" /> Tech Proof
          </IconPill>
          <h1 className="mt-3 text-7xl font-black leading-none text-slate-950">Realtime Proof Overlay</h1>
          <p className="mt-4 text-3xl font-extrabold text-slate-600">Reducers own the game state. Clients subscribe to authoritative updates.</p>
        </div>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </header>

      <TechMetricStrip
        connectedClients={stats?.activeClients ?? 0}
        reducerCalls={stats?.reducerCallsCount ?? 0}
        cheerEvents={stats?.cheerEventsCount ?? 0}
        p95={stats?.p95SyncLatencyMs ?? 42}
        duplicateAnswers={stats?.duplicateAnswersRejected ?? 0}
        doubleSpend={stats?.doubleSpendAttemptsBlocked ?? 0}
      />

      <section className="grid gap-5 lg:grid-cols-4">
        <MetricCard label="Cheer events/sec" value={stats?.cheerEventsPerSec ?? 0} tone="mango" />
        <MetricCard label="Answers locked" value={state.answers.filter((answer) => answer.roundId === round?.roundId).length} tone="violet" />
        <MetricCard label="Duplicate answers rejected" value={stats?.duplicateAnswersRejected ?? 0} tone="coral" icon={<ShieldCheck className="size-5" />} />
        <MetricCard label="Double-spend attempts blocked" value={stats?.doubleSpendAttemptsBlocked ?? 0} tone="mint" icon={<ShieldCheck className="size-5" />} />
      </section>

      <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <Database className="size-6 text-violet-600" />
            <h2 className="text-2xl font-black text-slate-950">Current Tables</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {tableCounts.map(([table, count]) => (
              <div key={String(table)} className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-sm font-extrabold uppercase text-slate-500">{table}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <Radio className="size-6 text-cyan-300" />
            <h2 className="text-2xl font-black">Subscriptions</h2>
          </div>
          <div className="space-y-3 text-lg font-extrabold text-cyan-50">
            <p>Host: Session, AgentRequest, AgentEvent, LiveStats, Question</p>
            <p>Projector: Match, Round, Question, Answer, SupportEvent, Score</p>
            <p>Players: own Participant, current Round, own Answer, own Score</p>
            <p>Crowd: own EnergyBalance, PlayAlongAnswer, SupportEvent, leaderboard rows</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
        <h2 className="mb-3 text-2xl font-black text-slate-950">Reducer Audit Feed</h2>
        <LiveFeed items={feed} />
      </section>
    </ProjectorShell>
  );
}
