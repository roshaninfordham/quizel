import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SESSION_CODE,
  DEFAULT_SESSION_ID,
  QUESTION_COUNT,
  QUESTION_GENERATION_FALLBACK_MS,
  SIMULATED_ANSWER_BURST_SIZE,
  SIMULATED_JOIN_BATCH_SIZE,
  TOTAL_MATCH_SECONDS
} from "@quizrush/shared";
import {
  AgentPipeline,
  FloatingAvatarCloud,
  LeaderboardPanel,
  LiveJoinFeed,
  ProjectorShell,
  QRHeroCard,
  QuestionStage,
  RaceReplay,
  ReconnectingOverlay,
  TechMetricStrip,
  TopStatusBar,
  TopicSwarm,
  TournamentBracket,
  WinnerExplosion
} from "../components/ui";
import {
  useFinishMatch,
  useRequestQuestions,
  useResetDemo,
  useResolveRound,
  useSeedQuestions,
  useStartMatch
} from "../hooks/useArenaActions";
import {
  useAgentEvents,
  useAnswers,
  useCurrentQuestion,
  useCurrentRound,
  useLiveStats,
  useMatchEvents,
  useParticipants,
  useSessionByCode,
  useSpacetime
} from "../lib/spacetime/client";
import { getLeaderboard, topicCounts } from "../lib/selectors";
import { TechRoute } from "./TechRoute";

