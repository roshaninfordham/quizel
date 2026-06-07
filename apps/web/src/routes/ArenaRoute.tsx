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
  LeaderboardPanel,
  ProjectorLobbyPage,
  ProjectorShell,
  ReconnectingOverlay,
  RoomRosterBand,
  TechDrawer,
  TechMetricStrip,
  TopStatusBar,
  WinnerExplosion
} from "../components/ui";
import { CleanKnockoutBracket } from "../components/bracket/CleanKnockoutBracket";
import {
  useFinishMatch,
  useRequestQuestions,
  useResetDemo,
  useResolveRound,
  useSeedQuestions,
  useStartMatch
} from "../hooks/useArenaActions";
import {
  useAnswers,
  useCurrentRound,
  useLiveStats,
  useMatchEvents,
  useParticipants,
  useSessionByCode,
  useSpacetime
} from "../lib/spacetime/client";
import { getLeaderboard, topicCounts } from "../lib/selectors";
import { initSounds, playCountdownTick, playJoin, playWinner, unlockAudioOnFirstTap } from "../lib/sound/soundManager";

export function ArenaRoute({ code = DEFAULT_SESSION_CODE }: { code?: string }) {
  const { state, connectionState, lastSyncAt, callReducer } = useSpacetime();
  const session = useSessionByCode(code);
  const sessionId = session?.sessionId ?? DEFAULT_SESSION_ID;
  const participants = useParticipants(sessionId);
  const stats = useLiveStats(sessionId);
  const events = useMatchEvents(sessionId);
  const clientErrors = state.clientErrors.filter((error) => error.sessionId === sessionId);
  const round = useCurrentRound(sessionId);
  const answers = useAnswers(sessionId);
  const leaderboard = useMemo(() => getLeaderboard(state, sessionId), [sessionId, state]);
  const winner = leaderboard[0];
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
  questionCountRef.current = state.questionPacks.some((candidate) => candidate.sessionId === sessionId && candidate.status !== "superseded")
    ? QUESTION_COUNT
    : state.questions.filter((candidate) => candidate.sessionId === sessionId).length;
  const tickInFlightRef = useRef(false);
  const simulatedAnswerInFlightRef = useRef(false);
  const autoRequestRef = useRef(false);
  const autoSeedRef = useRef(false);
  const autoStartRef = useRef(false);
  const lastParticipantCountRef = useRef(participants.length);
  const lastCountdownSecondRef = useRef<number | null>(null);
  const winnerSoundRef = useRef<string | null>(null);
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
  const admittedRacers = participants.filter((participant) => participant.admissionStatus === "admitted").length;
  const activeChampionRacers = participants.filter((participant) => participant.admissionStatus === "admitted" && participant.championStatus === "active").length;
  const simulatedRacers = participants.filter((participant) => participant.isSimulated).length;
  const capacityLabel = simulatedRacers
    ? `${admittedRacers} reducer racers`
    : `${session?.admittedCount ?? stats?.admittedRacers ?? admittedRacers}/${session?.maxRacers ?? 12} admitted`;

  useEffect(() => {
    initSounds({ mutedByDefault: true });
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (participants.length > lastParticipantCountRef.current) playJoin();
    lastParticipantCountRef.current = participants.length;
  }, [participants.length]);

  useEffect(() => {
    if (phase !== "playing" || !round) return;
    const remaining = Math.ceil(Math.max(0, round.endsAt - now) / 1000);
    if (remaining <= 5 && remaining > 0 && lastCountdownSecondRef.current !== remaining) {
      lastCountdownSecondRef.current = remaining;
      playCountdownTick();
    }
  }, [now, phase, round]);

  useEffect(() => {
    if ((phase === "finished" || phase === "replay") && winner?.participant.participantId && winnerSoundRef.current !== winner.participant.participantId) {
      winnerSoundRef.current = winner.participant.participantId;
      playWinner();
    }
  }, [phase, winner?.participant.participantId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (tickInFlightRef.current) return;
      tickInFlightRef.current = true;
      void callReducer("live_tick", { sessionId }, "projector-live-tick").finally(() => {
        tickInFlightRef.current = false;
      });
    }, 1000);
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
      const hasSimulatedRacers = participants.some((participant) => participant.isSimulated);
      if (hasSimulatedRacers) {
        autoStartRef.current = true;
        window.setTimeout(() => {
          startVisualRace(sessionId, callReducer);
        }, 450);
      }
    }
  }, [
    callReducer,
    participants.length,
    participants,
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
      unlockAudioOnFirstTap();
      const key = event.key.toLowerCase();
      if (key === "t") setShowTech((current) => !current);
      if (key === "r") void resetDemo(sessionId);
      if (key === "a") streamSimulatedRoster(sessionId, callReducer);
      if (key === "f") void finishMatch(sessionId);
      if (key === "s") startVisualRace(sessionId, callReducer);
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

  const secondsRemaining = round ? Math.ceil(Math.max(0, round.endsAt - now) / 1000) : 25;
  const raceSecondsRemaining =
    session?.matchStartedAt && phase === "playing"
      ? Math.ceil(Math.max(0, session.matchStartedAt + TOTAL_MATCH_SECONDS * 1000 - now) / 1000)
      : TOTAL_MATCH_SECONDS;
  return (
    <ProjectorShell>
      <TopStatusBar
        connectedCount={participants.length}
        racingCount={admittedRacers}
        phase={phase}
        p95LatencyMs={stats?.p95LatencyMs ?? 48}
        reducerCalls={stats?.reducerCalls ?? 0}
        connectionState={connectionState}
        lastSyncAt={lastSyncAt}
        onToggleTech={() => setShowTech((current) => !current)}
        techOpen={showTech}
      />
      <ReconnectingOverlay state={connectionState} floating />
      <TechDrawer
        open={showTech}
        onClose={() => setShowTech(false)}
        stats={stats}
        events={events}
        participants={participants}
        session={session}
        state={state}
        clientErrors={clientErrors}
      />

      {phase === "playing" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)] gap-5">
            <div className="flex min-h-0 flex-col gap-5">
              <CleanKnockoutBracket
                entries={leaderboard}
                session={session}
                stats={stats}
                activeRacers={activeChampionRacers}
                raceSecondsRemaining={raceSecondsRemaining}
                nextGateSeconds={secondsRemaining}
                capacityLabel={capacityLabel}
              />
              <TechMetricStrip stats={stats} eventsCount={events.length} />
            </div>
            <LeaderboardPanel entries={leaderboard} compact />
          </div>
          <RoomRosterBand participants={participants} />
        </div>
      ) : phase === "finished" || phase === "replay" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] gap-5">
            <div className="flex min-h-0 flex-col gap-5">
              <WinnerExplosion winner={winner} totalPlayers={participants.length} />
              <CleanKnockoutBracket
                entries={leaderboard}
                session={session}
                stats={stats}
                activeRacers={activeChampionRacers}
                raceSecondsRemaining={0}
                nextGateSeconds={0}
                capacityLabel="final committed"
              />
            </div>
            <LeaderboardPanel entries={leaderboard} />
          </div>
          <RoomRosterBand participants={participants} />
        </div>
      ) : (
        <ProjectorLobbyPage
          joinUrl={joinUrl}
          sessionCode={session?.code ?? code}
          participants={participants}
          topicCounts={topics}
          selectedTopic={session?.selectedTopic}
          stats={stats}
          phase={phase}
          countdownSeconds={participants.length ? topicWindowSeconds : TOTAL_MATCH_SECONDS}
        />
      )}
    </ProjectorShell>
  );
}

function startVisualRace(
  sessionId: string,
  callReducer: <T = unknown>(name: string, args: unknown, identity?: string) => Promise<{ ok: boolean; data?: T; error?: string }>
) {
  void callReducer("start_match", { sessionId }, "operator");
  for (let tick = 0; tick < 125; tick += 1) {
    window.setTimeout(() => {
      void callReducer("simulate_answer_burst", { sessionId, count: 32 }, "simulation-engine");
    }, 900 + tick * 220);
  }
}

function streamSimulatedRoster(
  sessionId: string,
  callReducer: <T = unknown>(name: string, args: unknown, identity?: string) => Promise<{ ok: boolean; data?: T; error?: string }>,
  totalCount = 100
) {
  for (let offset = 0; offset < totalCount; offset += SIMULATED_JOIN_BATCH_SIZE) {
    window.setTimeout(() => {
      void callReducer(
        "add_simulated_players",
        { sessionId, count: Math.min(SIMULATED_JOIN_BATCH_SIZE, totalCount - offset) },
        "simulation-engine"
      );
    }, (offset / SIMULATED_JOIN_BATCH_SIZE) * 90);
  }
}
