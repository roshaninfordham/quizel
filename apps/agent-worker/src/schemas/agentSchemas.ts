import { z } from "zod";
import { questionInputSchema } from "@quizduel/shared";

export const fairnessReviewSchema = z.object({
  approved: z.boolean(),
  rejectedCount: z.number().int().min(0).max(10),
  issues: z
    .array(
      z.object({
        roundNumber: z.number().int().min(1).max(10),
        severity: z.enum(["low", "medium", "high"]),
        issue: z.string().min(1).max(240),
        suggestedFix: z.string().min(1).max(240)
      })
    )
    .max(10),
  fixedQuestions: z.array(questionInputSchema).min(1).max(10)
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
