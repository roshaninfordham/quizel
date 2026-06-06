import { Brain, Radio, Sparkles, Trophy, Users } from "lucide-react";
import { DEFAULT_SESSION_ID, type OptionKey } from "@quizduel/shared";
import { getCurrentQuestion, getParticipant, getPlayerLeaderboard, getScore } from "../lib/selectors";
import {
  useAgentEvents,
  useCurrentMatch,
  useCurrentRound,
  useLiveStats,
  useSpacetime,
  useSupportTotals
} from "../lib/spacetime/client";
import {
  AnswerButton,
  ConfettiBurst,
  ConnectionBadge,
  IconPill,
  LiveFeed,
  MetricCard,
  PlayerCard,
  ProjectorShell,
  SupportBar,
  TechMetricStrip,
  TimerRing
} from "../components/ui";

export function ProjectorArena({ sessionId = DEFAULT_SESSION_ID }: { sessionId?: string }) {
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const stats = useLiveStats(sessionId);
  const match = useCurrentMatch(sessionId);
  const round = useCurrentRound(match?.matchId);
  const question = getCurrentQuestion(state, round);
  const supportTotals = useSupportTotals(round?.roundId);
  const agentEvents = useAgentEvents(sessionId);
  const player1 = getParticipant(state, match?.player1Id);
  const player2 = getParticipant(state, match?.player2Id);
  const player1Answer = state.answers.find((answer) => answer.roundId === round?.roundId && answer.participantId === match?.player1Id);
  const player2Answer = state.answers.find((answer) => answer.roundId === round?.roundId && answer.participantId === match?.player2Id);
  const player1Support = match ? supportTotals[match.player1Id] ?? 0 : 0;
  const player2Support = match ? supportTotals[match.player2Id] ?? 0 : 0;
  const feed = [
    ...state.supportEvents
      .filter((event) => event.roundId === round?.roundId)
      .slice(-5)
      .map((event) => {
        const supporter = getParticipant(state, event.supporterId);
        const player = getParticipant(state, event.playerId);
        return {
          id: event.supportId,
          message: `${supporter?.displayName ?? "Crowd"} cheered +${event.amount} for ${player?.displayName ?? "Champion"}`,
          createdAt: event.createdAt
        };
      }),
    ...state.auditEvents
      .filter((event) => event.sessionId === sessionId)
      .slice(-4)
      .map((event) => ({ id: event.eventId, message: event.message, createdAt: event.createdAt }))
  ].sort((a, b) => b.createdAt - a.createdAt);

  if (!match) {
    return (
      <ProjectorShell>
        <header className="flex items-start justify-between gap-6">
          <div>
            <IconPill tone="violet">
              <Sparkles className="size-4" /> Arena
            </IconPill>
            <h1 className="mt-3 text-7xl font-black text-slate-950">Arena waiting</h1>
            <p className="mt-4 text-3xl font-extrabold text-slate-600">Open the lobby and select two Champions from the host console.</p>
          </div>
          <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
        </header>
      </ProjectorShell>
    );
  }

  const options: Array<[OptionKey, string]> = question
    ? [
        ["A", question.optionA],
        ["B", question.optionB],
        ["C", question.optionC],
        ["D", question.optionD]
      ]
    : [];
  const leaderboard = getPlayerLeaderboard(state, match);
  const winner = round?.winnerPlayerId ? getParticipant(state, round.winnerPlayerId) : leaderboard[0]?.participant;
  const latestExplanation = agentEvents.find((event) => event.eventType === "round_explanation" || event.eventType === "learning_recap") ?? agentEvents[0];

  return (
    <ProjectorShell>
      <ConfettiBurst fireKey={round?.status === "resolved" ? round.roundId : null} />
      <header className="grid gap-4 xl:grid-cols-[1fr_760px]">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <IconPill tone="violet">QuizDuel Live</IconPill>
            <IconPill tone="mint">Round {match.currentRoundNumber || 1}</IconPill>
            <IconPill tone="aqua">
              <Users className="size-4" /> {stats?.joinedCount ?? 0} live
            </IconPill>
          </div>
          <h1 className="text-5xl font-black leading-none text-slate-950">Live Arena</h1>
        </div>
        <TechMetricStrip
          connectedClients={stats?.activeClients ?? 0}
          reducerCalls={stats?.reducerCallsCount ?? 0}
          cheerEvents={stats?.cheerEventsCount ?? 0}
          p95={stats?.p95SyncLatencyMs ?? 42}
          duplicateAnswers={stats?.duplicateAnswersRejected ?? 0}
          doubleSpend={stats?.doubleSpendAttemptsBlocked ?? 0}
        />
      </header>

      <section className="grid flex-1 gap-5 xl:grid-cols-[360px_1fr_360px]">
        <div className="grid content-start gap-4">
          <PlayerCard
            participant={player1}
            score={getScore(state, match.matchId, match.player1Id)}
            support={player1Support}
            side="Left Champion"
            active={round?.winnerPlayerId === match.player1Id}
          />
          <MetricCard
            label="Answer"
            value={player1Answer ? player1Answer.selectedOption : "—"}
            detail={player1Answer ? `${player1Answer.responseMs}ms · ${player1Answer.isCorrect ? "correct" : "missed"}` : "Waiting for lock"}
            tone={player1Answer?.isCorrect ? "mint" : "violet"}
          />
        </div>

        <div className="grid gap-5">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="text-xl font-extrabold uppercase text-slate-500">Question</p>
                <h2 className="mt-2 text-5xl font-black leading-tight text-slate-950">{question?.questionText ?? "Question loading"}</h2>
              </div>
              <TimerRing startsAt={round?.startsAt} endsAt={round?.endsAt} status={round?.status} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              {options.map(([label, text]) => (
                <AnswerButton
                  key={label}
                  label={label}
                  text={text}
                  selected={player1Answer?.selectedOption === label || player2Answer?.selectedOption === label}
                  correct={round?.status === "resolved" && question?.correctOption === label}
                  wrong={false}
                  disabled
                />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
            <SupportBar
              leftLabel={player1?.displayName ?? "Player 1"}
              rightLabel={player2?.displayName ?? "Player 2"}
              leftValue={player1Support}
              rightValue={player2Support}
            />
          </section>

          {round?.status === "resolved" ? (
            <section className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <Trophy className="size-8 text-amber-500" />
                <h2 className="text-4xl font-black text-slate-950">Round Result</h2>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <MetricCard label="Correct answer" value={question?.correctOption ?? "—"} tone="mint" />
                <MetricCard label="Round winner" value={winner?.displayName ?? "—"} tone="mango" />
                <MetricCard label="Fastest answer" value={`${Math.min(player1Answer?.responseMs ?? 9999, player2Answer?.responseMs ?? 9999)}ms`} tone="aqua" />
              </div>
              <p className="mt-5 text-2xl font-extrabold leading-snug text-emerald-900">{question?.explanation}</p>
            </section>
          ) : null}
        </div>

        <div className="grid content-start gap-4">
          <PlayerCard
            participant={player2}
            score={getScore(state, match.matchId, match.player2Id)}
            support={player2Support}
            side="Right Champion"
            active={round?.winnerPlayerId === match.player2Id}
          />
          <MetricCard
            label="Answer"
            value={player2Answer ? player2Answer.selectedOption : "—"}
            detail={player2Answer ? `${player2Answer.responseMs}ms · ${player2Answer.isCorrect ? "correct" : "missed"}` : "Waiting for lock"}
            tone={player2Answer?.isCorrect ? "mint" : "aqua"}
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
          <div className="mb-3 flex items-center gap-2">
            <Radio className="size-5 text-cyan-600" />
            <h2 className="text-2xl font-black text-slate-950">Live Crowd Feed</h2>
          </div>
          <LiveFeed items={feed} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <Brain className="size-6 text-cyan-300" />
            <h2 className="text-2xl font-black">AI Host Commentary</h2>
          </div>
          <p className="mt-4 text-xl font-extrabold leading-snug text-cyan-50">
            {latestExplanation?.content ?? "The AI Host is waiting for the round to resolve."}
          </p>
        </div>
      </section>
    </ProjectorShell>
  );
}
