import { DEFAULT_SESSION_CODE, DEFAULT_SESSION_ID } from "@quizrush/shared";
import { ConnectionBadge, Panel, ProjectorShell } from "../components/ui";
import {
  useAgentEvents,
  useLiveStats,
  useMatchEvents,
  useParticipants,
  useQuestions,
  useSessionByCode,
  useSpacetime
} from "../lib/spacetime/client";

export function TechRoute({ code = DEFAULT_SESSION_CODE, embedded = false }: { code?: string; embedded?: boolean }) {
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const session = useSessionByCode(code);
  const sessionId = session?.sessionId ?? DEFAULT_SESSION_ID;
  const stats = useLiveStats(sessionId);
  const participants = useParticipants(sessionId);
  const questions = useQuestions(sessionId);
  const events = useMatchEvents(sessionId);
  const agentEvents = useAgentEvents(sessionId);
  const traces = state.operationTraces.filter((trace) => trace.sessionId === sessionId).slice(-8).reverse();
  const clientErrors = state.clientErrors.filter((error) => error.sessionId === sessionId).slice(-8).reverse();

  const content = (
    <Panel className="border-2 border-slate-900 !bg-slate-950 !text-white shadow-2xl shadow-slate-400/60">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase text-cyan-300">Sponsor tech proof</p>
          <h1 className="mt-1 text-5xl font-black">SpacetimeDB Live Engine</h1>
          <p className="mt-2 max-w-4xl text-xl font-bold text-slate-300">
            Phones call reducers. The projector subscribes to committed table state. Replay reads the MatchEvent ledger.
          </p>
        </div>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </div>

      <div className="mt-8 grid grid-cols-4 gap-4">
        <TechCard label="connected clients" value={stats?.activeClients ?? participants.length} />
        <TechCard label="reducer calls" value={stats?.reducerCalls ?? 0} />
        <TechCard label="answers/sec" value={stats?.answersPerSec ?? 0} />
        <TechCard label="duplicate answers rejected" value={stats?.duplicateAnswersRejected ?? 0} />
        <TechCard label="p95 sync latency" value={`${stats?.p95LatencyMs ?? 48}ms`} />
        <TechCard label="players joined" value={stats?.joinedCount ?? participants.length} />
        <TechCard label="real players" value={stats?.realJoinedCount ?? participants.filter((participant) => !participant.isSimulated).length} />
        <TechCard label="simulated load" value={stats?.simulatedJoinedCount ?? participants.filter((participant) => participant.isSimulated).length} />
        <TechCard label="questions approved" value={questions.length} />
        <TechCard label="match events recorded" value={events.length} />
        <TechCard label="operation traces" value={traces.length} />
        <TechCard label="client errors" value={clientErrors.length} />
      </div>

      <div className="mt-8 grid grid-cols-[1fr_1fr] gap-5">
        <div className="rounded-[24px] bg-white/10 p-5">
          <h2 className="text-2xl font-black">Current Tables</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-lg font-black text-slate-100">
            {[
              ["Session", state.sessions.length],
              ["Participant", state.participants.length],
              ["TopicVote", state.topicVotes.length],
              ["Question", state.questions.length],
              ["Round", state.rounds.length],
              ["Answer", state.answers.length],
              ["Score", state.scores.length],
              ["MatchEvent", state.matchEvents.length],
              ["AgentEvent", state.agentEvents.length],
              ["LiveStats", state.liveStats.length]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                <span>{label}</span>
                <span className="text-cyan-300">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[24px] bg-white/10 p-5">
          <h2 className="text-2xl font-black">Live Subscriptions</h2>
          <div className="mt-4 space-y-3 text-lg font-black text-slate-100">
            {["Session by code", "Participant where session_id", "TopicVote where session_id", "Round current", "Question current", "Score where session_id", "MatchEvent recent", "AgentEvent recent", "LiveStats by session_id"].map((item) => (
              <div key={item} className="rounded-2xl bg-white/10 px-4 py-3">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-[24px] bg-white/10 p-5">
        <h2 className="text-2xl font-black">Agent Activity</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {agentEvents.map((event) => (
            <div key={event.eventId} className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-sm font-black uppercase text-cyan-300">{event.agentName} · {event.status}</p>
              <p className="mt-1 text-base font-bold text-slate-100">{event.content}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-[24px] bg-white/10 p-5">
        <h2 className="text-2xl font-black">Operation Trace</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {traces.map((trace) => (
            <div key={trace.traceId} className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-sm font-black uppercase text-cyan-300">{trace.reducer} · {trace.ok ? "ok" : "fail"}</p>
              <p className="mt-1 text-base font-bold text-slate-100">
                {trace.durationMs}ms · v{trace.stateVersion} · {trace.identity}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-[24px] bg-white/10 p-5">
        <h2 className="text-2xl font-black">Client Error Recovery</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {clientErrors.map((error) => (
            <div key={error.errorId} className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-sm font-black uppercase text-rose-200">
                {error.screen} · {error.errorCode} · {error.stackHash ?? "no hash"}
              </p>
              <p className="mt-1 text-base font-bold text-slate-100">{error.message}</p>
            </div>
          ))}
          {!clientErrors.length ? <p className="text-lg font-black text-slate-300">No client recovery events recorded.</p> : null}
        </div>
      </div>
    </Panel>
  );

  if (embedded) return content;
  return <ProjectorShell>{content}</ProjectorShell>;
}

function TechCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[24px] bg-white p-5 text-slate-950">
      <p className="text-sm font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </div>
  );
}
