import { CORRECT_BASE_POINTS, MAX_SPEED_BONUS, QUESTION_TIME_LIMIT_MS } from "./constants";
import type { Score } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeAnswerScore(input: { isCorrect: boolean; responseMs: number }): number {
  if (!input.isCorrect) return 0;
  const speedBonus = Math.floor(MAX_SPEED_BONUS * clamp(1 - input.responseMs / QUESTION_TIME_LIMIT_MS, 0, 1));
  return CORRECT_BASE_POINTS + speedBonus;
}

export function compareScores(a: Score, b: Score): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
  if (a.totalResponseMs !== b.totalResponseMs) return a.totalResponseMs - b.totalResponseMs;
  const aFast = a.fastestResponseMs ?? Number.POSITIVE_INFINITY;
  const bFast = b.fastestResponseMs ?? Number.POSITIVE_INFINITY;
  if (aFast !== bFast) return aFast - bFast;
  const aLast = a.lastAnswerAt ?? Number.POSITIVE_INFINITY;
  const bLast = b.lastAnswerAt ?? Number.POSITIVE_INFINITY;
  if (aLast !== bLast) return aLast - bLast;
  return a.participantId.localeCompare(b.participantId);
}

export function percentile(rank: number, total: number): number {
  if (total <= 1) return 100;
  return Math.max(1, Math.round(((total - rank + 1) / total) * 100));
}
