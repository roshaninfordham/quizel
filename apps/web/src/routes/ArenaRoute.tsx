import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SELECTED_TOPIC,
  DEFAULT_SESSION_CODE,
  DEFAULT_SESSION_ID,
  QUESTION_COUNT,
  QUESTION_GENERATION_FALLBACK_MS,
  SIMULATED_ANSWER_BURST_SIZE,
  SIMULATED_JOIN_BATCH_SIZE,
  TOPIC_COLLECTION_SECONDS,
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
  const phase = session?.status ?? "lobby";
  const questionCountRef = useRef(0);
  questionCountRef.current = state.questions.filter((candidate) => candidate.sessionId === sessionId).length;
  const tickInFlightRef = useRef(false);
  const simulatedAnswerInFlightRef = useRef(false);
  const autoRequestRef = useRef(false);
  const autoSeedRef = useRef(false);
  const autoStartRef = useRef(false);
  const phaseRef = useRef(phase);
  const participantCountRef = useRef(participants.length);
  const sessionCreatedAtRef = useRef(session?.createdAt ?? 0);
  phaseRef.current = phase;
  participantCountRef.current = participants.length;
  sessionCreatedAtRef.current = session?.createdAt ?? 0;

  const joinUrl = useMemo(() => {
    const configuredBase = String(import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim();
    const projectorIsLocal =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "::1";
    const base = projectorIsLocal ? configuredBase || window.location.origin : window.location.origin;
    return `${base.replace(/\/$/, "")}/join/${session?.code ?? code}`;
  }, [code, session?.code]);
  const firstJoinAt = participants.length ? Math.min(...participants.map((participant) => participant.joinedAt)) : null;
  const topicWindowSeconds = firstJoinAt
    ? Math.max(0, Math.ceil((firstJoinAt + TOPIC_COLLECTION_SECONDS * 1000 - now) / 1000))
    : TOPIC_COLLECTION_SECONDS;
  const selectedTopic = session?.selectedTopic ?? (topics.slice(0, 3).map((topic) => topic.topic).join(" + ") || DEFAULT_SELECTED_TOPIC);

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
    const currentAnswersForRound = answers.filter((answer) => answer.roundId === round.roundId);
    const answeredIds = new Set(currentAnswersForRound.map((answer) => answer.participantId));
    const realParticipants = participants.filter((participant) => !participant.isSimulated);
    const realAnswered = realParticipants.filter((participant) => answeredIds.has(participant.participantId)).length;
    const enoughRealAnswers = realParticipants.length > 0 && realAnswered >= realParticipants.length;
    const enoughRoomAnswers = participants.length > 0 && currentAnswersForRound.length / participants.length >= 0.85;
    const canAdvanceEarly = now >= round.startsAt + 650 && currentAnswersForRound.length > 0 && (enoughRealAnswers || enoughRoomAnswers);
    if (now < round.endsAt && !canAdvanceEarly) return;
    void resolveRound(round.roundId);
  }, [answers, now, participants, resolveRound, round]);

  useEffect(() => {
    if (phase === "lobby" && participants.length === 0) {
      autoRequestRef.current = false;
      autoSeedRef.current = false;
      autoStartRef.current = false;
      return;
    }

    if (participants.length > 0 && (phase === "lobby" || phase === "topic_voting") && topicWindowSeconds <= 0 && !autoRequestRef.current) {
      autoRequestRef.current = true;
      const automationSessionCreatedAt = session?.createdAt ?? 0;
      void requestQuestions(sessionId, selectedTopic);
      window.setTimeout(() => {
        const stillSameSession = sessionCreatedAtRef.current === automationSessionCreatedAt;
        const stillGenerating = phaseRef.current === "generating" || phaseRef.current === "topic_voting";
        if (
          stillSameSession &&
          stillGenerating &&
          participantCountRef.current > 0 &&
          !autoSeedRef.current &&
          questionCountRef.current < QUESTION_COUNT
        ) {
          autoSeedRef.current = true;
          void seedQuestions(sessionId, selectedTopic);
        }
      }, QUESTION_GENERATION_FALLBACK_MS);
    }

    if (
      participants.length > 0 &&
      (phase === "ready" || (phase === "generating" && questionCountRef.current >= QUESTION_COUNT)) &&
      !autoStartRef.current
    ) {
      autoStartRef.current = true;
      window.setTimeout(() => void startMatch(sessionId), 450);
    }
  }, [
    participants.length,
    phase,
    questionCountRef,
    requestQuestions,
    seedQuestions,
    selectedTopic,
    session?.createdAt,
    sessionId,
    startMatch,
    topicWindowSeconds
  ]);

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
          if (questionCountRef.current < QUESTION_COUNT) void seedQuestions(sessionId, selectedTopic);
        }, QUESTION_GENERATION_FALLBACK_MS);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [callReducer, finishMatch, requestQuestions, resetDemo, seedQuestions, selectedTopic, sessionId, startMatch]);

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
            <QRHeroCard
              joinUrl={joinUrl}
              sessionCode={session?.code ?? code}
              joinedCount={participants.length}
              countdownSeconds={participants.length ? topicWindowSeconds : TOTAL_MATCH_SECONDS}
            />
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
