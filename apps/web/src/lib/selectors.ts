import type { Answer, MatchEvent, Participant, QuizRushState, Round, Score } from "@quizrush/shared";

export function getParticipant(state: QuizRushState, participantId?: string | null): Participant | undefined {
  if (!participantId) return undefined;
  return state.participants.find((participant) => participant.participantId === participantId);
}

export function getScore(state: QuizRushState, sessionId: string, participantId?: string | null): Score | undefined {
  if (!participantId) return undefined;
  return state.scores.find((score) => score.sessionId === sessionId && score.participantId === participantId);
}

export function getCurrentQuestion(state: QuizRushState, round?: Round) {
  if (!round) return undefined;
  return state.questions.find((question) => question.questionId === round.questionId);
}

export function getAnswerForParticipant(state: QuizRushState, roundId?: string, participantId?: string): Answer | undefined {
  if (!roundId || !participantId) return undefined;
  return state.answers.find((answer) => answer.roundId === roundId && answer.participantId === participantId);
}

export function getLeaderboard(state: QuizRushState, sessionId: string): Array<{ participant: Participant; score: Score }> {
  return state.scores
    .filter((score) => score.sessionId === sessionId)
    .map((score) => ({
      score,
      participant: state.participants.find((participant) => participant.participantId === score.participantId)
    }))
    .filter((entry): entry is { participant: Participant; score: Score } => Boolean(entry.participant))
    .sort((a, b) => a.score.currentRank - b.score.currentRank);
}

export function topicCounts(state: QuizRushState, sessionId: string): Array<{ topic: string; count: number; percent: number }> {
  const votes = state.topicVotes.filter((vote) => vote.sessionId === sessionId);
  const counts = new Map<string, number>();
  for (const vote of votes) counts.set(vote.topic, (counts.get(vote.topic) ?? 0) + 1);
  const total = Math.max(1, votes.length);
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

export function latestEvents(events: MatchEvent[], count = 8): MatchEvent[] {
  return events.slice(-count).reverse();
}