export function ArenaRoute({ code = DEFAULT_SESSION_CODE }: { code?: string }) {
  const { state, connectionState, lastSyncAt, callReducer } = useSpacetime();
  const session = useSessionByCode(code);
  const sessionId = session?.sessionId ?? DEFAULT_SESSION_ID;
  const participants = useParticipants(sessionId);
  const stats = useLiveStats(sessionId);
  const events = useMatchEvents(sessionId);
  const agentEvents = useAgentEvents(sessionId);
  const round = useCurrentRound(sessionId);
  const question = useCurrentQuestion(sessionId);
  const answers = useAnswers(sessionId);
  const leaderboard = useMemo(() => getLeaderboard(state, sessionId), [sessionId, state]);
  const topics = useMemo(() => topicCounts(state, sessionId), [sessionId, state]);
  const [showTech, setShowTech] = useState(false);
  const [now, setNow] = useState(Date.now());

  const { requestQuestions } = useRequestQuestions();
  const { seedQuestions } = useSeedQuestions();
  const { startMatch } = useStartMatch();
  const { resolveRound } = useResolveRound();
  const { finishMatch } = useFinishMatch();
  const { resetDemo } = useResetDemo();
  const questionCountRef = useRef(0);
  questionCountRef.current = state.questions.filter((candidate) => candidate.sessionId === sessionId).length;
  const tickInFlightRef = useRef(false);
  const simulatedAnswerInFlightRef = useRef(false);

  const joinUrl = useMemo(() => {
    const base = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
    return `${base.replace(/\/$/, "")}/join/${session?.code ?? code}`;
  }, [code, session?.code]);
  const phase = session?.status ?? "lobby";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (tickInFlightRef.current) return;
      tickInFlightRef.current = true;
      void callReducer("live_tick", { sessionId }, "projector-live-tick").finally(() => {
        tickInFlightRef.current = false;
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, [callReducer, sessionId]);

  useEffect(() => {
    if (phase !== "playing" || !round || round.status !== "active") return;
    if (!participants.some((participant) => participant.isSimulated)) return;
    const timer = window.setInterval(() => {
      if (simulatedAnswerInFlightRef.current) return;
      simulatedAnswerInFlightRef.current = true;
      void callReducer(
        "simulate_answer_burst",
        { sessionId, count: SIMULATED_ANSWER_BURST_SIZE },
        "simulation-engine"
      ).finally(() => {
        simulatedAnswerInFlightRef.current = false;
      });
    }, 280);
    return () => window.clearInterval(timer);
  }, [callReducer, participants, phase, round, sessionId]);

  useEffect(() => {
    if (!round || round.status !== "active") return;
    if (now < round.endsAt) return;
    void resolveRound(round.roundId);
  }, [now, resolveRound, round]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (key === "t") setShowTech((current) => !current);
      if (key === "r") void resetDemo(sessionId);
      if (key === "a") streamSimulatedRoster(sessionId, callReducer);
      if (key === "f") void finishMatch(sessionId);
      if (key === "s") void startMatch(sessionId);
      if (key === "g") {
        void requestQuestions(sessionId);
        window.setTimeout(() => {
          if (questionCountRef.current < QUESTION_COUNT) void seedQuestions(sessionId, session?.selectedTopic ?? "AI + Space + Startups");
        }, QUESTION_GENERATION_FALLBACK_MS);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [callReducer, finishMatch, requestQuestions, resetDemo, seedQuestions, session?.selectedTopic, sessionId, startMatch]);

  const currentAnswers = round ? answers.filter((answer) => answer.roundId === round.roundId).length : 0;
  const secondsRemaining = round ? Math.ceil(Math.max(0, round.endsAt - now) / 1000) : 25;
  const raceSecondsRemaining =
    session?.matchStartedAt && phase === "playing"
      ? Math.ceil(Math.max(0, session.matchStartedAt + TOTAL_MATCH_SECONDS * 1000 - now) / 1000)
      : TOTAL_MATCH_SECONDS;
  const winner = leaderboard[0];

  return (
    <ProjectorShell>
      <TopStatusBar
        connectedCount={participants.length}
        phase={phase}
        p95LatencyMs={stats?.p95LatencyMs ?? 48}
        reducerCalls={stats?.reducerCalls ?? 0}
        connectionState={connectionState}
        lastSyncAt={lastSyncAt}
      />
      <ReconnectingOverlay state={connectionState} />

      {showTech ? <TechRoute code={session?.code ?? code} embedded /> : null}

      {phase === "playing" ? (
        <div className="grid flex-1 grid-cols-[0.82fr_1.4fr_0.88fr] gap-5">
          <TournamentBracket entries={leaderboard} />
          <div className="flex flex-col gap-5">
            <QuestionStage
              question={question}
              round={round}
              answersCount={currentAnswers}
              secondsRemaining={secondsRemaining}
              raceSecondsRemaining={raceSecondsRemaining}
            />
            <TechMetricStrip stats={stats} eventsCount={events.length} />
          </div>
          <LeaderboardPanel entries={leaderboard} compact />
        </div>
      ) : phase === "finished" || phase === "replay" ? (
        <div className="grid flex-1 grid-cols-[1.2fr_0.8fr] gap-5">
          <div className="flex flex-col gap-5">
            <WinnerExplosion winner={winner} totalPlayers={participants.length} />
            <RaceReplay events={events} participants={participants} />
          </div>
          <LeaderboardPanel entries={leaderboard} />
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-[1.08fr_0.92fr] gap-5">
          <div className="flex flex-col gap-5">
            <QRHeroCard joinUrl={joinUrl} sessionCode={session?.code ?? code} joinedCount={participants.length} countdownSeconds={TOTAL_MATCH_SECONDS} />
            <FloatingAvatarCloud participants={participants} />
          </div>
          <div className="flex flex-col gap-5">
            <TopicSwarm topicCounts={topics} selectedTopic={session?.selectedTopic} />
            <AgentPipeline events={agentEvents} status={phase} />
            <LiveJoinFeed participants={participants} />
            <TechMetricStrip stats={stats} eventsCount={events.length} />
          </div>
        </div>
      )}
    </ProjectorShell>
  );
}

function streamSimulatedRoster(
  sessionId: string,
  callReducer: <T = unknown>(name: string, args: unknown, identity?: string) => Promise<{ ok: boolean; data?: T; error?: string }>
) {
  for (let offset = 0; offset < 100; offset += SIMULATED_JOIN_BATCH_SIZE) {
    window.setTimeout(() => {
      void callReducer(
        "add_simulated_players",
        { sessionId, count: SIMULATED_JOIN_BATCH_SIZE },
        "simulation-engine"
      );
    }, (offset / SIMULATED_JOIN_BATCH_SIZE) * 90);
  }
}
