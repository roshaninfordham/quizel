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
    questionText: "Which row stores replayable quiz events?",
    options: {
      A: "MatchEvent",
      B: "Random ads",
      C: "Browser width",
      D: "File names"
    },
    correctOption: "A",
    explanation: "MatchEvent rows record committed actions that can rebuild the live replay.",
    topic: "SpacetimeDB"
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
    questionText: "What decides your rank after every answer?",
    options: {
      A: "Score rules",
      B: "Screen size",
      C: "Avatar color",
      D: "Join order only"
    },
    correctOption: "A",
    explanation: "Ranks are recomputed from committed scores, correctness, and response time.",
    topic: "Scoring"
  },
  {
    questionText: "Why keep the quiz under one match clock?",
    options: {
      A: "To cap race time",
      B: "To hide scores",
      C: "To stop joins",
      D: "To slow answers"
    },
    correctOption: "A",
    explanation: "A single match deadline keeps the tournament fast and predictable for the room.",
    topic: "Realtime Systems"
  },
  {
    questionText: "A correct answer gets speed points when it is...",
    options: {
      A: "Earlier",
      B: "Later",
      C: "Skipped",
      D: "Duplicated"
    },
    correctOption: "A",
    explanation: "Correct answers earn more speed bonus when the server receives them earlier.",
    topic: "Scoring"
  },
  {
    questionText: "Who should calculate official response time?",
    options: {
      A: "The browser",
      B: "The reducer",
      C: "The projector",
      D: "The QR code"
    },
    correctOption: "B",
    explanation: "The reducer uses server receipt time and the round start time for official scoring.",
    topic: "Scoring"
  },
  {
    questionText: "What happens after capacity is full?",
    options: {
      A: "Users overload reducers",
      B: "Users get waitlisted",
      C: "Scores double",
      D: "Questions vanish"
    },
    correctOption: "B",
    explanation: "Admission control waitlists users beyond the measured hard cap to protect latency.",
    topic: "Capacity"
  },
  {
    questionText: "What does the projector show during play?",
    options: {
      A: "Private questions",
      B: "Correct answers",
      C: "Champion Path",
      D: "Raw JSON"
    },
    correctOption: "C",
    explanation: "The public screen shows the live fixture and leaderboard, not private quiz content.",
    topic: "UX"
  }
];
