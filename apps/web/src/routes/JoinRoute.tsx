import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Mic, Pencil, Radio, Sparkles, Square, Trophy } from "lucide-react";
import {
  AVATAR_CHOICES,
  DEFAULT_SESSION_CODE,
  INTENT_PLACEHOLDERS,
  QUESTION_COUNT,
  type OptionKey,
  percentile
} from "@quizrush/shared";
import { AnswerButton, Button, ConnectionBadge, Panel, PhoneShell, ReconnectingOverlay, SoundToggle, cn } from "../components/ui";
import { useSpeechIntent } from "../hooks/useSpeechIntent";
import { useJoinTournament, useSubmitAnswer, useSubmitTopicVote } from "../hooks/useArenaActions";
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
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const session = useSessionByCode(code);
  const sessionId = session?.sessionId ?? "session-demo";
  const [participantId, setParticipantId] = useState(() => getJoinedParticipantId(code));
  const participant = state.participants.find((candidate) => candidate.participantId === participantId);
  const round = useCurrentRound(sessionId);
  const question = useCurrentQuestion(sessionId);
  const score = getScore(state, sessionId, participantId);
  const answer = getAnswerForParticipant(state, round?.roundId, participantId ?? undefined);
  const totalPlayers = state.participants.filter((candidate) => candidate.sessionId === sessionId).length;
  const joinedVotes = state.topicVotes.filter((vote) => vote.participantId === participantId).map((vote) => vote.topic);

  const [step, setStep] = useState<JoinStep>("profile");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_CHOICES[0] ?? "🚀");
  const [intentText, setIntentText] = useState("");
  const [now, setNow] = useState(Date.now());
  const [lastAnswerState, setLastAnswerState] = useState<"correct" | "wrong" | null>(null);
  const placeholder = useMemo(() => INTENT_PLACEHOLDERS[Math.floor(Math.random() * INTENT_PLACEHOLDERS.length)] ?? "AI agents, databases, and startups", []);
  const parsedIntent = useMemo(() => parseIntentPreview(intentText), [intentText]);
  const { joinTournament, loading: joining, error: joinError } = useJoinTournament(code);
  const { submitTopicVote, loading: voting, message: voteMessage, error: voteError } = useSubmitTopicVote();
  const { submitAnswer, loading: answering, error: answerError } = useSubmitAnswer();
  const speech = useSpeechIntent((value) => {
    setIntentText((current) => (current ? `${current} ${value}` : value));
  });

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
      await submitTopicVote(sessionId, parsedIntent.topics);
      playArenaAssigned();
    }
  };

  const submitLockedAnswer = async (key: OptionKey) => {
    if (!round) return;
    playAnswerLock();
    await submitAnswer(round.roundId, key);
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
            {joinError || voteError ? <ErrorMessage>{joinError || voteError}</ErrorMessage> : null}
            <div className="mt-7 grid grid-cols-[0.42fr_0.58fr] gap-3">
              <Button onClick={() => setStep("intent")} variant="secondary" icon={<Pencil className="size-5" />}>
                Edit
              </Button>
              <Button onClick={enterArena} disabled={joining || voting} icon={<Check className="size-5" />}>
                Enter Arena
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
          <h1 className="mt-2 text-5xl font-black text-slate-950">You placed #{score?.currentRank ?? "-"}</h1>
          <p className="mt-2 text-xl font-black text-slate-600">{score?.totalScore.toLocaleString() ?? 0} points</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <ResultStat label="Correct" value={`${score?.correctCount ?? 0}/${QUESTION_COUNT}`} />
            <ResultStat label="Fastest" value={`${((score?.fastestResponseMs ?? 0) / 1000).toFixed(2)}s`} />
            <ResultStat label="Room" value={`Top ${percentile(score?.currentRank ?? totalPlayers, totalPlayers)}%`} />
            <ResultStat label="Arena" value={joinedVotes[0] ?? session.selectedTopic ?? "Live"} />
          </div>
          <p className="mt-6 rounded-[22px] bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800">
            Watch the projector replay. It is rebuilt from the MatchEvent ledger.
          </p>
        </Panel>
        <div className="mt-auto" />
      </PhoneShell>
    );
  }

  if (session?.status === "playing" && round && question) {
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
              {Math.ceil(Math.max(0, round.endsAt - now) / 1000)}
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-black leading-tight text-slate-950">{question.questionText}</h1>
          <div className="mt-6 grid gap-3">
            {options.map(([key, text]) => (
              <AnswerButton
                key={key}
                optionKey={key}
                text={text}
                state={answer ? (round.status === "resolved" ? (answer.isCorrect ? "correct" : "wrong") : "locked") : "idle"}
                onClick={() => void submitLockedAnswer(key)}
              />
            ))}
          </div>
          {answer ? (
            <p className="mt-5 rounded-[20px] bg-violet-50 px-4 py-3 text-center text-sm font-black text-violet-800">
              Locked in · Server received {(answer.responseMs / 1000).toFixed(2)}s
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
          You are racing in <span className="font-black text-slate-950">{joinedVotes.length ? joinedVotes.join(" x ") : session?.selectedTopic ?? "the live arena"}</span>.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <WaitingStat label="Your arena" value={joinedVotes[0] ?? "Live"} />
          <WaitingStat label="Global racers" value={String(totalPlayers)} />
          <WaitingStat label="Phase" value={(session?.status ?? "lobby").replace("_", " ")} />
          <WaitingStat label="Questions" value={String(QUESTION_COUNT)} />
        </div>
        <div className="mt-6 rounded-[26px] bg-gradient-to-r from-violet-50 to-cyan-50 p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="size-6 text-violet-700" />
            <p className="text-base font-black text-slate-950">
              {voteMessage ? "Expertise synced. Watch the projector." : "AI is clustering live room intent."}
            </p>
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
