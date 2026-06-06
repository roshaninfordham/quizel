import { z } from "zod";

export const optionKeySchema = z.enum(["A", "B", "C", "D"]);

export const questionInputSchema = z.object({
  questionText: z.string().min(6).max(140),
  options: z.object({
    A: z.string().min(1).max(72),
    B: z.string().min(1).max(72),
    C: z.string().min(1).max(72),
    D: z.string().min(1).max(72)
  }),
  correctOption: optionKeySchema,
  explanation: z.string().min(6).max(260),
  topic: z.string().min(1).max(80)
});

export const questionBatchSchema = z.object({
  questions: z.array(questionInputSchema).min(1).max(5)
});

export const joinTournamentSchema = z.object({
  code: z.string().min(3),
  displayName: z.string().min(1).max(24),
  avatar: z.string().min(1).max(8)
});

export const topicVoteSchema = z.object({
  sessionId: z.string().min(1),
  topics: z.array(z.string().min(1).max(24)).min(1).max(3)
});

export const selectedOptionSchema = z.object({
  roundId: z.string().min(1),
  selectedOption: optionKeySchema,
  clientSentAt: z.number().optional()
});
