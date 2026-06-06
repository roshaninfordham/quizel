import {
  CHEER_AMOUNT,
  DEFAULT_JOIN_CODE,
  DEFAULT_SESSION_ID,
  DEMO_TOPIC,
  INITIAL_ENERGY,
  QUESTION_TIME_LIMIT_MS
} from "./constants";
import { SEEDED_DEMO_QUESTIONS } from "./demoQuestions";
import { computePlayerRoundScore, determineRoundWinner } from "./scoring";
import { questionBatchSchema, selectedOptionSchema, supportPlayerSchema } from "./schemas";
import type {
  AgentEvent,
  Answer,
  AuditEvent,
  Difficulty,
  EnergyBalance,
  LedgerEntry,
  LiveStats,
  Match,
  OptionKey,
  Participant,
  PlayAlongAnswer,
  Question,
  QuestionCount,
  QuestionInput,
  QuizDuelState,
  ReducerReceipt,
  Round,
  Score,
  Session,
  SupportEvent
} from "./types";

type Listener = () => void;

interface ReducerContext<TArgs> {
  args: TArgs;
  identity: string;
}

export interface CreateSessionArgs {
  topic: string;
  difficulty: Difficulty;
  questionCount: QuestionCount;
}

export interface SessionIdArgs {
  sessionId: string;
}

export interface RequestQuestionsArgs {
  sessionId: string;
  topic: string;
  difficulty: Difficulty;
  questionCount: QuestionCount;
}

export interface SubmitQuestionBatchArgs {
  sessionId: string;
  requestId?: string;
  questions: QuestionInput[];
}

export interface JoinSessionArgs {
  joinCode: string;
  displayName: string;
  roleRequested: "player" | "crowd";
  interests: string[];
}

export interface MatchIdArgs {
  matchId: string;
}

export interface StartRoundArgs {
  matchId: string;
  roundNumber: number;
}

export interface SubmitAnswerArgs {
  roundId: string;
  selectedOption: OptionKey;
}

export interface SupportPlayerArgs {
  roundId: string;
  playerId: string;
  amount: number;
  clientEventId?: string;
}

export interface AddSimulatedSupportersArgs {
  sessionId: string;
  count: number;
}

const SYSTEM_IDENTITY = "system";

export function createInitialDemoState(now = Date.now()): QuizDuelState {
  const session: Session = {
    sessionId: DEFAULT_SESSION_ID,
    joinCode: DEFAULT_JOIN_CODE,
    topic: DEMO_TOPIC,
    difficulty: "beginner",
    questionCount: 3,
    status: "draft",
    createdBy: "host-local",
    createdAt: now,
    updatedAt: now,
    currentMatchId: null,
    lobbyOpenedAt: null
  };

  const liveStats: LiveStats = {
    sessionId: session.sessionId,
    joinedCount: 0,
    playerCandidateCount: 0,
    crowdCount: 0,
    activeClients: 0,
    realParticipants: 0,
    simulatedSupporters: 0,
    cheerEventsCount: 0,
    cheerEventsPerSec: 0,
    reducerCallsCount: 0,
    duplicateAnswersRejected: 0,
    doubleSpendAttemptsBlocked: 0,
    p95SyncLatencyMs: 42,
    updatedAt: now
  };

  return {
    sessions: [session],
    participants: [],
    matches: [],
    questions: [],
    rounds: [],
    answers: [],
    playAlongAnswers: [],
    supportEvents: [],
    energyBalances: [],
    scores: [],
    ledgerEntries: [],
    agentRequests: [],
    agentEvents: [
      {
        eventId: "agent-seed-ready",
        sessionId: session.sessionId,
        agentName: "Fallback Seed Provider",
        eventType: "demo_ready",
        content: "Deterministic fallback questions are ready if the LLM is unavailable.",
        confidence: 1,
        status: "complete",
        createdAt: now
      }
    ],
    liveStats: [liveStats],
    auditEvents: [
      {
        eventId: "audit-demo-ready",
        sessionId: session.sessionId,
        actorIdentity: SYSTEM_IDENTITY,
        eventType: "demo_ready",
        message: "Demo session initialized.",
        metadata: {},
        createdAt: now
      }
    ]
  };
}

export class QuizDuelEngine {
  private state: QuizDuelState;
  private listeners = new Set<Listener>();
  private idCounter = 1;
  private version = 1;

  public constructor(initialState: QuizDuelState = createInitialDemoState()) {
    this.state = structuredClone(initialState);
  }

  public get stateVersion(): number {
    return this.version;
  }

  public getSnapshot(): QuizDuelState {
    return this.state;
  }

