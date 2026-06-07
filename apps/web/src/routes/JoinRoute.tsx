import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, Mic, Pencil, Radio, Share2, Sparkles, Square } from "lucide-react";
import {
  AVATAR_CHOICES,
  DEFAULT_SESSION_CODE,
  INTENT_PLACEHOLDERS,
  INTENT_SUGGESTIONS,
  QUESTION_COUNT,
  type OptionKey,
  type ShareCard,
  percentile
} from "@quizrush/shared";
import { AnswerButton, Button, ConnectionBadge, LiveAgentBuildPipeline, Panel, PhoneShell, ReconnectingOverlay, SoundToggle, cn } from "../components/ui";
import { useSpeechIntent } from "../hooks/useSpeechIntent";
import { useCreateShareCard, useSubmitAnswer } from "../hooks/useArenaActions";
import {
  getDeviceIdentity,
  getJoinedParticipantId,
  setJoinedParticipantId,
  useCurrentQuestion,
  useCurrentRound,
  useSessionByCode,
  useSpacetime
} from "../lib/spacetime/client";
import { getAnswerForParticipant, getScore } from "../lib/selectors";
import { parseIntentPreview } from "../lib/intent";
import {
  playAnswerLock,
  playArenaAssigned,
  playCorrect,
  playIntentDetected,
  playMicStart,
  playMicStop,
  playWrong,
  unlockAudioOnFirstTap
} from "../lib/sound/soundManager";

type JoinStep = "profile" | "intent" | "confirm";

