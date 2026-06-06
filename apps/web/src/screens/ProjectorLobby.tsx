import { Radio, ScanLine, Users } from "lucide-react";
import { DEFAULT_SESSION_ID } from "@quizduel/shared";
import { ConnectionBadge, IconPill, LiveFeed, MetricCard, ProjectorShell, QRJoinCard, TechMetricStrip, useCountdown } from "../components/ui";
import { useLiveStats, useParticipants, useSession, useSpacetime } from "../lib/spacetime/client";

export function ProjectorLobby({ sessionId = DEFAULT_SESSION_ID }: { sessionId?: string }) {
  const { connectionState, lastSyncAt, state } = useSpacetime();
  const session = useSession(sessionId);
  const stats = useLiveStats(session?.sessionId);
  const participants = useParticipants(session?.sessionId);
  const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL ?? window.location.origin;
  const joinUrl = `${baseUrl}/join/${session?.joinCode ?? "ARENA-42"}`;
  const target = session?.lobbyOpenedAt ? session.lobbyOpenedAt + 30_000 : Date.now() + 30_000;
  const countdown = useCountdown(target);
  const feed = state.auditEvents
    .filter((event) => event.sessionId === session?.sessionId)
    .slice(-8)
    .reverse()
    .map((event) => ({ id: event.eventId, message: event.message, createdAt: event.createdAt }));

  return (
    <ProjectorShell>
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <IconPill tone="violet">
              <ScanLine className="size-4" /> Scan to Join
            </IconPill>
            <IconPill tone="mint">{session?.status ?? "draft"}</IconPill>
          </div>
          <h1 className="text-7xl font-black leading-none text-slate-950">QuizDuel Live</h1>
          <p className="mt-4 text-3xl font-extrabold text-slate-600">Scan to join the live quiz battle</p>
        </div>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[440px_1fr]">
        <div className="flex flex-col gap-5">
          <QRJoinCard url={joinUrl} code={session?.joinCode ?? "ARENA-42"} />
          <TechMetricStrip
            connectedClients={stats?.activeClients ?? 0}
            reducerCalls={stats?.reducerCallsCount ?? 0}
            cheerEvents={stats?.cheerEventsCount ?? 0}
            p95={stats?.p95SyncLatencyMs ?? 42}
            duplicateAnswers={stats?.duplicateAnswersRejected ?? 0}
            doubleSpend={stats?.doubleSpendAttemptsBlocked ?? 0}
          />
        </div>

        <div className="grid gap-5">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Joined" value={stats?.joinedCount ?? 0} detail={`${stats?.realParticipants ?? 0} real devices`} tone="mint" icon={<Users className="size-5" />} />
              <MetricCard label="Want to play" value={stats?.playerCandidateCount ?? 0} tone="violet" />
              <MetricCard label="In the Crowd" value={stats?.crowdCount ?? 0} tone="aqua" />
              <MetricCard label="Match starts" value={countdown} tone="mango" />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <p className="text-xl font-extrabold uppercase text-slate-500">Topic</p>
            <h2 className="mt-2 text-5xl font-black text-slate-950">{session?.topic ?? "AI + Space + Startups"}</h2>
            <div className="mt-6 grid grid-cols-4 gap-3">
              {participants.slice(-16).map((participant) => (
                <div key={participant.participantId} className="rounded-lg bg-slate-50 px-3 py-3 text-center ring-1 ring-slate-200">
                  <div className="mx-auto grid size-12 place-items-center rounded-lg bg-violet-500 text-lg font-black text-white">
                    {participant.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="mt-2 truncate text-sm font-black text-slate-950">{participant.displayName}</p>
                  <p className="text-xs font-bold text-slate-500">
                    {participant.roleRequested === "player" ? "Champion candidate" : "Crowd"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
              <div className="mb-3 flex items-center gap-2">
                <Radio className="size-5 text-cyan-600" />
                <h2 className="text-2xl font-black text-slate-950">Live Join Feed</h2>
              </div>
              <LiveFeed items={feed} />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-lg">
              <h2 className="text-2xl font-black">Technical Strip</h2>
              <div className="mt-4 space-y-3 text-base font-bold text-cyan-100">
                <p>Subscribed: Session, Participant, LiveStats</p>
                <p>Action: join_session()</p>
                <p>Updates: table snapshots from reducer commits</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </ProjectorShell>
  );
}
