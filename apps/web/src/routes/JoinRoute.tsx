import { useEffect, useMemo, useState } from "react";
import { AVATAR_CHOICES, DEFAULT_SESSION_CODE, DEFAULT_TOPICS, QUESTION_COUNT, type OptionKey, percentile } from "@quizrush/shared";
import { AnswerButton, Button, ConnectionBadge, Panel, PhoneShell, ReconnectingOverlay, cn } from "../components/ui";
import { useJoinTournament, useSubmitAnswer, useSubmitTopicVote } from "../hooks/useArenaActions";
import {
  getJoinedParticipantId,
  useCurrentQuestion,
  useCurrentRound,
  useSessionByCode,
  useSpacetime
} from "../lib/spacetime/client";
import { getAnswerForParticipant, getScore } from "../lib/selectors";

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

  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_CHOICES[0] ?? "🚀");
  const [topics, setTopics] = useState<string[]>(["AI"]);
  const [now, setNow] = useState(Date.now());
  const { joinTournament, loading: joining, error: joinError } = useJoinTournament(code);
  const { submitTopicVote, loading: voting, message: voteMessage } = useSubmitTopicVote();
  const { submitAnswer, loading: answering, error: answerError } = useSubmitAnswer();

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

  const join = async () => {
    const result = await joinTournament({ displayName: displayName.trim() || "Player", avatar });
    if (result?.participant.participantId) setParticipantId(result.participant.participantId);
  };

  const toggleTopic = (topic: string) => {
    setTopics((current) => {
      if (current.includes(topic)) return current.filter((candidate) => candidate !== topic);
      return [...current, topic].slice(0, 3);
    });
  };

  if (!participant) {
    return (
      <PhoneShell>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
        <ReconnectingOverlay state={connectionState} />
        <Panel className="mt-auto">
          <p className="text-sm font-black uppercase text-violet-700">QuizRush Live</p>
          <h1 className="mt-2 text-4xl font-black leading-tight text-slate-950">Join the 25-second tournament</h1>
          <label className="mt-8 block text-sm font-black uppercase text-slate-500">Your name</label>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Maya"
            className="mt-2 h-14 w-full rounded-[20px] border-2 border-slate-200 bg-white px-4 text-xl font-black outline-none focus:border-violet-500"
          />
          <p className="mt-6 text-sm font-black uppercase text-slate-500">Pick avatar</p>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {AVATAR_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setAvatar(choice)}
                className={cn(
                  "grid aspect-square place-items-center rounded-[22px] border-2 text-4xl transition active:scale-95",
                  avatar === choice ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white"
                )}
              >
                {choice}
              </button>
            ))}
          </div>
          {joinError ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{joinError}</p> : null}
          <Button onClick={join} disabled={joining} className="mt-7 w-full">
            Join Tournament
          </Button>
        </Panel>
        <div className="mt-auto" />
      </PhoneShell>
    );
  }

  if (session?.status === "finished" || session?.status === "replay") {
    return (
      <PhoneShell>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
        <Panel className="mt-auto text-center">
          <div className="mx-auto grid size-28 place-items-center rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-6xl shadow-xl shadow-amber-100">
            {participant.avatar}
          </div>
          <p className="mt-6 text-sm font-black uppercase text-violet-700">Final Result</p>
          <h1 className="mt-2 text-5xl font-black text-slate-950">#{score?.currentRank ?? "-"}</h1>
          <p className="mt-2 text-xl font-black text-slate-600">{score?.totalScore.toLocaleString() ?? 0} points</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <ResultStat label="Correct" value={`${score?.correctCount ?? 0}/${QUESTION_COUNT}`} />
            <ResultStat label="Fastest" value={`${((score?.fastestResponseMs ?? 0) / 1000).toFixed(2)}s`} />
            <ResultStat label="Room" value={`Top ${percentile(score?.currentRank ?? totalPlayers, totalPlayers)}%`} />
            <ResultStat label="Players" value={String(totalPlayers)} />
          </div>
        </Panel>
        <div className="mt-auto" />
      </PhoneShell>
    );
  }

  if (session?.status === "playing" && round && question) {
    return (
      <PhoneShell>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
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
          <h1 className="mt-6 text-2xl font-black leading-tight text-slate-950">{question.questionText}</h1>
          <div className="mt-6 grid gap-3">
            {options.map(([key, text]) => (
              <AnswerButton
                key={key}
                optionKey={key}
                text={text}
                state={answer ? (round.status === "resolved" ? (answer.isCorrect ? "correct" : "wrong") : "locked") : "idle"}
                onClick={() => void submitAnswer(round.roundId, key)}
              />
            ))}
          </div>
          {answer ? (
            <p className="mt-5 rounded-[20px] bg-violet-50 px-4 py-3 text-center text-sm font-black text-violet-800">
              Locked in · Server received {(answer.responseMs / 1000).toFixed(2)}s
            </p>
          ) : null}
          {answerError && !answer ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{answerError}</p> : null}
          {answering ? <p className="mt-4 text-center text-sm font-black text-slate-500">Sending to reducer...</p> : null}
        </Panel>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      <Panel className="mt-auto">
        <p className="text-sm font-black uppercase text-violet-700">Welcome, {participant.displayName}</p>
        <h1 className="mt-2 text-4xl font-black leading-tight text-slate-950">What do you want to compete in?</h1>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {DEFAULT_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => toggleTopic(topic)}
              className={cn(
                "min-h-14 rounded-[20px] border-2 px-4 text-lg font-black transition active:scale-95",
                topics.includes(topic) ? "border-violet-500 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-900"
              )}
            >
              {topic}
            </button>
          ))}
        </div>
        <Button onClick={() => void submitTopicVote(sessionId, topics.length ? topics : ["AI"])} disabled={voting} className="mt-7 w-full">
          Lock Topics
        </Button>
        <p className="mt-4 text-center text-sm font-bold text-slate-500">
          {voteMessage ? "Topics locked. Watch the projector." : "Match starts when the projector countdown ends."}
        </p>
      </Panel>
      <div className="mt-auto" />
    </PhoneShell>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
