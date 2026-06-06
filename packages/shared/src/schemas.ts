import { z } from "zod";

export const optionKeySchema = z.enum(["A", "B", "C", "D"]);
export const difficultySchema = z.enum(["beginner", "intermediate", "expert"]);

export const questionInputSchema = z.object({
  questionText: z.string().min(8).max(240),
  options: z.object({
    A: z.string().min(1).max(120),
    B: z.string().min(1).max(120),
    C: z.string().min(1).max(120),
    D: z.string().min(1).max(120)
  }),
  correctOption: optionKeySchema,
  explanation: z.string().min(8).max(420),
  difficulty: difficultySchema,
  topicTags: z.array(z.string().min(1).max(40)).default([])
});

export const questionBatchSchema = z.object({
  questions: z.array(questionInputSchema).min(1).max(10)
});

export const joinSessionSchema = z.object({
  joinCode: z.string().min(3),
  displayName: z.string().min(1).max(28),
  roleRequested: z.enum(["player", "crowd"]),
  interests: z.array(z.string().min(1).max(24)).max(8)
});

export const selectedOptionSchema = z.object({
  roundId: z.string().min(1),
  selectedOption: optionKeySchema
});

export const supportPlayerSchema = z.object({
  roundId: z.string().min(1),
  playerId: z.string().min(1),
  amount: z.literal(25),
  clientEventId: z.string().min(1).optional()
});
