export type OptionKey = "A" | "B" | "C" | "D";
export type SessionStatus = "lobby" | "topic_voting" | "generating" | "ready" | "playing" | "finished" | "replay" | "reset";
export type RoundStatus = "waiting" | "active" | "resolved";
export type AgentStatus = "pending" | "running" | "complete" | "failed" | "fallback";
export type PlayerIntentStatus = "pending" | "parsed" | "pack_ready" | "failed" | "fallback";
export type MatchEventType =
  | "join"
  | "intent_submitted"
  | "intent_parsed"
  | "topic_vote"
  | "questions_requested"
  | "pack_ready"
  | "question_start"
  | "answer"
  | "score_delta"
  | "rank_change"
  | "round_resolved"
  | "match_finished";

export interface Session {
  sessionId: string;
  code: string;
  status: SessionStatus;
  selectedTopic: string | null;
  questionCount: number;
  currentRound: number;
  matchStartedAt: number | null;
  matchFinishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Participant {
  participantId: string;
  sessionId: string;
  identity: string;
  displayName: string;
  avatar: string;
  joinedAt: number;
  lastSeen: number;
  isSimulated: boolean;
  clientLatencyMs: number | null;
}

export interface TopicVote {
  voteId: string;
  sessionId: string;
  participantId: string;
  topic: string;
  createdAt: number;
}

export interface PlayerIntent {
  intentId: string;
  sessionId: string;
  participantId: string;
  rawText: string;
  transcriptSource: "typed" | "speech";
  cleanedText: string;
  canonicalTopics: string[];
  topicKey: string;
  arenaName: string;
  difficultyHint: "beginner" | "intermediate" | "expert";
  confidence: number;
  status: PlayerIntentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionInput {
  questionText: string;
  options: Record<OptionKey, string>;
  correctOption: OptionKey;
  explanation: string;
  topic: string;
}

export interface Question {
  questionId: string;
  sessionId: string;
  orderIndex: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionKey;
  explanation: string;
  topic: string;
  generatedBy: string;
  fairnessStatus: "approved" | "fallback" | "rejected";
  createdAt: number;
}

export interface Round {
  roundId: string;
  sessionId: string;
  questionId: string;
  orderIndex: number;
  status: RoundStatus;
  startsAt: number;
  endsAt: number;
  resolvedAt: number | null;
}

export interface Answer {
  answerId: string;
  sessionId: string;
  roundId: string;
  participantId: string;
  selectedOption: OptionKey;
  isCorrect: boolean;
  responseMs: number;
  scoreDelta: number;
  serverReceivedAt: number;
}

export interface Score {
  scoreId: string;
  sessionId: string;
  participantId: string;
  totalScore: number;
  correctCount: number;
  totalResponseMs: number;
  fastestResponseMs: number | null;
  currentRank: number;
  previousRank: number;
  lastAnswerAt: number | null;
  updatedAt: number;
}

export interface MatchEvent {
  eventId: string;
  sessionId: string;
  participantId: string | null;
  eventType: MatchEventType;
  roundIndex: number | null;
  scoreAfter: number | null;
  rankAfter: number | null;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface AgentRequest {
  requestId: string;
  sessionId: string;
  requestType: "quiz_generation" | "recap";
  topic: string;
  questionCount: number;
  status: AgentStatus;
  createdAt: number;
  updatedAt: number;
  errorMessage: string | null;
}

export interface AgentEvent {
  eventId: string;
  sessionId: string;
  agentName: string;
  eventType: string;
  content: string;
  confidence: number;
  status: AgentStatus;
  createdAt: number;
}

export interface LiveStats {
  sessionId: string;
  joinedCount: number;
  realJoinedCount: number;
  simulatedJoinedCount: number;
  answersCount: number;
  answersPerSec: number;
  reducerCalls: number;
  duplicateAnswersRejected: number;
  p95LatencyMs: number;
  activeClients: number;
  updatedAt: number;
}

export interface AuditEvent {
  auditId: string;
  sessionId: string;
  actorIdentity: string | null;
  eventType: string;
  message: string;
  createdAt: number;
}

export interface QuizRushState {
  sessions: Session[];
  participants: Participant[];
  topicVotes: TopicVote[];
  playerIntents: PlayerIntent[];
  questions: Question[];
  rounds: Round[];
  answers: Answer[];
  scores: Score[];
  matchEvents: MatchEvent[];
  agentRequests: AgentRequest[];
  agentEvents: AgentEvent[];
  liveStats: LiveStats[];
  auditEvents: AuditEvent[];
}

export interface ReducerEnvelope<TArgs = unknown> {
  reducer: string;
  args: TArgs;
  identity?: string;
  requestId?: string;
}

export interface ReducerReceipt<T = unknown> {
  ok: boolean;
  reducer: string;
  data?: T;
  error?: string;
  stateVersion: number;
  serverTime: number;
}

export interface SnapshotMessage {
  type: "snapshot";
  state: QuizRushState;
  stateVersion: number;
  serverTime: number;
}

export interface ReceiptMessage<T = unknown> {
  type: "receipt";
  requestId: string | null;
  receipt: ReducerReceipt<T>;
}
