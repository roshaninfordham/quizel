import { useMemo, useState } from "react";
import { Bot, ExternalLink, Play, RefreshCcw, Rocket, Sparkles, Users, Wand2 } from "lucide-react";
import { DEFAULT_SESSION_ID, type Difficulty, type QuestionCount } from "@quizduel/shared";
import {
  useAgentEvents,
  useCurrentMatch,
  useCurrentRound,
  useLiveStats,
  useParticipants,
  useSession,
  useSpacetime
} from "../lib/spacetime/client";
import { useAssignChampions, useCreateSession, useHostActions, useOpenLobby, useResetDemo, useResolveRound } from "../hooks/useArenaActions";
import {
  AgentStatusCard,
  AppShell,
  Button,
  ConnectionBadge,
  ErrorState,
  IconPill,
  LoadingLabel,
  MetricCard,
  Panel,
  ReconnectingBanner,
  SegmentedControl
} from "../components/ui";

const difficultyOptions: Array<{ label: string; value: Difficulty }> = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Expert", value: "expert" }
];

const questionOptions: Array<{ label: string; value: QuestionCount }> = [
  { label: "3 Demo", value: 3 },
  { label: "10 Full Match", value: 10 }
];

export function HostConsole() {
  const { connectionState, lastSyncAt, state } = useSpacetime();
  const session = useSession(DEFAULT_SESSION_ID);
  const stats = useLiveStats(session?.sessionId);
  const match = useCurrentMatch(session?.sessionId);
  const round = useCurrentRound(match?.matchId);
  const participants = useParticipants(session?.sessionId);
  const agentEvents = useAgentEvents(session?.sessionId);
  const [topic, setTopic] = useState(session?.topic ?? "AI + Space + Startups");
  const [difficulty, setDifficulty] = useState<Difficulty>(session?.difficulty ?? "beginner");
  const [questionCount, setQuestionCount] = useState<QuestionCount>(session?.questionCount ?? 3);
  const create = useCreateSession();
  const lobby = useOpenLobby();
  const reset = useResetDemo();
  const assign = useAssignChampions();
  const host = useHostActions();
  const resolve = useResolveRound();

  const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL ?? window.location.origin;
  const links = useMemo(
    () => [
      ["Lobby", `/lobby/${session?.sessionId ?? DEFAULT_SESSION_ID}`],
      ["Join", `/join/${session?.joinCode ?? "ARENA-42"}`],
      ["Reveal", `/arena/${session?.sessionId ?? DEFAULT_SESSION_ID}/reveal`],
      ["Arena", `/arena/${session?.sessionId ?? DEFAULT_SESSION_ID}`],
      ["Tech", `/tech/${session?.sessionId ?? DEFAULT_SESSION_ID}`],
      ["Final", `/arena/${session?.sessionId ?? DEFAULT_SESSION_ID}/final`]
    ],
    [session?.joinCode, session?.sessionId]
  );

  const error = create.error ?? lobby.error ?? reset.error ?? assign.error ?? host.error ?? resolve.error;
  const loading = create.loading || lobby.loading || reset.loading || assign.loading || host.loading || resolve.loading;

  async function prepareSession() {
    await create.createSession({ topic, difficulty, questionCount });
  }

  async function openLobby() {
    await create.createSession({ topic, difficulty, questionCount });
    await lobby.openLobby(session?.sessionId ?? DEFAULT_SESSION_ID);
  }

  async function generateQuiz() {
    await create.createSession({ topic, difficulty, questionCount });
    await host.generateQuiz({
      sessionId: session?.sessionId ?? DEFAULT_SESSION_ID,
      topic,
      difficulty,
      questionCount
    });
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <IconPill tone="violet">
              <Sparkles className="size-3.5" /> Host Console
            </IconPill>
            <IconPill tone="mint">{session?.status ?? "draft"}</IconPill>
          </div>
          <h1 className="text-4xl font-black text-slate-950">QuizDuel Live — Host Console</h1>
          <p className="mt-2 max-w-3xl text-base font-bold text-slate-600">
            Create the room, generate the quiz, open the QR lobby, and operate the live match from one screen.
          </p>
        </div>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </div>

      <ReconnectingBanner state={connectionState} />
      <ErrorState message={error} />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel accent="violet">
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-extrabold uppercase text-slate-500">Topic</span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="min-h-14 rounded-lg border border-slate-200 bg-white px-4 text-lg font-extrabold outline-none ring-violet-200 focus:ring-4"
              />
            </label>
            <div className="grid gap-2">
              <span className="text-sm font-extrabold uppercase text-slate-500">Difficulty</span>
              <SegmentedControl value={difficulty} options={difficultyOptions} onChange={setDifficulty} />
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-extrabold uppercase text-slate-500">Number of questions</span>
              <SegmentedControl value={questionCount} options={questionOptions} onChange={setQuestionCount} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Button disabled={loading} onClick={generateQuiz} icon={<Wand2 className="size-5" />}>
                Generate AI Quiz
              </Button>
              <Button disabled={loading} onClick={openLobby} variant="success" icon={<Rocket className="size-5" />}>
                Open Lobby
              </Button>
              <Button disabled={loading} onClick={() => reset.resetDemo(session?.sessionId ?? DEFAULT_SESSION_ID)} variant="danger" icon={<RefreshCcw className="size-5" />}>
                Reset Demo
              </Button>
              <Button disabled={loading} onClick={() => host.addSimulatedSupporters(session?.sessionId ?? DEFAULT_SESSION_ID, 100)} variant="secondary" icon={<Users className="size-5" />}>
                Add 100 Simulated Supporters
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Button disabled={loading} onClick={prepareSession} variant="secondary">
                Create Session
              </Button>
              <Button disabled={loading} onClick={() => assign.assignChampions(session?.sessionId ?? DEFAULT_SESSION_ID)} variant="secondary">
                Select Champions
              </Button>
              <Button disabled={loading || !match} onClick={() => match && host.startMatch(match.matchId)} icon={<Play className="size-5" />}>
                Start Match
              </Button>
              <Button disabled={loading || !round} onClick={() => round && resolve.resolveRound(round.roundId)} variant="secondary">
                Resolve Round
              </Button>
              <Button
                disabled={loading || !match}
                onClick={() => {
                  if (!match) return;
                  if (round?.status === "resolved" && round.roundNumber < (session?.questionCount ?? 3)) {
                    void host.startRound(match.matchId, round.roundNumber + 1);
                  } else {
                    void host.finishMatch(match.matchId, true);
                  }
                }}
                variant="secondary"
              >
                Next / Final
              </Button>
            </div>
            {loading ? <LoadingLabel label="Reducer call in flight" /> : null}
          </div>
        </Panel>

        <Panel accent="aqua">
          <h2 className="mb-4 text-xl font-black text-slate-950">Live Session Health</h2>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Room status" value={session?.status ?? "draft"} tone="violet" />
            <MetricCard label="Questions ready" value={state.questions.filter((question) => question.sessionId === session?.sessionId).length} tone="mango" />
            <MetricCard label="Joined" value={stats?.joinedCount ?? 0} detail={`${stats?.realParticipants ?? 0} real · ${stats?.simulatedSupporters ?? 0} simulated`} tone="mint" />
            <MetricCard label="Last sync" value={lastSyncAt ? `${Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000))}s` : "—"} tone="aqua" />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel accent="mango" className="lg:col-span-2">
          <h2 className="mb-3 text-xl font-black text-slate-950">AI Agents</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {agentEvents.length > 0 ? (
              agentEvents.map((event) => <AgentStatusCard key={event.eventId} event={event} />)
            ) : (
              ["Quiz Author Agent", "Fairness Review Agent", "Host Commentator Agent", "Learning Recap Agent"].map((agent) => (
                <div key={agent} className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
                  <Bot className="mb-2 size-5 text-violet-600" />
                  <p className="font-black text-slate-950">{agent}</p>
                  <p className="text-sm font-bold text-slate-500">Waiting for the first request.</p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel accent="coral">
          <h2 className="mb-3 text-xl font-black text-slate-950">SpacetimeDB Actions</h2>
          <div className="space-y-2 font-mono text-sm font-bold text-slate-700">
            {[
              "create_session()",
              "request_questions()",
              "submit_question_batch()",
              "approve_question()",
              "join_session()",
              "support_player()",
              "resolve_round()",
              "reset_demo()"
            ].map((action) => (
              <div key={action} className="rounded-lg bg-slate-950 px-3 py-2 text-cyan-200">
                {action}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Demo Routes</h2>
            <p className="text-sm font-bold text-slate-500">Open these on the laptop, projector, or phones on the same Wi-Fi.</p>
          </div>
          <p className="text-sm font-extrabold text-slate-500">{participants.length} participants in state</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {links.map(([label, path]) => (
            <a
              key={path}
              href={path}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-violet-700"
            >
              {label}
              <ExternalLink className="size-4" />
            </a>
          ))}
        </div>
        <p className="mt-3 text-sm font-bold text-slate-500">Public URL base: {baseUrl}</p>
      </Panel>
    </AppShell>
  );
}
