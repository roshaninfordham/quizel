import type { QuestionInput } from "./types";

export const SEEDED_DEMO_QUESTIONS: QuestionInput[] = [
  {
    questionText: "Which system is built for live shared state?",
    options: {
      A: "Static CSV",
      B: "SpacetimeDB",
      C: "Email",
      D: "PDF"
    },
    correctOption: "B",
    explanation: "SpacetimeDB combines database state with server-side logic and live subscriptions.",
    topic: "AI + Space + Startups"
  },
  {
    questionText: "What does a reducer protect in this quiz?",
    options: {
      A: "Button colors",
      B: "Duplicate answers",
      C: "Font size",
      D: "QR shape"
    },
    correctOption: "B",
    explanation: "The reducer owns the answer transaction and rejects a second answer for the same round.",
    topic: "Realtime Systems"
  },
  {
    questionText: "Which signal should decide QuizRush topics?",
    options: {
      A: "Room votes",
      B: "Random ads",
      C: "Browser width",
      D: "File names"
    },
    correctOption: "A",
    explanation: "The Topic Router Agent merges room topic votes into one short quiz theme.",
    topic: "AI Agents"
  },
  {
    questionText: "What powers the instant replay?",
    options: {
      A: "Screenshots",
      B: "MatchEvent ledger",
      C: "Hidden video",
      D: "Manual notes"
    },
    correctOption: "B",
    explanation: "Replay reads rank and score events committed during the live match.",
    topic: "SpacetimeDB"
  },
  {
    questionText: "A correct 1-second answer earns what bonus?",
    options: {
      A: "About 800",
      B: "Zero",
      C: "Only 25",
      D: "A profile badge"
    },
    correctOption: "A",
    explanation: "With a 5-second timer, the speed bonus is roughly 1000 * (1 - 1/5).",
    topic: "Scoring"
  }
];
