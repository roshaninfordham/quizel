import {
  CORRECT_BASE_POINTS,
  MAX_CROWD_BOOST,
  MAX_SPEED_BONUS,
  QUESTION_TIME_LIMIT_MS
} from "./constants";
import type { Answer, RoundScoreBreakdown } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computePlayerRoundScore(input: {
  isCorrect: boolean;
  responseMs: number;
  totalSupportForPlayer: number;
}): RoundScoreBreakdown {
  const correctnessPoints = input.isCorrect ? CORRECT_BASE_POINTS : 0;
  const speedBonus = input.isCorrect
    ? Math.floor(MAX_SPEED_BONUS * clamp(1 - input.responseMs / QUESTION_TIME_LIMIT_MS, 0, 1))
    : 0;
  const crowdBoost = Math.min(MAX_CROWD_BOOST, Math.floor(input.totalSupportForPlayer / 25) * 10);

  return {
    correctnessPoints,
    speedBonus,
    crowdBoost,
    roundScore: correctnessPoints + speedBonus + crowdBoost
  };
}

export function determineRoundWinner(input: {
  player1Id: string;
  player2Id: string;
  player1Answer: Answer | null;
  player2Answer: Answer | null;
  player1Score: number;
  player2Score: number;
  player1Support: number;
  player2Support: number;
}): string {
  if (input.player1Score !== input.player2Score) {
    return input.player1Score > input.player2Score ? input.player1Id : input.player2Id;
  }

  const p1Correct = input.player1Answer?.isCorrect ?? false;
  const p2Correct = input.player2Answer?.isCorrect ?? false;
  if (p1Correct !== p2Correct) {
    return p1Correct ? input.player1Id : input.player2Id;
  }

  const p1Response = input.player1Answer?.responseMs ?? Number.POSITIVE_INFINITY;
  const p2Response = input.player2Answer?.responseMs ?? Number.POSITIVE_INFINITY;
  if (p1Response !== p2Response) {
    return p1Response < p2Response ? input.player1Id : input.player2Id;
  }

  if (input.player1Support !== input.player2Support) {
    return input.player1Support > input.player2Support ? input.player1Id : input.player2Id;
  }

  return input.player1Id.localeCompare(input.player2Id) <= 0 ? input.player1Id : input.player2Id;
}

export function supportAccuracyPercent(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}