export function JoinRoute({ code = DEFAULT_SESSION_CODE }: { code?: string }) {
  const { state, connectionState, lastSyncAt, callReducer } = useSpacetime();
  const session = useSessionByCode(code);
  const sessionId = session?.sessionId ?? "session-demo";
  const [participantId, setParticipantId] = useState(() => getJoinedParticipantId(code));
  const [step, setStep] = useState<JoinStep>("profile");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_CHOICES[0] ?? "🚀");
  const [intentText, setIntentText] = useState("");
  const [now, setNow] = useState(Date.now());
  const [lastAnswerState, setLastAnswerState] = useState<"correct" | "wrong" | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [enterLoading, setEnterLoading] = useState(false);
  const [enterRetrying, setEnterRetrying] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);
  const questionRenderedAtRef = useRef<number | null>(null);
  const renderedRoundIdRef = useRef<string | null>(null);
  const shareCardsRef = useRef(state.shareCards);
  const placeholder = useMemo(() => INTENT_PLACEHOLDERS[Math.floor(Math.random() * INTENT_PLACEHOLDERS.length)] ?? "AI agents, databases, and startups", []);
  const parsedIntent = useMemo(() => parseIntentPreview(intentText), [intentText]);
  const participant = state.participants.find((candidate) => candidate.participantId === participantId);
  const round = useCurrentRound(sessionId);
  const question = useCurrentQuestion(sessionId, participantId);
  const score = getScore(state, sessionId, participantId);
  const finalResult = state.finalResults.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
  const shareCard = state.shareCards.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
  const answer = getAnswerForParticipant(state, round?.roundId, participantId ?? undefined);
  const totalPlayers = state.participants.filter((candidate) => candidate.sessionId === sessionId).length;
  const playerIntent = state.playerIntents.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
  const joinedVotes = state.topicVotes.filter((vote) => vote.participantId === participantId).map((vote) => vote.topic);
  const participantPack = state.questionPacks.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
  const agentEvents = state.agentEvents.filter((candidate) => candidate.sessionId === sessionId);
  const sessionQuestions = state.questions.filter(
    (candidate) => candidate.sessionId === sessionId && (!participantId || candidate.participantId === participantId || candidate.participantId === null)
  );
  const questionsReady = sessionQuestions.length >= QUESTION_COUNT;
  const packReady =
    questionsReady ||
    Boolean(participantPack) ||
    playerIntent?.status === "pack_ready" ||
    session?.status === "ready" ||
    session?.status === "playing";
  const arenaLabel = joinedVotes.length ? joinedVotes.map((topic) => topic.replace(/\s+(Systems|Strategy|Technology)$/i, "")).join(" x ") : session?.selectedTopic ?? parsedIntent.arenaName;
  const packSource = packSourceLabel(
    sessionQuestions[0]?.generatedBy,
    sessionQuestions[0]?.fairnessStatus,
    sessionQuestions[0]?.sourceUrl,
    participantPack?.sourceType,
    playerIntent?.status,
    session?.status
  );

  const { submitAnswer, loading: answering, error: answerError } = useSubmitAnswer();
  const { createShareCard, loading: sharing, error: shareError } = useCreateShareCard();
  const speech = useSpeechIntent((value) => setIntentText(value));

  const options = useMemo<Array<[OptionKey, string]>>(
    () =>
      question
        ? [
            ["A", question.optionA],
            ["B", question.optionB],
            ["C", question.optionC],
            ["D", question.optionD]
          ]
        : [],
    [question]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!participantId) return;
    const beat = () => {
      void callReducer("heartbeat", { sessionId, clientLatencyMs: 48 });
    };
    beat();
    const timer = window.setInterval(beat, 5_000);
    return () => window.clearInterval(timer);
  }, [callReducer, participantId, sessionId]);

  useEffect(() => {
    shareCardsRef.current = state.shareCards;
  }, [state.shareCards]);

  useEffect(() => {
    if (!answer || lastAnswerState) return;
    const next = answer.isCorrect ? "correct" : "wrong";
    setLastAnswerState(next);
    if (next === "correct") playCorrect();
    else playWrong();
  }, [answer, lastAnswerState]);

  useEffect(() => {
    if (!round || !answer || answer.roundId === round.roundId) return;
    setLastAnswerState(null);
  }, [answer, round]);

  useEffect(() => {
    questionRenderedAtRef.current = null;
    renderedRoundIdRef.current = null;
    setLastAnswerState(null);
  }, [round?.roundId, question?.questionId]);

  useEffect(() => {
    if (!round || !question || answer) return;
    if (now < round.startsAt || now > round.endsAt) return;
    if (renderedRoundIdRef.current === round.roundId && questionRenderedAtRef.current !== null) return;
    renderedRoundIdRef.current = round.roundId;
    questionRenderedAtRef.current = performance.now();
  }, [answer, now, question, round]);

  const continueToIntent = () => {
    unlockAudioOnFirstTap();
    setStep("intent");
  };

  const detectArena = () => {
    if (!intentText.trim()) return;
    playIntentDetected();
    setStep("confirm");
  };

  const enterArena = async () => {
    unlockAudioOnFirstTap();
    if (enterLoading) return;
    setEnterLoading(true);
    setEnterRetrying(false);
    setEnterError(null);
    const identity = getDeviceIdentity();
    try {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        setEnterRetrying(attempt > 1);
        try {
          const joined = await callReducer<{ participant: { participantId: string; admissionStatus?: string } }>(
            "join_session",
            { code, displayName: displayName.trim() || "Player", avatar },
            identity
          );
          if (!joined.ok || !joined.data?.participant?.participantId) throw new Error(joined.error || "Join did not return a participant row.");

          const nextParticipantId = joined.data.participant.participantId;
          if (joined.data.participant.admissionStatus && joined.data.participant.admissionStatus !== "admitted") {
            setJoinedParticipantId(nextParticipantId, code);
            setParticipantId(nextParticipantId);
            return;
          }

          const intent = await callReducer("submit_player_intent", { sessionId, rawText: intentText, transcriptSource: speech.finalTranscript ? "speech" : "typed" }, identity);
          if (!intent.ok) throw new Error(intent.error || "Intent commit failed.");

          const vote = await callReducer("submit_topic_vote", { sessionId, topics: parsedIntent.topics }, identity);
          if (!vote.ok) throw new Error(vote.error || "Topic commit failed.");

          const pack = await callReducer("request_questions", { sessionId, topic: parsedIntent.arenaName, questionCount: QUESTION_COUNT }, identity);
          if (!pack.ok) throw new Error(pack.error || "Quiz pack request failed.");

          setJoinedParticipantId(nextParticipantId, code);
          setParticipantId(nextParticipantId);
          playArenaAssigned();
          return;
        } catch (error) {
          if (attempt < 3) {
            await sleep(350 * attempt);
            continue;
          }
          const message = friendlyEnterError(error);
          setEnterError(message);
          await recordEnterArenaError(callReducer, {
            sessionId,
            participantId,
            message,
            rawError: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } finally {
      setEnterRetrying(false);
      setEnterLoading(false);
    }
  };

  const submitLockedAnswer = async (key: OptionKey) => {
    if (!round) return;
    if (Date.now() < round.startsAt || Date.now() > round.endsAt) return;
    const clickedAt = performance.now();
    playAnswerLock();
    await submitAnswer(round.roundId, key, {
      clientQuestionRenderedAtMs: questionRenderedAtRef.current,
      clientClickedAtMs: clickedAt
    });
  };

  const shareScore = async () => {
    if (connectionState !== "connected") {
      setShareMessage("Reconnecting before creating your durable score card...");
      return;
    }
    setShareMessage("Creating your database-backed score card...");
    const created = (shareCard ?? (await createShareCard(sessionId, participantId))) as ShareCard | undefined;
    const card = created ?? shareCard ?? (await waitForShareCard(shareCardsRef, sessionId, participantId ?? null));
    if (!card) {
      setShareMessage("Share card is still syncing from SpacetimeDB. Try again in a moment.");
      return;
    }
    const publicBase = String(import.meta.env.VITE_PUBLIC_APP_URL ?? window.location.origin).replace(/\/$/, "");
    const url = `${publicBase}/share/${card.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "QuizRush Arena score",
          text: `${card.displayName} placed #${card.finalRank} with ${card.totalScore.toLocaleString()} points.`,
          url
        });
        setShareMessage("Share sheet opened.");
      } else {
        await navigator.clipboard.writeText(url);
        setShareMessage("Share link copied.");
      }
    } catch {
      setShareMessage(url);
    }
  };

  const toggleMic = () => {
    unlockAudioOnFirstTap();
    if (!speech.available) return;
    if (speech.listening) {
      playMicStop();
      speech.stop();
    } else {
      playMicStart();
      speech.start();
    }
  };

  if (!participant) {
    return (
      <PhoneShell>
        <div className="flex items-center justify-between gap-3">
          <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
          <SoundToggle />
        </div>
        <ReconnectingOverlay state={connectionState} />

        {step === "profile" ? (
          <Panel className="mt-auto">
            <p className="text-sm font-black uppercase text-violet-700">QuizRush Arena</p>
            <h1 className="mt-2 text-5xl font-black leading-none text-slate-950">Enter the sprint</h1>
            <p className="mt-3 text-lg font-bold text-slate-500">One profile, one expertise note, then you race.</p>
            <label className="mt-8 block text-sm font-black uppercase text-slate-500">Your name</label>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Maya"
              className="mt-2 h-16 w-full rounded-[26px] bg-slate-50 px-5 text-2xl font-black outline-none ring-2 ring-slate-200 transition focus:bg-white focus:ring-violet-500"
            />
            <p className="mt-6 text-sm font-black uppercase text-slate-500">Avatar</p>
            <div className="mt-3 grid grid-cols-8 gap-2">
              {AVATAR_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setAvatar(choice)}
                  className={cn(
                    "grid aspect-square place-items-center rounded-full text-2xl transition active:scale-95",
                    avatar === choice ? "bg-gradient-to-r from-violet-600 to-blue-600 shadow-lg shadow-violet-200" : "bg-slate-100"
                  )}
                  aria-label={`Use avatar ${choice}`}
                >
                  {choice}
                </button>
              ))}
            </div>
            <Button onClick={continueToIntent} className="mt-8 w-full !min-h-16 !rounded-[28px] !text-xl" icon={<ArrowRight className="size-6" />}>
              Continue
            </Button>
          </Panel>
        ) : null}

        {step === "intent" ? (
          <Panel className="mt-auto">
            <p className="text-sm font-black uppercase text-violet-700">Expertise intent</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-slate-950">What do you want to compete in?</h1>
            <p className="mt-3 text-base font-bold text-slate-500">Type or say your strongest topics. AI will place you in the right arena.</p>
            <div className="mt-5">
              <p className="text-xs font-black uppercase text-slate-500">Quick starts</p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {INTENT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      unlockAudioOnFirstTap();
                      setIntentText(suggestion);
                      playIntentDetected();
                    }}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-3 text-sm font-black transition active:scale-95",
                      intentText.trim().toLowerCase() === suggestion.toLowerCase()
                        ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-100"
                        : "bg-white text-slate-700 ring-2 ring-slate-200"
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-7 rounded-[30px] bg-slate-50 p-3 ring-2 ring-slate-200 focus-within:bg-white focus-within:ring-violet-500">
              <textarea
                value={intentText}
                onChange={(event) => setIntentText(event.target.value)}
                placeholder={placeholder}
                rows={5}
                className="min-h-36 w-full resize-none bg-transparent px-2 py-2 text-2xl font-black leading-tight text-slate-950 outline-none placeholder:text-slate-400"
              />
              {speech.interimTranscript ? (
                <p className="px-2 pb-2 text-base font-black text-slate-400">Listening: {speech.interimTranscript}</p>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <p className="text-xs font-black uppercase text-slate-500">
                  {speech.available ? (speech.listening ? "Listening..." : "Voice optional") : "Voice unavailable here"}
                </p>
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!speech.available}
                  title={speech.available ? "Use voice input" : "Voice input not supported on this browser. Type your topic instead."}
                  className={cn(
                    "grid size-14 place-items-center rounded-full text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                    speech.listening ? "bg-gradient-to-r from-rose-500 to-red-500" : "bg-gradient-to-r from-cyan-500 to-blue-600"
                  )}
                  aria-label={speech.listening ? "Stop listening" : "Start voice input"}
                >
                  {speech.listening ? <Square className="size-6" /> : <Mic className="size-7" />}
                </button>
              </div>
            </div>
            <div className="mt-5 rounded-[24px] bg-violet-50 px-4 py-4">
              <p className="text-xs font-black uppercase text-violet-700">Live preview</p>
              <p className="mt-1 text-xl font-black text-slate-950">{parsedIntent.arenaName}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{parsedIntent.summary}</p>
            </div>
            <Button
              onClick={detectArena}
              disabled={!intentText.trim()}
              className="mt-7 w-full !min-h-16 !rounded-[28px] !text-xl"
              icon={<Sparkles className="size-6" />}
            >
              Find my arena
            </Button>
          </Panel>
        ) : null}

        {step === "confirm" ? (
          <Panel className="mt-auto">
            <p className="text-sm font-black uppercase text-violet-700">Private sprint</p>
            <div className="mt-4 rounded-[32px] bg-gradient-to-br from-violet-600 to-blue-600 p-6 text-white shadow-2xl shadow-violet-200">
              <Radio className="size-10" />
              <h1 className="mt-4 text-4xl font-black leading-tight">{parsedIntent.arenaName}</h1>
              <p className="mt-3 text-lg font-bold text-blue-100">Your private quiz will sync into the live arena.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {parsedIntent.topics.map((topic) => (
                <span key={topic} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                  {topic}
                </span>
              ))}
            </div>
            {enterError ? (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                <p>{enterError}</p>
                <p className="mt-1 text-xs font-black uppercase text-amber-700">Your profile was not corrupted. Retry safely.</p>
              </div>
            ) : null}
            <div className="mt-7 grid grid-cols-[0.42fr_0.58fr] gap-3">
              <Button onClick={() => setStep("intent")} variant="secondary" icon={<Pencil className="size-5" />}>
                Edit
              </Button>
              <Button onClick={enterArena} disabled={enterLoading} icon={<Check className="size-5" />}>
                {enterLoading ? (enterRetrying ? "Retrying Sync" : "Syncing") : "Enter Race"}
              </Button>
            </div>
          </Panel>
        ) : null}

        <div className="mt-auto" />
      </PhoneShell>
    );
  }

  if (session?.status === "finished" || session?.status === "replay") {
    return (
      <PhoneShell>
        <div className="flex items-center justify-between gap-3">
          <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
          <SoundToggle />
        </div>
        <Panel className="mt-auto text-center">
          <div className="mx-auto grid size-28 place-items-center rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-6xl shadow-xl shadow-amber-100">
            {participant.avatar}
          </div>
          <p className="mt-6 text-sm font-black uppercase text-violet-700">Personal result</p>
          <h1 className="mt-2 text-5xl font-black text-slate-950">You placed #{finalResult?.finalRank ?? score?.currentRank ?? "-"}</h1>
          <p className="mt-2 text-xl font-black text-slate-600">{(finalResult?.totalScore ?? score?.totalScore ?? 0).toLocaleString()} points</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <ResultStat label="Correct" value={`${finalResult?.correctCount ?? score?.correctCount ?? 0}/${finalResult?.questionCount ?? QUESTION_COUNT}`} />
            <ResultStat
              label="Total time"
              value={`${(
                (finalResult?.totalAnswerResponseMs ??
                  finalResult?.totalOfficialResponseMs ??
                  finalResult?.totalResponseMs ??
                  score?.totalAnswerResponseMs ??
                  score?.totalOfficialResponseMs ??
                  score?.totalResponseMs ??
                  0) / 1000
              ).toFixed(2)}s`}
            />
            <ResultStat
              label="Fastest"
              value={`${((finalResult?.fastestOfficialResponseMs ?? finalResult?.fastestResponseMs ?? score?.fastestOfficialResponseMs ?? score?.fastestResponseMs ?? 0) / 1000).toFixed(2)}s`}
            />
            <ResultStat label="Room" value={`Top ${finalResult?.percentile ?? percentile(score?.currentRank ?? totalPlayers, totalPlayers)}%`} />
          </div>
          <Button onClick={shareScore} disabled={sharing} className="mt-7 w-full" icon={<Share2 className="size-5" />}>
            {sharing ? "Creating Link" : "Share Score"}
          </Button>
          {shareMessage ? <p className="mt-4 break-all rounded-[22px] bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800">{shareMessage}</p> : null}
          {shareError ? <ErrorMessage>{shareError}</ErrorMessage> : null}
        </Panel>
        <div className="mt-auto" />
      </PhoneShell>
    );
  }

  if (participant.admissionStatus !== "admitted") {
    const ticket = state.admissionTickets.find((candidate) => candidate.participantId === participant.participantId);
    return (
      <PhoneShell>
        <div className="flex items-center justify-between gap-3">
          <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
          <SoundToggle />
        </div>
        <Panel className="mt-auto text-center">
          <div className="mx-auto grid size-24 place-items-center rounded-full bg-slate-100 text-5xl">{participant.avatar}</div>
          <p className="mt-6 text-sm font-black uppercase text-violet-700">Arena capacity</p>
          <h1 className="mt-2 text-4xl font-black leading-tight text-slate-950">
            {participant.admissionStatus === "waitlisted" ? "You are in the spectator queue" : "This sprint is full"}
          </h1>
          <p className="mt-3 text-base font-bold text-slate-500">
            The current deployment admits {session?.maxRacers ?? 12} realtime racers to protect answer latency and final result speed.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <ResultStat label="Status" value={participant.admissionStatus} />
            <ResultStat label="Queue" value={ticket?.queuePosition ? `#${ticket.queuePosition}` : "watching"} />
          </div>
        </Panel>
        <div className="mt-auto" />
      </PhoneShell>
    );
  }

  if (session?.status === "playing" && round && question) {
    const startsInMs = Math.max(0, round.startsAt - now);
    const roundStarted = startsInMs <= 0;
    const roundEnded = now > round.endsAt;
    const timeRemainingMs = Math.max(0, round.endsAt - Math.max(now, round.startsAt));
    return (
      <PhoneShell>
        <div className="flex items-center justify-between gap-3">
          <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
          <SoundToggle />
        </div>
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black uppercase text-violet-700">Question {round.orderIndex} / {QUESTION_COUNT}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">Rank #{score?.currentRank ?? "-"} · {score?.totalScore.toLocaleString() ?? 0} pts</p>
            </div>
            <div className="grid size-16 place-items-center rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-2xl font-black text-white">
              {roundStarted ? Math.ceil(timeRemainingMs / 1000) : <Clock3 className="size-7" />}
            </div>
          </div>
          {!roundStarted ? (
            <p className="mt-5 rounded-[20px] bg-amber-50 px-4 py-3 text-center text-sm font-black text-amber-800">
              Starts in {(startsInMs / 1000).toFixed(1)}s
            </p>
          ) : null}
          <h1 className="mt-6 text-3xl font-black leading-tight text-slate-950">{question.questionText}</h1>
          <div className="mt-6 grid gap-3">
            {options.map(([key, text]) => (
              <AnswerButton
                key={key}
                optionKey={key}
                text={text}
                state={answer ? (round.status === "resolved" ? (answer.isCorrect ? "correct" : "wrong") : "locked") : "idle"}
                onClick={() => void submitLockedAnswer(key)}
                disabled={!roundStarted || roundEnded || Boolean(answer)}
              />
            ))}
          </div>
          {answer ? (
            <p className="mt-5 rounded-[20px] bg-violet-50 px-4 py-3 text-center text-sm font-black text-violet-800">
              Locked in · Official response {(answer.officialResponseMs / 1000).toFixed(2)}s
            </p>
          ) : null}
          {answerError && !answer ? <ErrorMessage>{answerError}</ErrorMessage> : null}
          {answering ? <p className="mt-4 text-center text-sm font-black text-slate-500">Sending to reducer...</p> : null}
        </Panel>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div className="flex items-center justify-between gap-3">
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
        <SoundToggle />
      </div>
      <Panel className="mt-auto">
        <p className="text-sm font-black uppercase text-violet-700">You're in, {participant.displayName}</p>
        <h1 className="mt-2 text-4xl font-black leading-tight text-slate-950">
          {packReady ? "Your sprint is ready" : "Building your sprint"}
        </h1>
        <p className="mt-3 text-base font-bold text-slate-500">
          You are racing in <span className="font-black text-slate-950">{arenaLabel}</span>. The phone only renders quiz cards after SpacetimeDB stores the pack.
        </p>
        <div className="mt-6">
          <LiveAgentBuildPipeline
            participant={participant}
            playerIntent={playerIntent}
            questionPack={participantPack}
            questionCount={QUESTION_COUNT}
            questionsReady={questionsReady}
            packSource={packSource}
            agentEvents={agentEvents}
            liveStats={state.liveStats.find((candidate) => candidate.sessionId === sessionId)}
            connectionState={connectionState}
          />
        </div>
        <div className="mt-5 rounded-[24px] bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase text-slate-500">Status</p>
          <p className="mt-1 text-lg font-black text-slate-950">
            {packReady ? "Quiz ready · waiting for presenter countdown" : "Research Agent still building your sprint..."}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {packReady ? "Watch the projector for the start signal." : "Cached topics usually complete in 2-3 seconds; long-tail topics may use Firecrawl/LLM or fallback."}
          </p>
        </div>
      </Panel>
      <div className="mt-auto" />
    </PhoneShell>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{children}</p>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function friendlyEnterError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/in progress|already live|playing/i.test(raw)) return "This sprint already started. Watch this one live and join the next sprint.";
  if (/not found|join/i.test(raw)) return "Still syncing your arena. Tap Retry if this takes more than a few seconds.";
  if (/timed out|timeout/i.test(raw)) return "Realtime sync is taking longer than expected. Tap Retry.";
  return "Still syncing your arena. Tap Retry if this takes more than a few seconds.";
}

