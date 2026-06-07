export const APP_NAME = "QuizRush Arena";
export const APP_TAGLINE = "A 25-second AI-personalized quiz tournament from one QR code";
export const MEMORY_SENTENCE = "The whole room scanned one QR code, shared expertise, and became a live AI-generated tournament in 25 seconds.";

export const DEFAULT_SESSION_ID = "session-demo";
export const DEFAULT_SESSION_CODE = "ARENA-42";
export const DEFAULT_JOIN_CODE = DEFAULT_SESSION_CODE;

export const QUESTION_COUNT = 10;
export const TOTAL_MATCH_SECONDS = 25;
export const QUESTION_TIME_LIMIT_MS = Math.floor((TOTAL_MATCH_SECONDS * 1000) / QUESTION_COUNT);
export const ROUND_LEAD_TIME_MS = 1000;
export const QUESTION_SECONDS = QUESTION_TIME_LIMIT_MS / 1000;
export const TOPIC_COLLECTION_SECONDS = 5;
export const QUESTION_GENERATION_DEADLINE_MS = 25_000;
export const QUESTION_GENERATION_FALLBACK_MS = 700;
export const CORRECT_BASE_POINTS = 1000;
export const MAX_SPEED_BONUS = 1000;
export const STREAK_BONUS = 100;
export const ANSWER_GRACE_MS = 150;
export const MAX_PLAYERS_SOFT = 10;
export const MAX_PLAYERS_HARD = 12;
export const MAX_VISIBLE_BRACKET_NODES = 64;
export const SIMULATED_JOIN_BATCH_SIZE = 5;
export const SIMULATED_ANSWER_BURST_SIZE = 8;

export const DEFAULT_TOPICS = ["AI", "Space", "Tech", "Math", "History", "Startups"];
export const DEFAULT_SELECTED_TOPIC = "AI + Space + Startups";
export const AVATAR_CHOICES = ["🚀", "🧠", "⚡", "🐼", "🦊", "🐯", "✨", "🔥"];
export const INTENT_PLACEHOLDERS = [
  "AI agents, databases, and startups",
  "Space missions and physics",
  "World history and empires",
  "Math puzzles and probability",
  "Football, F1, and sports trivia"
];

export const DISCLAIMER =
  "QuizRush Arena uses educational game scoring only. There is no purchase, cash prize, withdrawal, transfer, or real-world value.";
