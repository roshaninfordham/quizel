export type Difficulty = "beginner" | "intermediate" | "expert";
export type QuestionCount = 3 | 10;
export type OptionKey = "A" | "B" | "C" | "D";

export type SessionStatus = "draft" | "lobby" | "selecting" | "active" | "finished" | "reset";
export type ParticipantRoleRequested = "player" | "crowd";
export type ParticipantRoleAssigned = "player1" | "player2" | "crowd" | "host";
export type MatchStatus = "waiting" | "active" | "resolving" | "finished";
export type RoundStatus = "preview" | "active" | "locked" | "resolved";
export type AgentStatus = "pending" | "running" | "complete" | "failed" | "fallback";
export type CurrencyType = "energy" | "trust_xp" | "player_score";
export type LedgerReason =
  | "initial_grant"
  | "cheer_spend"
  | "player_correct"
  | "speed_bonus"
  | "crowd_boost"
  | "supporter_correct_pick"
  | "playalong_correct"
  | "demo_seed"
  | "adjustment";

export interface Session {
  sessionId: string;
  joinCode: string;
  topic: string;
  difficulty: Difficulty;
  questionCount: QuestionCount;
  status: SessionStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  currentMatchId: string | null;
  lobbyOpenedAt: number | null;
}

export interface Participant {
  participantId: string;
  sessionId: string;
  identity: string;
  displayName: string;
  avatarSeed: string;
  roleRequested: ParticipantRoleRequested;
  roleAssigned: ParticipantRoleAssigned;
  interests: string[];
  joinedAt: number;
  lastSeen: number;
  isSimulated: boolean;
}

export interface Match {
  matchId: string;
  sessionId: string;
  player1Id: string;
  player2Id: string;
  status: MatchStatus;
  currentRoundNumber: number;
  player1Ready: boolean;
  player2Ready: boolean;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface Question {
  questionId: string;
  sessionId: string;
  matchId: string | null;
  roundNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionKey;
  explanation: string;
  difficulty: Difficulty;
  sourceAgent: string;
  fairnessStatus: "approved" | "rejected" | "fallback";
  createdAt: number;
}

export interface QuestionInput {
  questionText: string;
  options: Record<OptionKey, string>;
  correctOption: OptionKey;
  explanation: string;
  difficulty: Difficulty;
  topicTags: string[];
}

export interface Round {
  roundId: string;
  matchId: string;
  questionId: string;
  roundNumber: number;
  status: RoundStatus;
  startsAt: number;
  endsAt: number;
  resolvedAt: number | null;
  winnerPlayerId: string | null;
}

export interface Answer {
  answerId: string;
  roundId: string;
  participantId: string;
  selectedOption: OptionKey;
  serverReceivedAt: number;
  responseMs: number;
  isCorrect: boolean;
  pointsAwarded: number;
}

export interface PlayAlongAnswer {
  answerId: string;
  roundId: string;
  supporterId: string;
  selectedOption: OptionKey;
  serverReceivedAt: number;
  isCorrect: boolean;
}

export interface SupportEvent {
  supportId: string;
  roundId: string;
  supporterId: string;
  playerId: string;
  amount: number;
  createdAt: number;
  clientEventId: string | null;
}

export interface EnergyBalance {
  participantId: string;
  sessionId: string;
  spendableEnergy: number;
  trustXp: number;
  updatedAt: number;
}

export interface Score {
  participantId: string;
  matchId: string;
  playerScore: number;
  supporterXp: number;
  supportAccuracyNum: number;
  supportAccuracyDen: number;
  playalongCorrect: number;
  playalongTotal: number;
  updatedAt: number;
}

export interface LedgerEntry {
  ledgerId: string;
  sessionId: string;
  matchId: string | null;
  roundId: string | null;
  participantId: string;
  delta: number;
  currencyType: CurrencyType;
  reason: LedgerReason;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface AgentRequest {
  requestId: string;
  sessionId: string;
  requestType: "quiz_generation" | "commentary" | "learning_recap";
  topic: string;
  difficulty: Difficulty;
  questionCount: QuestionCount;
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
  playerCandidateCount: number;
  crowdCount: number;
  activeClients: number;
  realParticipants: number;
  simulatedSupporters: number;
  cheerEventsCount: number;
  cheerEventsPerSec: number;
  reducerCallsCount: number;
  duplicateAnswersRejected: number;
  doubleSpendAttemptsBlocked: number;
  p95SyncLatencyMs: number;
  updatedAt: number;
}

export interface AuditEvent {
  eventId: string;
  sessionId: string;
  actorIdentity: string;
  eventType: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface QuizDuelState {
  sessions: Session[];
  participants: Participant[];
  matches: Match[];
  questions: Question[];
  rounds: Round[];
  answers: Answer[];
  playAlongAnswers: PlayAlongAnswer[];
  supportEvents: SupportEvent[];
  energyBalances: EnergyBalance[];
  scores: Score[];
  ledgerEntries: LedgerEntry[];
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
  state: QuizDuelState;
  stateVersion: number;
  serverTime: number;
}

export interface ReceiptMessage<T = unknown> {
  type: "receipt";
  requestId: string | null;
  receipt: ReducerReceipt<T>;
}

export interface RoundScoreBreakdown {
  correctnessPoints: number;
  speedBonus: number;
  crowdBoost: number;
  roundScore: number;
}