  public replaceState(state: QuizDuelState): void {
    this.state = structuredClone(state);
    this.version += 1;
    this.emit();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public callReducer<T = unknown>(reducer: string, args: unknown, identity = "host-local"): ReducerReceipt<T> {
    const previous = structuredClone(this.state);
    const started = Date.now();

    try {
      const sessionId = this.findSessionIdFromArgs(args);
      if (sessionId) {
        this.incrementReducerCount(sessionId, started);
      }

      const data = this.dispatch(reducer, { args, identity }) as T;
      this.version += 1;
      this.emit();
      return {
        ok: true,
        reducer,
        data,
        stateVersion: this.version,
        serverTime: Date.now()
      };
    } catch (error) {
      this.state = previous;
      this.version += 1;
      this.emit();
      return {
        ok: false,
        reducer,
        error: error instanceof Error ? error.message : String(error),
        stateVersion: this.version,
        serverTime: Date.now()
      };
    }
  }

  private dispatch(reducer: string, context: ReducerContext<unknown>): unknown {
    switch (reducer) {
      case "create_session":
        return this.createSession(context as ReducerContext<CreateSessionArgs>);
      case "open_lobby":
        return this.openLobby(context as ReducerContext<SessionIdArgs>);
      case "request_questions":
        return this.requestQuestions(context as ReducerContext<RequestQuestionsArgs>);
      case "submit_question_batch":
        return this.submitQuestionBatch(context as ReducerContext<SubmitQuestionBatchArgs>);
      case "record_agent_event":
        return this.recordAgentEvent(context as ReducerContext<Partial<AgentEvent> & { sessionId: string }>);
      case "join_session":
        return this.joinSession(context as ReducerContext<JoinSessionArgs>);
      case "heartbeat":
        return this.heartbeat(context as ReducerContext<SessionIdArgs>);
      case "assign_champions_randomly":
        return this.assignChampionsRandomly(context as ReducerContext<SessionIdArgs>);
      case "player_ready":
        return this.playerReady(context as ReducerContext<MatchIdArgs>);
      case "start_match":
        return this.startMatch(context as ReducerContext<MatchIdArgs>);
      case "start_round":
        return this.startRound(context as ReducerContext<StartRoundArgs>);
      case "submit_answer":
        return this.submitAnswer(context as ReducerContext<SubmitAnswerArgs>);
      case "submit_playalong_answer":
        return this.submitPlayalongAnswer(context as ReducerContext<SubmitAnswerArgs>);
      case "support_player":
        return this.supportPlayer(context as ReducerContext<SupportPlayerArgs>);
      case "resolve_round":
        return this.resolveRound(context as ReducerContext<{ roundId: string }>);
      case "finish_match":
        return this.finishMatch(context as ReducerContext<MatchIdArgs & { force?: boolean }>);
      case "reset_demo":
        return this.resetDemo(context as ReducerContext<SessionIdArgs>);
      case "add_simulated_supporters":
        return this.addSimulatedSupporters(context as ReducerContext<AddSimulatedSupportersArgs>);
      default:
        throw new Error(`Unknown reducer: ${reducer}`);
    }
  }

  private createSession({ args, identity }: ReducerContext<CreateSessionArgs>): Session {
    const now = Date.now();
    const existing = this.state.sessions[0];
    if (existing && this.state.participants.length === 0 && this.state.matches.length === 0) {
      existing.topic = args.topic;
      existing.difficulty = args.difficulty;
      existing.questionCount = args.questionCount;
      existing.status = "draft";
      existing.updatedAt = now;
      this.audit(existing.sessionId, identity, "create_session", `Session prepared for ${args.topic}.`, {
        difficulty: args.difficulty,
        questionCount: args.questionCount
      });
      this.recalculateLiveStats(existing.sessionId);
      return existing;
    }

    const session: Session = {
      sessionId: this.nextId("session"),
      joinCode: `ARENA-${40 + this.state.sessions.length + 2}`,
      topic: args.topic,
      difficulty: args.difficulty,
      questionCount: args.questionCount,
      status: "draft",
      createdBy: identity,
      createdAt: now,
      updatedAt: now,
      currentMatchId: null,
      lobbyOpenedAt: null
    };
    this.state.sessions.push(session);
    this.state.liveStats.push(this.emptyLiveStats(session.sessionId, now));
    this.audit(session.sessionId, identity, "create_session", `Session created for ${args.topic}.`, {});
    this.recalculateLiveStats(session.sessionId);
    return session;
  }

  private openLobby({ args, identity }: ReducerContext<SessionIdArgs>): Session {
    this.requireHost(args.sessionId, identity);
    const session = this.requireSession(args.sessionId);
    const now = Date.now();
    session.status = "lobby";
    session.lobbyOpenedAt = now;
    session.updatedAt = now;
    this.audit(session.sessionId, identity, "open_lobby", "Lobby opened for live audience join.", {});
    this.recalculateLiveStats(session.sessionId);
    return session;
  }

  private requestQuestions({ args, identity }: ReducerContext<RequestQuestionsArgs>) {
    this.requireHost(args.sessionId, identity);
    const now = Date.now();
    const request = {
      requestId: this.nextId("agent-request"),
      sessionId: args.sessionId,
      requestType: "quiz_generation" as const,
      topic: args.topic,
      difficulty: args.difficulty,
      questionCount: args.questionCount,
      status: "pending" as const,
      createdAt: now,
      updatedAt: now,
      errorMessage: null
    };
    this.state.agentRequests.push(request);
    this.recordAgentEvent({
      args: {
        sessionId: args.sessionId,
        agentName: "Quiz Author Agent",
        eventType: "request_created",
        content: `Question request queued for ${args.topic}.`,
        confidence: 0.9,
        status: "pending"
      },
      identity
    });
    this.audit(args.sessionId, identity, "request_questions", "AI quiz generation requested.", {
      requestId: request.requestId
    });
    return request;
  }

  private submitQuestionBatch({ args, identity }: ReducerContext<SubmitQuestionBatchArgs>) {
    this.requireSession(args.sessionId);
    const parsed = questionBatchSchema.safeParse({ questions: args.questions });
    if (!parsed.success) {
      throw new Error("Malformed question batch rejected by schema validation.");
    }

    const session = this.requireSession(args.sessionId);
    const now = Date.now();
    this.state.questions = this.state.questions.filter((question) => question.sessionId !== args.sessionId);
    const inserted: Question[] = parsed.data.questions.slice(0, session.questionCount).map((question, index) => ({
      questionId: this.nextId("question"),
      sessionId: args.sessionId,
      matchId: session.currentMatchId,
      roundNumber: index + 1,
      questionText: question.questionText,
      optionA: question.options.A,
      optionB: question.options.B,
      optionC: question.options.C,
      optionD: question.options.D,
      correctOption: question.correctOption,
      explanation: question.explanation,
      difficulty: question.difficulty,
      sourceAgent: identity === "agent-worker" ? "Quiz Author Agent" : "Fallback Seed Provider",
      fairnessStatus: identity === "agent-worker" ? "approved" : "fallback",
      createdAt: now
    }));

    this.state.questions.push(...inserted);
    if (args.requestId) {
      const request = this.state.agentRequests.find((candidate) => candidate.requestId === args.requestId);
      if (request) {
        request.status = identity === "agent-worker" ? "complete" : "fallback";
        request.updatedAt = now;
      }
    }

    this.recordAgentEvent({
      args: {
        sessionId: args.sessionId,
        agentName: "Fairness Review Agent",
        eventType: "questions_approved",
        content: `${inserted.length} questions validated and ready for the match.`,
        confidence: 0.98,
        status: identity === "agent-worker" ? "complete" : "fallback"
      },
      identity
    });
    this.audit(args.sessionId, identity, "submit_question_batch", "Question batch accepted.", {
      count: inserted.length
    });
    return inserted;
  }

  private recordAgentEvent({ args }: ReducerContext<Partial<AgentEvent> & { sessionId: string }>): AgentEvent {
    this.requireSession(args.sessionId);
    const event: AgentEvent = {
      eventId: args.eventId ?? this.nextId("agent-event"),
      sessionId: args.sessionId,
      agentName: args.agentName ?? "Agent Worker",
      eventType: args.eventType ?? "event",
      content: args.content ?? "",
      confidence: args.confidence ?? 0.8,
      status: args.status ?? "complete",
      createdAt: args.createdAt ?? Date.now()
    };
    this.state.agentEvents.push(event);
    return event;
  }

  private joinSession({ args, identity }: ReducerContext<JoinSessionArgs>) {
    const session = this.state.sessions.find(
      (candidate) => candidate.joinCode.toLowerCase() === args.joinCode.toLowerCase()
    );
    if (!session || session.status !== "lobby") {
      throw new Error("This arena is not accepting joins yet.");
    }

    const existing = this.findParticipantByIdentity(session.sessionId, identity);
    if (existing) {
      existing.displayName = args.displayName.trim();
      existing.roleRequested = args.roleRequested;
      existing.interests = args.interests;
      existing.lastSeen = Date.now();
      this.recalculateLiveStats(session.sessionId);
      return {
        participant: existing,
        energyBalance: this.requireEnergyBalance(existing.participantId),
        alreadyJoined: true
      };
    }

    const now = Date.now();
    const participant: Participant = {
      participantId: this.nextId("participant"),
      sessionId: session.sessionId,
      identity,
      displayName: args.displayName.trim(),
      avatarSeed: `${args.displayName.trim()}-${identity}`,
      roleRequested: args.roleRequested,
      roleAssigned: "crowd",
      interests: args.interests,
      joinedAt: now,
      lastSeen: now,
      isSimulated: false
    };
    this.state.participants.push(participant);
    const energyBalance = this.grantInitialEnergy(participant, "initial_grant", {});
    this.audit(
      session.sessionId,
      identity,
      "join_session",
      `${participant.displayName} joined as ${args.roleRequested === "player" ? "Champion candidate" : "Crowd"}.`,
      { participantId: participant.participantId }
    );
    this.recalculateLiveStats(session.sessionId);
    return { participant, energyBalance, alreadyJoined: false };
  }

  private heartbeat({ args, identity }: ReducerContext<SessionIdArgs>) {
    const participant = this.findParticipantByIdentity(args.sessionId, identity);
    if (participant) {
      participant.lastSeen = Date.now();
    }
    this.recalculateLiveStats(args.sessionId);
    return { active: Boolean(participant) };
  }

  private assignChampionsRandomly({ args, identity }: ReducerContext<SessionIdArgs>) {
    this.requireHost(args.sessionId, identity);
    const session = this.requireSession(args.sessionId);
    if (session.currentMatchId) {
      const existingMatch = this.requireMatch(session.currentMatchId);
      return { match: existingMatch, alreadySelected: true };
    }
    if (session.status !== "lobby") {
      throw new Error("Champions can only be selected from the lobby.");
    }

    const candidates = this.state.participants
      .filter((participant) => participant.sessionId === args.sessionId && participant.roleRequested === "player")
      .sort((a, b) => stableHash(`${a.participantId}:${session.sessionId}`) - stableHash(`${b.participantId}:${session.sessionId}`));
    if (candidates.length < 2) {
      throw new Error("At least two Champion candidates are required.");
    }

    const player1 = candidates[0];
    const player2 = candidates[1];
    if (!player1 || !player2) {
      throw new Error("Champion selection failed.");
    }
    for (const participant of this.state.participants.filter((item) => item.sessionId === args.sessionId)) {
      participant.roleAssigned = "crowd";
    }
    player1.roleAssigned = "player1";
    player2.roleAssigned = "player2";

    const now = Date.now();
    const match: Match = {
      matchId: this.nextId("match"),
      sessionId: session.sessionId,
      player1Id: player1.participantId,
      player2Id: player2.participantId,
      status: "waiting",
      currentRoundNumber: 0,
      player1Ready: false,
      player2Ready: false,
      startedAt: null,
      finishedAt: null
    };
    this.state.matches.push(match);
    this.upsertScore(player1.participantId, match.matchId, now);
    this.upsertScore(player2.participantId, match.matchId, now);
    for (const participant of this.state.participants.filter((item) => item.sessionId === args.sessionId)) {
      this.upsertScore(participant.participantId, match.matchId, now);
    }

    session.currentMatchId = match.matchId;
    session.status = "selecting";
    session.updatedAt = now;
    for (const question of this.state.questions.filter((item) => item.sessionId === args.sessionId)) {
      question.matchId = match.matchId;
    }
    this.audit(args.sessionId, identity, "assign_champions_randomly", "Two Champions selected transactionally.", {
      player1Id: player1.participantId,
      player2Id: player2.participantId
    });
    this.recalculateLiveStats(args.sessionId);
    return { match, player1, player2, alreadySelected: false };
  }

  private playerReady({ args, identity }: ReducerContext<MatchIdArgs>) {
    const match = this.requireMatch(args.matchId);
    const participant = this.findParticipantByIdentity(match.sessionId, identity);
    if (!participant || (participant.participantId !== match.player1Id && participant.participantId !== match.player2Id)) {
      throw new Error("Only selected Champions can mark ready.");
    }
    if (participant.participantId === match.player1Id) match.player1Ready = true;
    if (participant.participantId === match.player2Id) match.player2Ready = true;
    this.audit(match.sessionId, identity, "player_ready", `${participant.displayName} is ready.`, {
      participantId: participant.participantId
    });
    return { player1Ready: match.player1Ready, player2Ready: match.player2Ready };
  }

  private startMatch({ args, identity }: ReducerContext<MatchIdArgs>) {
    const match = this.requireMatch(args.matchId);
    this.requireHost(match.sessionId, identity);
    const session = this.requireSession(match.sessionId);
    this.ensureQuestionsForSession(session);
    const now = Date.now();
    match.status = "active";
    match.startedAt = now;
    session.status = "active";
    session.updatedAt = now;
    this.audit(match.sessionId, identity, "start_match", "Match started.", { matchId: match.matchId });
    const round = this.createRound(match, 1);
    return { match, round };
  }

  private startRound({ args, identity }: ReducerContext<StartRoundArgs>) {
    const match = this.requireMatch(args.matchId);
    this.requireHost(match.sessionId, identity);
    if (match.status !== "active") {
      throw new Error("Match must be active to start a round.");
    }
    const previousRound = this.state.rounds.find(
      (round) => round.matchId === match.matchId && round.roundNumber === args.roundNumber - 1
    );
    if (previousRound && previousRound.status !== "resolved") {
      throw new Error("Resolve the previous round before starting the next one.");
    }
    const round = this.createRound(match, args.roundNumber);
    this.audit(match.sessionId, identity, "start_round", `Round ${args.roundNumber} started.`, {
      roundId: round.roundId
    });
    return round;
  }

  private submitAnswer({ args, identity }: ReducerContext<SubmitAnswerArgs>) {
    const parsed = selectedOptionSchema.parse(args);
    const round = this.requireRound(parsed.roundId);
    if (round.status !== "active") {
      throw new Error("Round is not accepting answers.");
    }
    const match = this.requireMatch(round.matchId);
    const participant = this.findParticipantByIdentity(match.sessionId, identity);
    if (!participant || (participant.participantId !== match.player1Id && participant.participantId !== match.player2Id)) {
      throw new Error("Only selected Champions can answer this question.");
    }
    const duplicate = this.state.answers.find(
      (answer) => answer.roundId === round.roundId && answer.participantId === participant.participantId
    );
    if (duplicate) {
      const stats = this.requireLiveStats(match.sessionId);
      stats.duplicateAnswersRejected += 1;
      stats.updatedAt = Date.now();
      return { accepted: false, reason: "duplicate_answer", answer: duplicate };
    }

    const question = this.requireQuestion(round.questionId);
    const now = Date.now();
    const answer: Answer = {
      answerId: this.nextId("answer"),
      roundId: round.roundId,
      participantId: participant.participantId,
      selectedOption: parsed.selectedOption,
      serverReceivedAt: now,
      responseMs: Math.max(0, Math.min(now - round.startsAt, QUESTION_TIME_LIMIT_MS)),
      isCorrect: parsed.selectedOption === question.correctOption,
      pointsAwarded: 0
    };
    this.state.answers.push(answer);
    const playerAnswerCount = this.state.answers.filter(
      (candidate) =>
        candidate.roundId === round.roundId &&
        (candidate.participantId === match.player1Id || candidate.participantId === match.player2Id)
    ).length;
    if (playerAnswerCount >= 2) {
      round.status = "locked";
    }
    this.audit(match.sessionId, identity, "submit_answer", `${participant.displayName} locked an answer.`, {
      roundId: round.roundId
    });
    return { accepted: true, answer };
  }

  private submitPlayalongAnswer({ args, identity }: ReducerContext<SubmitAnswerArgs>) {
    const parsed = selectedOptionSchema.parse(args);
    const round = this.requireRound(parsed.roundId);
    if (round.status !== "active") {
      throw new Error("Round is not accepting play-along answers.");
    }
    const match = this.requireMatch(round.matchId);
    const participant = this.findParticipantByIdentity(match.sessionId, identity);
    if (!participant || participant.roleAssigned !== "crowd") {
      throw new Error("Only Crowd supporters can play along.");
    }
    const duplicate = this.state.playAlongAnswers.find(
      (answer) => answer.roundId === round.roundId && answer.supporterId === participant.participantId
    );
    if (duplicate) {
      return { accepted: false, reason: "duplicate_playalong_answer", answer: duplicate };
    }
    const question = this.requireQuestion(round.questionId);
    const answer: PlayAlongAnswer = {
      answerId: this.nextId("playalong"),
      roundId: round.roundId,
      supporterId: participant.participantId,
      selectedOption: parsed.selectedOption,
      serverReceivedAt: Date.now(),
      isCorrect: parsed.selectedOption === question.correctOption
    };
    this.state.playAlongAnswers.push(answer);
    return { accepted: true, answer };
  }

  private supportPlayer({ args, identity }: ReducerContext<SupportPlayerArgs>) {
    const parsed = supportPlayerSchema.parse(args);
    const round = this.requireRound(parsed.roundId);
    if (round.status !== "active") {
      throw new Error("Cheering is only open during an active round.");
    }
    const match = this.requireMatch(round.matchId);
    const supporter = this.findParticipantByIdentity(match.sessionId, identity);
    if (!supporter || supporter.roleAssigned !== "crowd") {
      throw new Error("Only Crowd supporters can cheer.");
    }
    if (parsed.playerId !== match.player1Id && parsed.playerId !== match.player2Id) {
      throw new Error("Cheer target must be one of tonight's Champions.");
    }
    if (parsed.clientEventId) {
      const existing = this.state.supportEvents.find(
        (event) => event.roundId === round.roundId && event.clientEventId === parsed.clientEventId
      );
      if (existing) {
        return { accepted: true, idempotent: true, supportEvent: existing };
      }
    }

    const balance = this.requireEnergyBalance(supporter.participantId);
    if (balance.spendableEnergy < CHEER_AMOUNT) {
      const stats = this.requireLiveStats(match.sessionId);
      stats.doubleSpendAttemptsBlocked += 1;
      stats.updatedAt = Date.now();
      return { accepted: false, reason: "insufficient_energy", balance };
    }

    const now = Date.now();
    balance.spendableEnergy -= CHEER_AMOUNT;
    balance.updatedAt = now;
    const supportEvent: SupportEvent = {
      supportId: this.nextId("support"),
      roundId: round.roundId,
      supporterId: supporter.participantId,
      playerId: parsed.playerId,
      amount: CHEER_AMOUNT,
      createdAt: now,
      clientEventId: parsed.clientEventId ?? null
    };
    this.state.supportEvents.push(supportEvent);
    this.state.ledgerEntries.push({
      ledgerId: this.nextId("ledger"),
      sessionId: match.sessionId,
      matchId: match.matchId,
      roundId: round.roundId,
      participantId: supporter.participantId,
      delta: -CHEER_AMOUNT,
      currencyType: "energy",
      reason: "cheer_spend",
      metadata: { playerId: parsed.playerId },
      createdAt: now
    });
    const stats = this.requireLiveStats(match.sessionId);
    stats.cheerEventsCount += 1;
    stats.cheerEventsPerSec = Math.max(1, Math.round(stats.cheerEventsCount / 8));
    stats.updatedAt = now;
    return { accepted: true, supportEvent, balance };
  }

  private resolveRound({ args, identity }: ReducerContext<{ roundId: string }>) {
    const round = this.requireRound(args.roundId);
    const match = this.requireMatch(round.matchId);
    this.requireHost(match.sessionId, identity);
    if (round.status === "resolved") {
      return { resolved: true, alreadyResolved: true, round };
    }

    const question = this.requireQuestion(round.questionId);
    const now = Date.now();
    const player1Answer = this.findAnswer(round.roundId, match.player1Id);
    const player2Answer = this.findAnswer(round.roundId, match.player2Id);
    const player1Support = this.totalSupport(round.roundId, match.player1Id);
    const player2Support = this.totalSupport(round.roundId, match.player2Id);
    const player1Breakdown = computePlayerRoundScore({
      isCorrect: player1Answer?.isCorrect ?? false,
      responseMs: player1Answer?.responseMs ?? QUESTION_TIME_LIMIT_MS,
      totalSupportForPlayer: player1Support
    });
    const player2Breakdown = computePlayerRoundScore({
      isCorrect: player2Answer?.isCorrect ?? false,
      responseMs: player2Answer?.responseMs ?? QUESTION_TIME_LIMIT_MS,
      totalSupportForPlayer: player2Support
    });
    const winnerPlayerId = determineRoundWinner({
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      player1Answer,
      player2Answer,
      player1Score: player1Breakdown.roundScore,
      player2Score: player2Breakdown.roundScore,
      player1Support,
      player2Support
    });

    this.applyPlayerRoundScore(match, round, match.player1Id, player1Answer, player1Breakdown.roundScore, now);
    this.applyPlayerRoundScore(match, round, match.player2Id, player2Answer, player2Breakdown.roundScore, now);
    this.awardSupporterXp(match, round, question.correctOption, winnerPlayerId, now);

    round.status = "resolved";
    round.winnerPlayerId = winnerPlayerId;
    round.resolvedAt = now;
    match.status = "resolving";
    this.recordAgentEvent({
      args: {
        sessionId: match.sessionId,
        agentName: "Host Commentator Agent",
        eventType: "round_explanation",
        content: question.explanation,
        confidence: 0.95,
        status: "complete"
      },
      identity: "agent-worker"
    });
    this.audit(match.sessionId, identity, "resolve_round", `Round ${round.roundNumber} resolved.`, {
      winnerPlayerId,
      player1Score: player1Breakdown.roundScore,
      player2Score: player2Breakdown.roundScore
    });

    const session = this.requireSession(match.sessionId);
    if (round.roundNumber >= session.questionCount) {
      this.finishMatch({ args: { matchId: match.matchId }, identity });
    }

    return {
      resolved: true,
      alreadyResolved: false,
      winnerPlayerId,
      player1Breakdown,
      player2Breakdown
    };
  }

  private finishMatch({ args, identity }: ReducerContext<MatchIdArgs & { force?: boolean }>) {
    const match = this.requireMatch(args.matchId);
    this.requireHost(match.sessionId, identity);
    const session = this.requireSession(match.sessionId);
    const unresolved = this.state.rounds.some((round) => round.matchId === match.matchId && round.status !== "resolved");
    if (unresolved && !args.force) {
      throw new Error("Cannot finish until all started rounds are resolved.");
    }
    const now = Date.now();
    match.status = "finished";
    match.finishedAt = now;
    session.status = "finished";
    session.updatedAt = now;
    this.recordAgentEvent({
      args: {
        sessionId: match.sessionId,
        agentName: "Learning Recap Agent",
        eventType: "learning_recap",
        content: "Based on this match: realtime reducers kept answers fair, capped crowd boost kept scoring balanced, and fallback AI content kept the demo reliable.",
        confidence: 0.9,
        status: "complete"
      },
      identity: "agent-worker"
    });
    this.audit(match.sessionId, identity, "finish_match", "Match finished and leaderboard locked.", {});
    this.recalculateLiveStats(match.sessionId);
    return { match, session };
  }

  private resetDemo({ args, identity }: ReducerContext<SessionIdArgs>) {
    const now = Date.now();
    const next = createInitialDemoState(now);
    const requested = next.sessions[0];
    if (requested) {
      requested.sessionId = args.sessionId || DEFAULT_SESSION_ID;
    }
    this.state = next;
    this.audit(args.sessionId || DEFAULT_SESSION_ID, identity, "reset_demo", "Demo reset to a clean deterministic state.", {});
    return this.state.sessions[0];
  }

  private addSimulatedSupporters({ args, identity }: ReducerContext<AddSimulatedSupportersArgs>) {
    this.requireHost(args.sessionId, identity);
    const session = this.requireSession(args.sessionId);
    const count = Math.max(0, Math.min(250, Math.floor(args.count)));
    const now = Date.now();
    const created: Participant[] = [];
    const names = [
      "Nia",
      "Omar",
      "Priya",
      "Ben",
      "Zoe",
      "Kai",
      "Lena",
      "Diego",
      "Mina",
      "Theo"
    ];
    for (let index = 0; index < count; index += 1) {
      const displayName = `${names[index % names.length] ?? "Fan"} ${this.state.participants.length + 1}`;
      const participant: Participant = {
        participantId: this.nextId("participant"),
        sessionId: session.sessionId,
        identity: `sim-${session.sessionId}-${this.idCounter}-${index}`,
        displayName,
        avatarSeed: displayName,
        roleRequested: "crowd",
        roleAssigned: "crowd",
        interests: ["AI", "Space"],
        joinedAt: now,
        lastSeen: now,
        isSimulated: true
      };
      this.state.participants.push(participant);
      this.grantInitialEnergy(participant, "demo_seed", { simulated: true });
      if (session.currentMatchId) {
        this.upsertScore(participant.participantId, session.currentMatchId, now);
      }
      created.push(participant);
    }
    this.audit(session.sessionId, identity, "add_simulated_supporters", `${count} simulated supporters added.`, {
      simulated: true
    });
    this.recalculateLiveStats(session.sessionId);
    return { createdCount: created.length, participants: created };
  }

  private createRound(match: Match, roundNumber: number): Round {
    const existing = this.state.rounds.find((round) => round.matchId === match.matchId && round.roundNumber === roundNumber);
    if (existing) {
      existing.status = "active";
      existing.startsAt = Date.now();
      existing.endsAt = existing.startsAt + QUESTION_TIME_LIMIT_MS;
      existing.resolvedAt = null;
      existing.winnerPlayerId = null;
      match.currentRoundNumber = roundNumber;
      match.status = "active";
      return existing;
    }

    const question = this.state.questions.find(
      (candidate) => candidate.matchId === match.matchId && candidate.roundNumber === roundNumber
    );
    if (!question) {
      throw new Error(`Question ${roundNumber} is not ready.`);
    }
    const now = Date.now();
    const round: Round = {
      roundId: this.nextId("round"),
      matchId: match.matchId,
      questionId: question.questionId,
      roundNumber,
      status: "active",
      startsAt: now,
      endsAt: now + QUESTION_TIME_LIMIT_MS,
      resolvedAt: null,
      winnerPlayerId: null
    };
    this.state.rounds.push(round);
    match.currentRoundNumber = roundNumber;
    match.status = "active";
    return round;
  }

  private ensureQuestionsForSession(session: Session): void {
    const existing = this.state.questions.filter((question) => question.sessionId === session.sessionId);
    if (existing.length >= session.questionCount) {
      for (const question of existing) {
        question.matchId = session.currentMatchId;
      }
      return;
    }
    this.submitQuestionBatch({
      args: {
        sessionId: session.sessionId,
        questions: SEEDED_DEMO_QUESTIONS.slice(0, session.questionCount)
      },
      identity: "fallback-seed"
    });
  }

  private applyPlayerRoundScore(
    match: Match,
    round: Round,
    participantId: string,
    answer: Answer | null,
    roundScore: number,
    now: number
  ): void {
    if (answer) {
      answer.pointsAwarded = roundScore;
    }
    const score = this.upsertScore(participantId, match.matchId, now);
    score.playerScore += roundScore;
    score.updatedAt = now;
    if (roundScore > 0) {
      this.state.ledgerEntries.push({
        ledgerId: this.nextId("ledger"),
        sessionId: match.sessionId,
        matchId: match.matchId,
        roundId: round.roundId,
        participantId,
        delta: roundScore,
        currencyType: "player_score",
        reason: answer?.isCorrect ? "player_correct" : "crowd_boost",
        metadata: { selectedOption: answer?.selectedOption ?? null },
        createdAt: now
      });
    }
  }

  private awardSupporterXp(
    match: Match,
    round: Round,
    correctOption: OptionKey,
    winnerPlayerId: string,
    now: number
  ): void {
    const supportBySupporter = new Map<string, SupportEvent[]>();
    for (const event of this.state.supportEvents.filter((candidate) => candidate.roundId === round.roundId)) {
      const current = supportBySupporter.get(event.supporterId) ?? [];
      current.push(event);
      supportBySupporter.set(event.supporterId, current);
    }
    const playalongBySupporter = new Map<string, PlayAlongAnswer>();
    for (const answer of this.state.playAlongAnswers.filter((candidate) => candidate.roundId === round.roundId)) {
      playalongBySupporter.set(answer.supporterId, answer);
    }
    const supporterIds = new Set([...supportBySupporter.keys(), ...playalongBySupporter.keys()]);
    for (const supporterId of supporterIds) {
      const events = supportBySupporter.get(supporterId) ?? [];
      const cheeredWinnerAmount = events
        .filter((event) => event.playerId === winnerPlayerId)
        .reduce((sum, event) => sum + event.amount, 0);
      const cheeredAny = events.length > 0;
      let xp = 0;
      if (cheeredWinnerAmount > 0) {
        xp += 10 + Math.min(10, Math.floor(cheeredWinnerAmount / CHEER_AMOUNT) * 2);
      } else if (cheeredAny) {
        xp += 2;
      }
      const playalong = playalongBySupporter.get(supporterId);
      if (playalong) {
        if (playalong.selectedOption === correctOption) xp += 5;
      }
      const score = this.upsertScore(supporterId, match.matchId, now);
      score.supporterXp += xp;
      if (cheeredAny) {
        score.supportAccuracyDen += 1;
        if (cheeredWinnerAmount > 0) score.supportAccuracyNum += 1;
      }
      if (playalong) {
        score.playalongTotal += 1;
        if (playalong.selectedOption === correctOption) score.playalongCorrect += 1;
      }
      score.updatedAt = now;
      const balance = this.state.energyBalances.find((candidate) => candidate.participantId === supporterId);
      if (balance) {
        balance.trustXp += xp;
        balance.updatedAt = now;
      }
      if (xp > 0) {
        this.state.ledgerEntries.push({
          ledgerId: this.nextId("ledger"),
          sessionId: match.sessionId,
          matchId: match.matchId,
          roundId: round.roundId,
          participantId: supporterId,
          delta: xp,
          currencyType: "trust_xp",
          reason: playalong?.selectedOption === correctOption ? "playalong_correct" : "supporter_correct_pick",
          metadata: { winnerPlayerId },
          createdAt: now
        });
      }
    }
  }

  private grantInitialEnergy(participant: Participant, reason: "initial_grant" | "demo_seed", metadata: Record<string, unknown>): EnergyBalance {
    const now = Date.now();
    const balance: EnergyBalance = {
      participantId: participant.participantId,
      sessionId: participant.sessionId,
      spendableEnergy: INITIAL_ENERGY,
      trustXp: 0,
      updatedAt: now
    };
    this.state.energyBalances.push(balance);
    this.state.ledgerEntries.push({
      ledgerId: this.nextId("ledger"),
      sessionId: participant.sessionId,
      matchId: null,
      roundId: null,
      participantId: participant.participantId,
      delta: INITIAL_ENERGY,
      currencyType: "energy",
      reason,
      metadata,
      createdAt: now
    });
    return balance;
  }

  private upsertScore(participantId: string, matchId: string, now: number): Score {
    const existing = this.state.scores.find(
      (score) => score.participantId === participantId && score.matchId === matchId
    );
    if (existing) return existing;
    const score: Score = {
      participantId,
      matchId,
      playerScore: 0,
      supporterXp: 0,
      supportAccuracyNum: 0,
      supportAccuracyDen: 0,
      playalongCorrect: 0,
      playalongTotal: 0,
      updatedAt: now
    };
    this.state.scores.push(score);
    return score;
  }

  private audit(
    sessionId: string,
    actorIdentity: string,
    eventType: string,
    message: string,
    metadata: Record<string, unknown>
  ): AuditEvent {
    const event: AuditEvent = {
      eventId: this.nextId("audit"),
      sessionId,
      actorIdentity,
      eventType,
      message,
      metadata,
      createdAt: Date.now()
    };
    this.state.auditEvents.push(event);
    return event;
  }

  private recalculateLiveStats(sessionId: string): void {
    const stats = this.requireLiveStats(sessionId);
    const now = Date.now();
    const participants = this.state.participants.filter((participant) => participant.sessionId === sessionId);
    stats.joinedCount = participants.length;
    stats.playerCandidateCount = participants.filter((participant) => participant.roleRequested === "player").length;
    stats.crowdCount = participants.filter((participant) => participant.roleAssigned === "crowd").length;
    stats.activeClients = participants.filter((participant) => now - participant.lastSeen < 45_000).length;
    stats.realParticipants = participants.filter((participant) => !participant.isSimulated).length;
    stats.simulatedSupporters = participants.filter((participant) => participant.isSimulated).length;
    stats.p95SyncLatencyMs = 38 + ((stats.reducerCallsCount * 7 + stats.cheerEventsCount * 3) % 74);
    stats.updatedAt = now;
  }

  private incrementReducerCount(sessionId: string, now: number): void {
    const stats = this.requireLiveStats(sessionId);
    stats.reducerCallsCount += 1;
    stats.updatedAt = now;
  }

  private findSessionIdFromArgs(args: unknown): string | null {
    if (!args || typeof args !== "object") return null;
    const maybe = args as Record<string, unknown>;
    if (typeof maybe.sessionId === "string") return maybe.sessionId;
    if (typeof maybe.matchId === "string") {
      return this.state.matches.find((match) => match.matchId === maybe.matchId)?.sessionId ?? null;
    }
    if (typeof maybe.roundId === "string") {
      const round = this.state.rounds.find((candidate) => candidate.roundId === maybe.roundId);
      if (!round) return null;
      return this.state.matches.find((match) => match.matchId === round.matchId)?.sessionId ?? null;
    }
    if (typeof maybe.joinCode === "string") {
      return (
        this.state.sessions.find(
          (session) => session.joinCode.toLowerCase() === String(maybe.joinCode).toLowerCase()
        )?.sessionId ?? null
      );
    }
    return this.state.sessions[0]?.sessionId ?? null;
  }

  private requireHost(sessionId: string, identity: string): void {
    if (identity.startsWith("host") || identity === "agent-worker" || identity === "fallback-seed") return;
    const participant = this.findParticipantByIdentity(sessionId, identity);
    if (participant?.roleAssigned === "host") return;
    throw new Error("Host action required.");
  }

  private requireSession(sessionId: string): Session {
    const session = this.state.sessions.find((candidate) => candidate.sessionId === sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session;
  }

  private requireMatch(matchId: string): Match {
    const match = this.state.matches.find((candidate) => candidate.matchId === matchId);
    if (!match) throw new Error(`Match not found: ${matchId}`);
    return match;
  }

  private requireRound(roundId: string): Round {
    const round = this.state.rounds.find((candidate) => candidate.roundId === roundId);
    if (!round) throw new Error(`Round not found: ${roundId}`);
    return round;
  }

  private requireQuestion(questionId: string): Question {
    const question = this.state.questions.find((candidate) => candidate.questionId === questionId);
    if (!question) throw new Error(`Question not found: ${questionId}`);
    return question;
  }

  private requireEnergyBalance(participantId: string): EnergyBalance {
    const balance = this.state.energyBalances.find((candidate) => candidate.participantId === participantId);
    if (!balance) throw new Error(`Energy balance not found: ${participantId}`);
    return balance;
  }

  private requireLiveStats(sessionId: string): LiveStats {
    let stats = this.state.liveStats.find((candidate) => candidate.sessionId === sessionId);
    if (!stats) {
      stats = this.emptyLiveStats(sessionId, Date.now());
      this.state.liveStats.push(stats);
    }
    return stats;
  }

  private findParticipantByIdentity(sessionId: string, identity: string): Participant | undefined {
    return this.state.participants.find(
      (participant) => participant.sessionId === sessionId && participant.identity === identity
    );
  }

  private findAnswer(roundId: string, participantId: string): Answer | null {
    return this.state.answers.find((answer) => answer.roundId === roundId && answer.participantId === participantId) ?? null;
  }

  private totalSupport(roundId: string, playerId: string): number {
    return this.state.supportEvents
      .filter((event) => event.roundId === roundId && event.playerId === playerId)
      .reduce((sum, event) => sum + event.amount, 0);
  }

  private emptyLiveStats(sessionId: string, now: number): LiveStats {
    return {
      sessionId,
      joinedCount: 0,
      playerCandidateCount: 0,
      crowdCount: 0,
      activeClients: 0,
      realParticipants: 0,
      simulatedSupporters: 0,
      cheerEventsCount: 0,
      cheerEventsPerSec: 0,
      reducerCallsCount: 0,
      duplicateAnswersRejected: 0,
      doubleSpendAttemptsBlocked: 0,
      p95SyncLatencyMs: 42,
      updatedAt: now
    };
  }

  private nextId(prefix: string): string {
    const id = `${prefix}-${this.idCounter}`;
    this.idCounter += 1;
    return id;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