async function recordEnterArenaError(
  callReducer: <T = unknown>(name: string, args: unknown, identity?: string) => Promise<{ ok: boolean; data?: T; error?: string }>,
  input: { sessionId: string; participantId: string | null; message: string; rawError: string }
): Promise<void> {
  try {
    await callReducer(
      "record_client_error",
      {
        sessionId: input.sessionId,
        participantId: input.participantId,
        screen: "phone_enter_arena",
        errorCode: "enter_arena_commit_failed",
        message: input.message,
        stackHash: `enter_${Math.abs(hashString(input.rawError)).toString(36)}`,
        metadataJson: JSON.stringify({ rawError: input.rawError, path: window.location.pathname }),
        userAgent: window.navigator.userAgent
      },
      getDeviceIdentity()
    );
  } catch {
    // Best-effort diagnostics only; the recovery UI above remains the source of truth.
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function waitForShareCard(
  shareCardsRef: React.MutableRefObject<ShareCard[]>,
  sessionId: string,
  participantId: string | null,
  timeoutMs = 3500
): Promise<ShareCard | undefined> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const poll = () => {
      const card = shareCardsRef.current.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
      if (card || Date.now() - startedAt >= timeoutMs) {
        resolve(card);
        return;
      }
      window.setTimeout(poll, 100);
    };
    poll();
  });
}

function packSourceLabel(
  generatedBy?: string,
  fairnessStatus?: string,
  sourceUrl?: string | null,
  sourceType?: string,
  intentStatus?: string,
  sessionStatus?: string
): string {
  if (sourceType === "seed_fallback") return "Instant pack";
  if (sourceType === "template_grounded") return "Grounded web";
  if (sourceType === "grounded_llm") return "AI custom";
  if (sourceType === "exact_cache" || sourceType === "semantic_cache" || sourceType === "cache") return "Cached pack";
  if (intentStatus === "pack_ready") return "Instant pack";
  if (sessionStatus === "ready" || sessionStatus === "playing") return "Instant pack";
  if (!generatedBy) return "Preparing";
  if (sourceUrl) return "Grounded web";
  if (fairnessStatus === "fallback") return "Instant pack";
  if (/quiz builder/i.test(generatedBy)) return "AI custom";
  return generatedBy;
}
