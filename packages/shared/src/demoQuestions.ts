import type { QuestionInput } from "./types";

export const SEEDED_DEMO_QUESTIONS: QuestionInput[] = [
  {
    questionText: "What does SpacetimeDB combine for realtime apps?",
    options: {
      A: "A database and server-side application logic",
      B: "A CSS compiler and CDN",
      C: "A video encoder and media player",
      D: "A payment processor and invoice tool"
    },
    correctOption: "A",
    explanation: "SpacetimeDB stores data and runs transactional reducer logic that clients can call and subscribe to.",
    difficulty: "beginner",
    topicTags: ["SpacetimeDB", "realtime"]
  },
  {
    questionText: "Why should quiz answers be accepted by a server reducer instead of only client code?",
    options: {
      A: "To make scoring prettier",
      B: "To enforce one answer per player transactionally",
      C: "To lower the font size",
      D: "To avoid writing tests"
    },
    correctOption: "B",
    explanation: "The reducer is authoritative and can reject duplicate answers even when many clients tap at once.",
    difficulty: "beginner",
    topicTags: ["transactions", "integrity"]
  },
  {
    questionText: "What is the safest way to use an LLM in this game architecture?",
    options: {
      A: "Let it directly edit player scores",
      B: "Run it inside every button click",
      C: "Validate its JSON output before submitting questions",
      D: "Trust any text it returns"
    },
    correctOption: "C",
    explanation: "The worker validates generated JSON and uses fallback questions when model output is malformed.",
    difficulty: "intermediate",
    topicTags: ["AI agents", "validation"]
  },
  {
    questionText: "In this demo, what does Crowd Energy represent?",
    options: {
      A: "Cash value",
      B: "A transferable wallet balance",
      C: "Non-redeemable game XP used for cheering",
      D: "An odds calculation"
    },
    correctOption: "C",
    explanation: "Energy is only educational game XP. It cannot be purchased, withdrawn, transferred, or redeemed.",
    difficulty: "beginner",
    topicTags: ["guardrails", "game design"]
  },
  {
    questionText: "Which space startup milestone made reusable orbital-class boosters famous?",
    options: {
      A: "Landing and reusing Falcon 9 first stages",
      B: "Launching the first weather balloon",
      C: "Inventing the telescope",
      D: "Building the first steam engine"
    },
    correctOption: "A",
    explanation: "Reusable Falcon 9 boosters helped prove that launch hardware could fly, land, and fly again.",
    difficulty: "beginner",
    topicTags: ["space", "startups"]
  },
  {
    questionText: "What is p95 latency measuring on the projector metrics strip?",
    options: {
      A: "The fastest single update",
      B: "A high-percentile update latency experienced by clients",
      C: "The number of questions generated",
      D: "The final score gap"
    },
    correctOption: "B",
    explanation: "p95 is a high percentile: about 95% of measured updates are at or below that latency.",
    difficulty: "intermediate",
    topicTags: ["metrics", "realtime"]
  },
  {
    questionText: "Why is crowd boost capped in QuizDuel Live?",
    options: {
      A: "So popularity cannot overpower correctness and speed",
      B: "So buttons can be smaller",
      C: "So no one can join late",
      D: "So questions are hidden"
    },
    correctOption: "A",
    explanation: "The boost adds excitement, but the cap keeps quiz knowledge and response time central.",
    difficulty: "beginner",
    topicTags: ["scoring", "fairness"]
  },
  {
    questionText: "Which pattern best describes the agent worker?",
    options: {
      A: "External async process that calls LLMs and writes validated results",
      B: "A database table that animates confetti",
      C: "A browser-only CSS plugin",
      D: "A replacement for reducers"
    },
    correctOption: "A",
    explanation: "The worker handles outside I/O, retries, validation, fallback, and records agent events.",
    difficulty: "intermediate",
    topicTags: ["Effect", "workers"]
  },
  {
    questionText: "What is the main hackathon value of deterministic demo mode?",
    options: {
      A: "It removes the need for UI",
      B: "It makes the golden path repeatable under pressure",
      C: "It hides all technical work",
      D: "It prevents local hosting"
    },
    correctOption: "B",
    explanation: "A deterministic reset means the team can recover quickly and show the same polished flow every time.",
    difficulty: "beginner",
    topicTags: ["hackathons", "demo"]
  },
  {
    questionText: "What should happen when the LLM API key is missing?",
    options: {
      A: "The demo should fail",
      B: "The app should use validated seed fallback questions",
      C: "Players should type their own answers",
      D: "The projector should go blank"
    },
    correctOption: "B",
    explanation: "Fallback questions keep the demo reliable while still showing the agent pipeline and guardrails.",
    difficulty: "beginner",
    topicTags: ["fallback", "reliability"]
  }
];
