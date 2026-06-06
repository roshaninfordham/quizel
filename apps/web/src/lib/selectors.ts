import type { Answer, Match, Participant, QuizDuelState, Round, Score } from "@quizduel/shared";

export function getParticipant(state: QuizDuelState, participantId?: string | null): Participant | undefined {
  if (!participantId) return undefined;
  return state.participants.find((participant) => participant.participantId === participantId);
}

export function getPlayerParticipants(state: QuizDuelState, match?: Match): Participant[] {
  if (!match) return [];
  return [match.player1Id, match.player2Id]
    .map((participantId) => state.participants.find((participant) => participant.participantId === participantId))
    .filter((participant): participant is Participant => Boolean(participant));
}

export function getCurrentQuestion(state: QuizDuelState, round?: Round) {
  if (!round) return undefined;
  return state.questions.find((question) => question.questionId === round.questionId);
}

export function getAnswerForParticipant(state: QuizDuelState, roundId?: string, participantId?: string): Answer | undefined {
  if (!roundId || !participantId) return undefined;
  return state.answers.find((answer) => answer.roundId === roundId && answer.participantId === participantId);
}

export function getScore(state: QuizDuelState, matchId?: string, participantId?: string): Score | undefined {
  if (!matchId || !participantId) return undefined;
  return state.scores.find((score) => score.matchId === matchId && score.participantId === participantId);
}

export function getPlayerLeaderboard(state: QuizDuelState, match?: Match): Array<{ participant: Participant; score: Score }> {
  if (!match) return [];
  const playerIds = new Set([match.player1Id, match.player2Id]);
  return state.scores
    .filter((score) => score.matchId === match.matchId && playerIds.has(score.participantId))
    .map((score) => ({
      score,
      participant: state.participants.find((participant) => participant.participantId === score.participantId)
    }))
    .filter((entry): entry is { participant: Participant; score: Score } => Boolean(entry.participant))
    .sort((a, b) => b.score.playerScore - a.score.playerScore);
}

export function getCrowdLeaderboard(state: QuizDuelState, match?: Match): Array<{ participant: Participant; score: Score }> {
  if (!match) return [];
  return state.scores
    .filter((score) => score.matchId === match.matchId)
    .map((score) => ({
      score,
      participant: state.participants.find((participant) => participant.participantId === score.participantId)
    }))
    .filter(
      (entry): entry is { participant: Participant; score: Score } =>
        entry.participant !== undefined && entry.participant.roleAssigned === "crowd"
    )
    .sort((a, b) => {
      if (b.score.supporterXp !== a.score.supporterXp) return b.score.supporterXp - a.score.supporterXp;
      const aAccuracy = a.score.supportAccuracyDen === 0 ? 0 : a.score.supportAccuracyNum / a.score.supportAccuracyDen;
      const bAccuracy = b.score.supportAccuracyDen === 0 ? 0 : b.score.supportAccuracyNum / b.score.supportAccuracyDen;
      return bAccuracy - aAccuracy;
    });
}

export function latestRoundForMatch(state: QuizDuelState, match?: Match): Round | undefined {
  if (!match) return undefined;
  return state.rounds
    .filter((round) => round.matchId === match.matchId)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];
}
