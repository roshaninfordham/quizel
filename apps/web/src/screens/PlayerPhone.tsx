import { CheckCircle2, Crown, Hourglass, Trophy } from "lucide-react";
import { DEFAULT_SESSION_ID, type OptionKey } from "@quizduel/shared";
import { usePlayerReady, useSubmitAnswer } from "../hooks/useArenaActions";
import { getAnswerForParticipant, getCurrentQuestion, getParticipant, getScore } from "../lib/selectors";
import {
  getDeviceIdentity,
  getJoinedParticipantId,
  useCurrentMatch,
  useCurrentRound,
  useSpacetime,
  useSupportTotals
} from "../lib/spacetime/client";
import {
  AnswerButton,
  Button,
  ConnectionBadge,
  EnergyMeter,
  ErrorState,
  IconPill,
  PhoneShell,
  PlayerCard,
  ReconnectingBanner,
  SupportBar,
  TimerRing,
  TrustXPBadge
} from "../components/ui";

export function PlayerPhone({ sessionId = DEFAULT_SESSION_ID }: { sessionId?: string }) {
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const match = useCurrentMatch(sessionId);
  const round = useCurrentRound(match?.matchId);
  const question = getCurrentQuestion(state, round);
  const deviceParticipant =
    getParticipant(state, getJoinedParticipantId()) ?? state.participants.find((participant) => participant.identity === getDeviceIdentity());
  const participant =
    deviceParticipant && match && (deviceParticipant.participantId === match.player1Id || deviceParticipant.participantId === match.player2Id)
      ? deviceParticipant
      : match
        ? getParticipant(state, match.player1Id)
        : deviceParticipant;
  const answer = getAnswerForParticipant(state, round?.roundId, participant?.participantId);
  const score = getScore(state, match?.matchId, participant?.participantId);
  const supportTotals = useSupportTotals(round?.roundId);
  const ready = usePlayerReady();
  const submit = useSubmitAnswer();
  const player1 = getParticipant(state, match?.player1Id);
  const player2 = getParticipant(state, match?.player2Id);
  const leftSupport = match ? supportTotals[match.player1Id] ?? 0 : 0;
  const rightSupport = match ? supportTotals[match.player2Id] ?? 0 : 0;
  const totalSupport = Math.max(1, leftSupport + rightSupport);
  const ownSupport = participant?.participantId === match?.player1Id ? leftSupport : rightSupport;

  if (!match || !participant) {
    return (
      <PhoneShell>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <IconPill tone="mango">
            <Hourglass className="size-4" /> Waiting
          </IconPill>
          <h1 className="mt-3 text-3xl font-black text-slate-950">Champion selection is not ready</h1>
          <p className="mt-2 text-base font-bold text-slate-600">Join the arena first, then wait for the host to select two Champions.</p>
          <a href="/join/ARENA-42">
            <Button className="mt-5 w-full">Join Arena</Button>
          </a>
        </section>
      </PhoneShell>
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

  const isReady = participant.participantId === match.player1Id ? match.player1Ready : match.player2Ready;

  return (
    <PhoneShell>
      <div className="flex items-center justify-between gap-3">
        <IconPill tone="violet">
          <Crown className="size-4" /> Champion
        </IconPill>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </div>
      <ReconnectingBanner state={connectionState} />
      <ErrorState message={ready.error ?? submit.error} />

      <PlayerCard participant={participant} score={score} support={ownSupport} side="Your score" active />

      {!round || match.status === "waiting" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">{isReady ? "Ready and waiting" : "Tap ready"}</h1>
          <p className="mt-2 text-base font-bold text-slate-600">The host starts the match when both Champions are set.</p>
          <Button disabled={ready.loading || isReady} onClick={() => ready.playerReady(match.matchId)} className="mt-5 w-full" icon={<CheckCircle2 className="size-5" />}>
            {isReady ? "Ready Locked" : "I am Ready"}
          </Button>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold uppercase text-slate-500">Round {round.roundNumber}</p>
              <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950">{question?.questionText ?? "Question loading"}</h1>
            </div>
            <TimerRing startsAt={round.startsAt} endsAt={round.endsAt} status={round.status} />
          </div>
          <div className="mt-5 grid gap-3">
            {options.map(([label, text]) => (
              <AnswerButton
                key={label}
                label={label}
                text={text}
                selected={answer?.selectedOption === label}
                correct={round.status === "resolved" && question?.correctOption === label}
                wrong={round.status === "resolved" && answer?.selectedOption === label && question?.correctOption !== label}
                disabled={Boolean(answer) || round.status !== "active" || submit.loading}
                onClick={() => submit.submitAnswer(round.roundId, label)}
              />
            ))}
          </div>
          {answer ? (
            <p className="mt-4 rounded-lg bg-violet-50 px-4 py-3 text-center text-sm font-black text-violet-700">
              Locked in: {answer.selectedOption}
            </p>
          ) : null}
          {round.status === "resolved" ? (
            <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              Correct answer: {question?.correctOption}. {question?.explanation}
            </div>
          ) : null}
        </section>
      )}

      <SupportBar
        leftLabel={player1?.displayName ?? "Player 1"}
        rightLabel={player2?.displayName ?? "Player 2"}
        leftValue={leftSupport}
        rightValue={rightSupport}
      />
      <div className="grid grid-cols-2 gap-3">
        <TrustXPBadge xp={Math.round((ownSupport / totalSupport) * 100)} />
        <a href={`/arena/${sessionId}/final`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-amber-100 px-3 py-2 text-sm font-black text-amber-700">
          <Trophy className="size-4" /> Final
        </a>
      </div>
    </PhoneShell>
  );
}
