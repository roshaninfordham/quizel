import { z } from "zod";
import { questionInputSchema } from "@quizrush/shared";

export const topicRouterSchema = z.object({
  selected_topic: z.string().min(2).max(80),
  reason: z.string().min(8).max(240),
  topic_weights: z
    .array(
      z.object({
        topic: z.string().min(2).max(40),
        weight: z.number().min(0).max(1)
      })
    )
    .min(1)
    .max(6)
});

export const fairnessReviewSchema = z.object({
  approved: z.boolean(),
  rejectedCount: z.number().int().min(0).max(5),
  issues: z
    .array(
      z.object({
        roundNumber: z.number().int().min(1).max(5),
        severity: z.enum(["low", "medium", "high"]),
        issue: z.string().min(1).max(240),
        suggestedFix: z.string().min(1).max(240)
      })
    )
    .max(5),
  fixedQuestions: z.array(questionInputSchema).max(5)
});

export const safetyGuardReviewSchema = z.object({
  safe: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high"]),
  categories: z.array(z.string().min(2).max(80)).max(8),
  rationale: z.string().min(4).max(240)
});

export const hostCommentarySchema = z.object({
  commentary: z.string().min(8).max(160),
  tone: z.enum(["excited", "encouraging", "educational"]),
  confidence: z.number().min(0).max(1)
});

export const learningRecapSchema = z.object({
  summary: z.string().min(20).max(600),
  hardestConcepts: z.array(z.string().min(2).max(80)).min(1).max(5),
  nextQuizRecommendation: z.string().min(8).max(160)
});

export type HostCommentaryOutput = z.infer<typeof hostCommentarySchema>;
export type LearningRecapOutput = z.infer<typeof learningRecapSchema>;
export type SafetyGuardReviewOutput = z.infer<typeof safetyGuardReviewSchema>;
export type TopicRouterOutput = z.infer<typeof topicRouterSchema>;
