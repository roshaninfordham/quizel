import { Heart, Trophy, Users, Zap } from "lucide-react";
import { DEFAULT_SESSION_ID, type OptionKey } from "@quizduel/shared";
import { useCheerPlayer, usePlayAlongAnswer } from "../hooks/useArenaActions";
import { getCurrentQuestion, getCrowdLeaderboard, getParticipant, getScore } from "../lib/selectors";
import {
  getDeviceIdentity,
  getJoinedParticipantId,
  useCurrentMatch,
  useCurrentRound,
  useEnergyBalance,
  useSpacetime,
  useSupportTotals
} from "../lib/spacetime/client";
import {
  AnswerButton,
  Button,
  CheerButton,
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

export function CrowdPhone({ sessionId = DEFAULT_SESSION_ID }: { sessionId?: string }) {
  const { state, connectionState, lastSyncAt } = useSpacetime();
  const match = useCurrentMatch(sessionId);
  const round = useCurrentRound(match?.matchId);
  const question = getCurrentQuestion(state, round);
  const participant =
    getParticipant(state, getJoinedParticipantId()) ?? state.participants.find((candidate) => candidate.identity === getDeviceIdentity());
  const balance = useEnergyBalance(participant?.participantId);
  const cheer = useCheerPlayer();
  const playAlong = usePlayAlongAnswer();
  const supportTotals = useSupportTotals(round?.roundId);
  const player1 = getParticipant(state, match?.player1Id);
  const player2 = getParticipant(state, match?.player2Id);
  const ownPlayAlong = state.playAlongAnswers.find(
    (answer) => answer.roundId === round?.roundId && answer.supporterId === participant?.participantId
  );
  const ownSupport = state.supportEvents.filter(
    (event) => event.roundId === round?.roundId && event.supporterId === participant?.participantId
  );
  const score = getScore(state, match?.matchId, participant?.participantId);
  const crowdRank = getCrowdLeaderboard(state, match).findIndex((entry) => entry.participant.participantId === participant?.participantId) + 1;

  if (!participant || participant.roleAssigned !== "crowd") {
    return (
      <PhoneShell>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <IconPill tone="aqua">
            <Users className="size-4" /> Crowd
          </IconPill>
          <h1 className="mt-3 text-3xl font-black text-slate-950">Join the Crowd</h1>
          <p className="mt-2 text-base font-bold text-slate-600">Join from the QR screen to cheer with Energy and play along.</p>
          <a href="/join/ARENA-42">
            <Button className="mt-5 w-full" icon={<Zap className="size-5" />}>
              Join Arena
            </Button>
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

  return (
    <PhoneShell>
      <div className="flex items-center justify-between gap-3">
        <IconPill tone="aqua">
          <Users className="size-4" /> Crowd
        </IconPill>
        <ConnectionBadge state={connectionState} lastSyncAt={lastSyncAt} />
      </div>
      <ReconnectingBanner state={connectionState} />
      <ErrorState message={cheer.error ?? playAlong.error} />

      <EnergyMeter energy={balance?.spendableEnergy ?? 0} />

      {!round || !match ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">Waiting for the next question</h1>
          <p className="mt-2 text-base font-bold text-slate-600">Stay on this screen. Energy is ready when the round opens.</p>
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
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
                  selected={ownPlayAlong?.selectedOption === label}
                  correct={round.status === "resolved" && question?.correctOption === label}
                  wrong={round.status === "resolved" && ownPlayAlong?.selectedOption === label && question?.correctOption !== label}
                  disabled={Boolean(ownPlayAlong) || round.status !== "active" || playAlong.loading}
                  onClick={() => playAlong.submitPlayalongAnswer(round.roundId, label)}
                />
              ))}
            </div>
            {ownPlayAlong ? (
              <p className="mt-4 rounded-lg bg-cyan-50 px-4 py-3 text-center text-sm font-black text-cyan-700">
                Play-along locked: {ownPlayAlong.selectedOption}
              </p>
            ) : null}
          </section>

          <div className="grid gap-3">
            <PlayerCard participant={player1} score={getScore(state, match.matchId, player1?.participantId)} support={supportTotals[match.player1Id] ?? 0} side="Player 1" />
            <CheerButton
              playerName={player1?.displayName ?? "Player 1"}
              disabled={round.status !== "active" || cheer.loading || (balance?.spendableEnergy ?? 0) < 25}
              onClick={() => cheer.cheerPlayer(round.roundId, match.player1Id)}
            />
            <PlayerCard participant={player2} score={getScore(state, match.matchId, player2?.participantId)} support={supportTotals[match.player2Id] ?? 0} side="Player 2" />
            <CheerButton
              playerName={player2?.displayName ?? "Player 2"}
              disabled={round.status !== "active" || cheer.loading || (balance?.spendableEnergy ?? 0) < 25}
              onClick={() => cheer.cheerPlayer(round.roundId, match.player2Id)}
            />
          </div>

          <SupportBar
            leftLabel={player1?.displayName ?? "Player 1"}
            rightLabel={player2?.displayName ?? "Player 2"}
            leftValue={supportTotals[match.player1Id] ?? 0}
            rightValue={supportTotals[match.player2Id] ?? 0}
          />
        </>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <TrustXPBadge xp={balance?.trustXp ?? score?.supporterXp ?? 0} />
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-2 text-sm font-black text-amber-700">
            <Trophy className="size-4" /> Rank {crowdRank > 0 ? crowdRank : "—"}
          </span>
        </div>
        <p className="mt-3 text-sm font-bold text-slate-500">
          {ownSupport.length > 0 ? `${ownSupport.length} Cheer event${ownSupport.length === 1 ? "" : "s"} this round.` : "Cheer is positive only. No minus buttons."}
        </p>
      </section>
    </PhoneShell>
  );
}
