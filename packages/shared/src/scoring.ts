import { CORRECT_BASE_POINTS, MAX_SPEED_BONUS, QUESTION_TIME_LIMIT_MS, STREAK_BONUS } from "./constants";
import type { Score } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface AnswerScoreBreakdown {
  correctnessPoints: number;
  speedBonus: number;
  streakBonus: number;
  scoreDelta: number;
}

export function computeAnswerScoreBreakdown(input: {
  isCorrect: boolean;
  responseMs: number;
  previousAnswerWasCorrect?: boolean;
}): AnswerScoreBreakdown {
  if (!input.isCorrect) {
    return { correctnessPoints: 0, speedBonus: 0, streakBonus: 0, scoreDelta: 0 };
  }
  const speedBonus = Math.floor(MAX_SPEED_BONUS * clamp(1 - input.responseMs / QUESTION_TIME_LIMIT_MS, 0, 1));
  const streakBonus = input.previousAnswerWasCorrect ? STREAK_BONUS : 0;
  return {
    correctnessPoints: CORRECT_BASE_POINTS,
    speedBonus,
    streakBonus,
    scoreDelta: CORRECT_BASE_POINTS + speedBonus + streakBonus
  };
}

export function computeAnswerScore(input: { isCorrect: boolean; responseMs: number; previousAnswerWasCorrect?: boolean }): number {
  return computeAnswerScoreBreakdown(input).scoreDelta;
}

export function compareScores(a: Score, b: Score): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
  const aCorrectMs = a.totalCorrectResponseMs ?? a.totalOfficialResponseMs ?? a.totalResponseMs;
  const bCorrectMs = b.totalCorrectResponseMs ?? b.totalOfficialResponseMs ?? b.totalResponseMs;
  if (aCorrectMs !== bCorrectMs) return aCorrectMs - bCorrectMs;
  const aFast = a.fastestResponseMs ?? Number.POSITIVE_INFINITY;
  const bFast = b.fastestResponseMs ?? Number.POSITIVE_INFINITY;
  if (aFast !== bFast) return aFast - bFast;
  const aLast = a.lastAnswerAt ?? Number.POSITIVE_INFINITY;
  const bLast = b.lastAnswerAt ?? Number.POSITIVE_INFINITY;
  if (aLast !== bLast) return aLast - bLast;
  return a.participantId.localeCompare(b.participantId);
}

export function percentile(rank: number, total: number): number {
  if (total <= 0) return 100;
  return clamp(Math.ceil((Math.max(1, rank) * 100) / total), 1, 100);
}
