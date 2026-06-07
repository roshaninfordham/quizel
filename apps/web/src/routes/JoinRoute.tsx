import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, Mic, Pencil, Radio, Share2, Sparkles, Square } from "lucide-react";
import {
  AVATAR_CHOICES,
  DEFAULT_SESSION_CODE,
  INTENT_PLACEHOLDERS,
  QUESTION_COUNT,
  type OptionKey,
  type ShareCard,
  percentile
} from "@quizrush/shared";
import { AnswerButton, Button, ConnectionBadge, Panel, PhoneShell, ReconnectingOverlay, SoundToggle, cn } from "../components/ui";
import { useSpeechIntent } from "../hooks/useSpeechIntent";
import { useCreateShareCard, useJoinTournament, useRequestQuestions, useSubmitAnswer, useSubmitPlayerIntent, useSubmitTopicVote } from "../hooks/useArenaActions";
import {
  getJoinedParticipantId,
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
  const questionRenderedAtRef = useRef<number | null>(null);
  const renderedRoundIdRef = useRef<string | null>(null);
  const shareCardsRef = useRef(state.shareCards);
  const placeholder = useMemo(() => INTENT_PLACEHOLDERS[Math.floor(Math.random() * INTENT_PLACEHOLDERS.length)] ?? "AI agents, databases, and startups", []);
  const parsedIntent = useMemo(() => parseIntentPreview(intentText), [intentText]);
  const participant = state.participants.find((candidate) => candidate.participantId === participantId);
  const round = useCurrentRound(sessionId);
  const question = useCurrentQuestion(sessionId);
  const score = getScore(state, sessionId, participantId);
  const finalResult = state.finalResults.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
  const shareCard = state.shareCards.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
  const answer = getAnswerForParticipant(state, round?.roundId, participantId ?? undefined);
  const totalPlayers = state.participants.filter((candidate) => candidate.sessionId === sessionId).length;
  const joinedVotes = state.topicVotes.filter((vote) => vote.participantId === participantId).map((vote) => vote.topic);
  const sessionQuestions = state.questions.filter((candidate) => candidate.sessionId === sessionId);
  const questionsReady = sessionQuestions.length >= QUESTION_COUNT;
  const arenaLabel = joinedVotes.length ? joinedVotes.map((topic) => topic.replace(/\s+(Systems|Strategy|Technology)$/i, "")).join(" x ") : session?.selectedTopic ?? parsedIntent.arenaName;
  const packSource = packSourceLabel(sessionQuestions[0]?.generatedBy, sessionQuestions[0]?.fairnessStatus, sessionQuestions[0]?.sourceUrl);

  const { joinTournament, loading: joining, error: joinError } = useJoinTournament(code);
  const { submitTopicVote, loading: voting, message: voteMessage, error: voteError } = useSubmitTopicVote();
  const { submitPlayerIntent, loading: submittingIntent, error: intentError } = useSubmitPlayerIntent();
  const { requestQuestions, loading: requesting, error: requestError } = useRequestQuestions();
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
    const result = await joinTournament({ displayName: displayName.trim() || "Player", avatar });
    if (result?.participant.participantId) {
      setParticipantId(result.participant.participantId);
      if ((result.participant as { admissionStatus?: string }).admissionStatus && (result.participant as { admissionStatus?: string }).admissionStatus !== "admitted") {
        return;
      }
      await submitPlayerIntent(sessionId, intentText, speech.finalTranscript ? "speech" : "typed");
      await submitTopicVote(sessionId, parsedIntent.topics);
      await requestQuestions(sessionId, parsedIntent.arenaName);
      playArenaAssigned();
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
            {joinError ? <ErrorMessage>{joinError}</ErrorMessage> : null}
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
            <p className="text-sm font-black uppercase text-violet-700">Detected arena</p>
            <div className="mt-4 rounded-[32px] bg-gradient-to-br from-violet-600 to-blue-600 p-6 text-white shadow-2xl shadow-violet-200">
              <Radio className="size-10" />
              <h1 className="mt-4 text-4xl font-black leading-tight">{parsedIntent.arenaName}</h1>
              <p className="mt-3 text-lg font-bold text-blue-100">{parsedIntent.summary}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <IntentStat label="Skill level" value={parsedIntent.difficulty} />
              <IntentStat label="Confidence" value={`${Math.round(parsedIntent.confidence * 100)}%`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {parsedIntent.topics.map((topic) => (
                <span key={topic} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                  {topic}
                </span>
              ))}
            </div>
            {joinError || intentError || voteError || requestError ? <ErrorMessage>{joinError || intentError || voteError || requestError}</ErrorMessage> : null}
            <div className="mt-7 grid grid-cols-[0.42fr_0.58fr] gap-3">
              <Button onClick={() => setStep("intent")} variant="secondary" icon={<Pencil className="size-5" />}>
                Edit
              </Button>
              <Button onClick={enterArena} disabled={joining || submittingIntent || voting || requesting} icon={<Check className="size-5" />}>
                {requesting || submittingIntent ? "Starting Agent" : "Enter Arena"}
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
          {session?.status === "generating" || session?.status === "ready" ? "AI is building the sprint" : "Arena is forming"}
        </h1>
        <p className="mt-3 text-base font-bold text-slate-500">
          You are racing in <span className="font-black text-slate-950">{arenaLabel}</span>.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <WaitingStat label="Your arena" value={arenaLabel} />
          <WaitingStat label="Global racers" value={String(totalPlayers)} />
          <WaitingStat label="Phase" value={(session?.status ?? "lobby").replace("_", " ")} />
          <WaitingStat label="Pack" value={packSource} />
        </div>
        <div className="mt-6 rounded-[26px] bg-gradient-to-r from-violet-50 to-cyan-50 p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="size-6 text-violet-700" />
            <p className="text-base font-black text-slate-950">
              {questionsReady ? "Sprint ready. Watch the projector countdown." : voteMessage ? "Expertise synced. Building instant pack..." : "AI is clustering live room intent."}
            </p>
          </div>
          <div className="mt-4 grid gap-2">
            <ProgressStep complete label="Intent captured" />
            <ProgressStep complete={Boolean(session?.selectedTopic || joinedVotes.length)} label={`Arena detected${arenaLabel ? `: ${arenaLabel}` : ""}`} />
            <ProgressStep complete={questionsReady} label={questionsReady ? `Quiz pack ready (${packSource})` : "Grounding facts and building pack"} />
            <ProgressStep complete={session?.status === "playing"} label={session?.status === "playing" ? "Race live" : "Starting when presenter presses S"} />
          </div>
        </div>
      </Panel>
      <div className="mt-auto" />
    </PhoneShell>
  );
}

function IntentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function WaitingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ProgressStep({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2">
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-black", complete ? "bg-emerald-500 text-white" : "bg-white text-slate-400 ring-2 ring-slate-200")}>
        {complete ? <Check className="size-4" /> : ""}
      </span>
      <span className={cn("text-sm font-black", complete ? "text-slate-950" : "text-slate-500")}>{label}</span>
    </div>
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

function packSourceLabel(generatedBy?: string, fairnessStatus?: string, sourceUrl?: string | null): string {
  if (!generatedBy) return "Preparing";
  if (sourceUrl) return "Grounded web";
  if (fairnessStatus === "fallback") return "Instant pack";
  if (/quiz builder/i.test(generatedBy)) return "AI custom";
  return generatedBy;
}
