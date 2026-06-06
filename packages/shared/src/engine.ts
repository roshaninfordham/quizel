import {
  DEFAULT_SELECTED_TOPIC,
  DEFAULT_SESSION_CODE,
  DEFAULT_SESSION_ID,
  DEFAULT_TOPICS,
  QUESTION_COUNT,
  QUESTION_TIME_LIMIT_MS,
  SIMULATED_ANSWER_BURST_SIZE,
  TOTAL_MATCH_SECONDS
} from "./constants";
import { questionBatchSchema, selectedOptionSchema } from "./schemas";
import { computeAnswerScore, compareScores } from "./scoring";
import { SEEDED_DEMO_QUESTIONS } from "./demoQuestions";
import type {
  AgentEvent,
  AgentRequest,
  Answer,
  AuditEvent,
  LiveStats,
  MatchEvent,
  MatchEventType,
  OptionKey,
  Participant,
  Question,
  QuestionInput,
  QuizRushState,
  ReducerReceipt,
  Round,
  Score,
  Session,
  TopicVote
} from "./types";

type Listener = (state: QuizRushState, stateVersion: number) => void;

interface ReducerContext<TArgs> {
  args: TArgs;
  identity: string;
}

export class QuizRushEngine {
  private state: QuizRushState;
  private listeners = new Set<Listener>();
  private counters = new Map<string, number>();
  public stateVersion = 0;

  public constructor(seedDemo = true) {
    this.state = emptyState();
    if (seedDemo) {
      this.seedSession();
    }
  }

  public getSnapshot(): QuizRushState {
    return structuredClone(this.state);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public callReducer<T = unknown>(reducer: string, args: unknown, identity = "anonymous-device"): ReducerReceipt<T> {
    const started = Date.now();
    try {
      const data = this.dispatch(reducer, { args, identity } as ReducerContext<unknown>) as T;
      const sessionId = sessionIdFromArgs(args) ?? sessionIdFromResult(data);
      if (sessionId) this.incrementReducerCount(sessionId, started);
      this.stateVersion += 1;
      this.notify();
      return { ok: true, reducer, data, stateVersion: this.stateVersion, serverTime: Date.now() };
    } catch (error) {
      const sessionId = sessionIdFromArgs(args);
      if (sessionId) {
        const stats = this.state.liveStats.find((candidate) => candidate.sessionId === sessionId);
        if (stats && String(error instanceof Error ? error.message : error).toLowerCase().includes("duplicate")) {
          stats.duplicateAnswersRejected += 1;
          stats.updatedAt = Date.now();
        }
      }
      this.stateVersion += 1;
      this.notify();
      return {
        ok: false,
        reducer,
        error: error instanceof Error ? error.message : String(error),
        stateVersion: this.stateVersion,
        serverTime: Date.now()
      };
    }
  }

  private dispatch(reducer: string, context: ReducerContext<unknown>): unknown {
    switch (reducer) {
      case "create_session":
        return this.createSession(context as ReducerContext<{ code?: string; questionCount?: number }>);
      case "join_session":
        return this.joinSession(context as ReducerContext<{ code?: string; joinCode?: string; displayName: string; avatar: string }>);
      case "submit_topic_vote":
        return this.submitTopicVote(context as ReducerContext<{ sessionId: string; topics: string[] }>);
      case "request_questions":
        return this.requestQuestions(context as ReducerContext<{ sessionId: string; topic?: string; questionCount?: number }>);
      case "submit_question_pack":
      case "submit_question_batch":
        return this.submitQuestionPack(
          context as ReducerContext<{
            sessionId: string;
            selectedTopic?: string;
            requestId?: string;
            questions?: QuestionInput[];
            questionsJson?: string;
          }>
        );
      case "start_match":
        return this.startMatch(context as ReducerContext<{ sessionId: string }>);
      case "start_round":
        return this.startRound(context as ReducerContext<{ sessionId: string; questionOrder: number }>);
      case "submit_answer":
        return this.submitAnswer(context as ReducerContext<{ roundId: string; selectedOption: OptionKey; clientSentAt?: number }>);
      case "resolve_round":
        return this.resolveRound(context as ReducerContext<{ roundId: string }>);
      case "finish_match":
        return this.finishMatch(context as ReducerContext<{ sessionId: string; force?: boolean }>);
      case "heartbeat":
        return this.heartbeat(context as ReducerContext<{ sessionId: string; clientLatencyMs?: number }>);
      case "live_tick":
        return this.liveTick(context as ReducerContext<{ sessionId: string }>);
      case "reset_demo":
        return this.resetDemo(context as ReducerContext<{ sessionId?: string }>);
      case "add_simulated_players":
        return this.addSimulatedPlayers(context as ReducerContext<{ sessionId: string; count: number }>);
      case "simulate_answer_burst":
        return this.simulateAnswerBurst(context as ReducerContext<{ sessionId: string; count?: number }>);
      case "record_agent_event":
        return this.recordAgentEvent(context as ReducerContext<Partial<AgentEvent> & { sessionId: string }>);
      default:
        throw new Error(`Unknown reducer: ${reducer}`);
    }
  }

  private createSession({ args, identity }: ReducerContext<{ code?: string; questionCount?: number }>): Session {
    const now = Date.now();
    this.state = emptyState();
    const session: Session = {
      sessionId: DEFAULT_SESSION_ID,
      code: args.code ?? DEFAULT_SESSION_CODE,
      status: "lobby",
      selectedTopic: null,
      questionCount: args.questionCount ?? QUESTION_COUNT,
      currentRound: 0,
      matchStartedAt: null,
      matchFinishedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.state.sessions.push(session);
    this.state.liveStats.push(emptyStats(session.sessionId, now));
    this.recordAgentEvent({
      args: {
        sessionId: session.sessionId,
        agentName: "Seed Fallback Provider",
        eventType: "fallback_ready",
        content: "Five deterministic backup questions are ready if the LLM is unavailable.",
        confidence: 1,
        status: "complete"
      },
      identity
    });
    this.audit(session.sessionId, identity, "create_session", `Session ${session.code} created.`);
    return session;
  }

  private joinSession({
    args,
    identity
  }: ReducerContext<{ code?: string; joinCode?: string; displayName: string; avatar: string }>): { participant: Participant; score: Score } {
    const session = this.requireSessionByCode(args.code ?? args.joinCode ?? DEFAULT_SESSION_CODE);
    if (!["lobby", "topic_voting", "generating", "ready"].includes(session.status)) {
      throw new Error("This tournament is already in progress.");
    }

    const now = Date.now();
    const existing = this.state.participants.find(
      (participant) => participant.sessionId === session.sessionId && participant.identity === identity
    );
    if (existing) {
      existing.displayName = cleanName(args.displayName);
      existing.avatar = args.avatar;
      existing.lastSeen = now;
      const score = this.requireScore(session.sessionId, existing.participantId);
      return { participant: existing, score };
    }

    const participant: Participant = {
      participantId: this.nextId("participant"),
      sessionId: session.sessionId,
      identity,
      displayName: cleanName(args.displayName),
      avatar: args.avatar || "🚀",
      joinedAt: now,
      lastSeen: now,
      isSimulated: false,
      clientLatencyMs: null
    };
    this.state.participants.push(participant);
    const score = this.createScore(session.sessionId, participant.participantId, now);
    if (session.status === "lobby") session.status = "topic_voting";
    session.updatedAt = now;
    this.matchEvent(session.sessionId, participant.participantId, "join", null, null, null, {
      displayName: participant.displayName,
      avatar: participant.avatar
    });
    this.audit(session.sessionId, identity, "join_session", `${participant.displayName} joined QuizRush.`);
    this.recalculateStats(session.sessionId);
    return { participant, score };
  }

  private submitTopicVote({ args, identity }: ReducerContext<{ sessionId: string; topics: string[] }>): TopicVote[] {
    const session = this.requireSession(args.sessionId);
    const participant = this.requireParticipantForIdentity(session.sessionId, identity);
    const topics = Array.from(new Set(args.topics.map((topic) => topic.trim()).filter(Boolean))).slice(0, 3);
    if (topics.length === 0) throw new Error("Pick at least one topic.");
    const now = Date.now();
    this.state.topicVotes = this.state.topicVotes.filter((vote) => vote.participantId !== participant.participantId);
    const inserted = topics.map<TopicVote>((topic) => ({
      voteId: this.nextId("topic-vote"),
      sessionId: session.sessionId,
      participantId: participant.participantId,
      topic,
      createdAt: now
    }));
    this.state.topicVotes.push(...inserted);
    if (session.status === "lobby") session.status = "topic_voting";
    session.updatedAt = now;
    this.matchEvent(session.sessionId, participant.participantId, "topic_vote", null, null, null, { topics });
    return inserted;
  }

  private requestQuestions({ args, identity }: ReducerContext<{ sessionId: string; topic?: string; questionCount?: number }>): AgentRequest {
    const session = this.requireSession(args.sessionId);
    const now = Date.now();
    const topic = args.topic?.trim() || selectedTopicFromVotes(this.state.topicVotes.filter((vote) => vote.sessionId === session.sessionId));
    session.status = "generating";
    session.selectedTopic = topic;
    session.questionCount = args.questionCount ?? QUESTION_COUNT;
    session.updatedAt = now;
    const request: AgentRequest = {
      requestId: this.nextId("agent-request"),
      sessionId: session.sessionId,
      requestType: "quiz_generation",
      topic,
      questionCount: session.questionCount,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      errorMessage: null
    };
    this.state.agentRequests.push(request);
    this.recordAgentEvent({
      args: {
        sessionId: session.sessionId,
        agentName: "Topic Router Agent",
        eventType: "topic_selected",
        content: `Selected ${topic} from live room intent.`,
        confidence: 0.88,
        status: "complete"
      },
      identity
    });
    this.matchEvent(session.sessionId, null, "questions_requested", null, null, null, { topic });
    return request;
  }

  private submitQuestionPack({
    args,
    identity
  }: ReducerContext<{ sessionId: string; selectedTopic?: string; requestId?: string; questions?: QuestionInput[]; questionsJson?: string }>): Question[] {
    const session = this.requireSession(args.sessionId);
    if (args.requestId) {
      const request = this.state.agentRequests.find(
        (candidate) => candidate.requestId === args.requestId && candidate.sessionId === session.sessionId
      );
      if (!request || request.status !== "pending") {
        this.recordAgentEvent({
          args: {
            sessionId: session.sessionId,
            agentName: "Match Engine",
            eventType: "stale_question_pack_ignored",
            content: "A question pack from an older generation request arrived after reset and was ignored.",
            confidence: 1,
            status: "complete"
          },
          identity
        });
        return this.state.questions.filter((question) => question.sessionId === session.sessionId);
      }
    }
    if ((session.status === "playing" || session.status === "finished" || session.status === "replay") && this.state.questions.some((question) => question.sessionId === session.sessionId)) {
      if (args.requestId) {
        const request = this.state.agentRequests.find((candidate) => candidate.requestId === args.requestId);
        if (request) {
          request.status = "complete";
          request.updatedAt = Date.now();
        }
      }
      this.recordAgentEvent({
        args: {
          sessionId: session.sessionId,
          agentName: "Match Engine",
          eventType: "late_question_pack_ignored",
          content: "A late question pack arrived after the race had started, so the live match kept its locked question set.",
          confidence: 1,
          status: "complete"
        },
        identity
      });
      return this.state.questions.filter((question) => question.sessionId === session.sessionId);
    }
    const payload = args.questionsJson ? JSON.parse(args.questionsJson) : { questions: args.questions };
    const parsed = questionBatchSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("Malformed question pack rejected by schema validation.");
    }

    const now = Date.now();
    const topic = args.selectedTopic ?? session.selectedTopic ?? DEFAULT_SELECTED_TOPIC;
    this.state.questions = this.state.questions.filter((question) => question.sessionId !== session.sessionId);
    this.state.rounds = this.state.rounds.filter((round) => round.sessionId !== session.sessionId);
    const inserted = parsed.data.questions.slice(0, session.questionCount).map<Question>((question, index) => ({
      questionId: this.nextId("question"),
      sessionId: session.sessionId,
      orderIndex: index + 1,
      questionText: question.questionText,
      optionA: question.options.A,
      optionB: question.options.B,
      optionC: question.options.C,
      optionD: question.options.D,
      correctOption: question.correctOption,
      explanation: question.explanation,
      topic: question.topic || topic,
      generatedBy: identity === "agent-worker" ? "Quiz Builder Agent" : "Seed Fallback Provider",
      fairnessStatus: identity === "agent-worker" ? "approved" : "fallback",
      createdAt: now
    }));
    this.state.questions.push(...inserted);
    session.selectedTopic = topic;
    session.status = inserted.length >= session.questionCount ? "ready" : "generating";
    session.updatedAt = now;
    if (args.requestId) {
      const request = this.state.agentRequests.find((candidate) => candidate.requestId === args.requestId);
      if (request) {
        request.status = identity === "agent-worker" ? "complete" : "fallback";
        request.updatedAt = now;
      }
    }
    this.recordAgentEvent({
      args: {
        sessionId: session.sessionId,
        agentName: "Match Engine",
        eventType: "questions_ready",
        content: `${inserted.length} questions are ready for a 25-second race.`,
        confidence: 1,
        status: identity === "agent-worker" ? "complete" : "fallback"
      },
      identity
    });
    return inserted;
  }

  private startMatch({ args }: ReducerContext<{ sessionId: string }>): Round {
    const session = this.requireSession(args.sessionId);
    if (!this.state.participants.some((participant) => participant.sessionId === session.sessionId)) {
      throw new Error("At least one participant must join before the match starts.");
    }
    if (this.state.questions.filter((question) => question.sessionId === session.sessionId).length < session.questionCount) {
      this.submitQuestionPack({
        args: {
          sessionId: session.sessionId,
          selectedTopic: session.selectedTopic ?? DEFAULT_SELECTED_TOPIC,
          questions: SEEDED_DEMO_QUESTIONS
        },
        identity: "seed-fallback"
      });
    }
    const now = Date.now();
    session.status = "playing";
    session.currentRound = 1;
    session.matchStartedAt = now;
    session.matchFinishedAt = null;
    session.updatedAt = now;
    this.state.answers = this.state.answers.filter((answer) => answer.sessionId !== session.sessionId);
    for (const score of this.state.scores.filter((score) => score.sessionId === session.sessionId)) {
      score.totalScore = 0;
      score.correctCount = 0;
      score.totalResponseMs = 0;
      score.fastestResponseMs = null;
      score.currentRank = 1;
      score.previousRank = 1;
      score.lastAnswerAt = null;
      score.updatedAt = now;
    }
    this.recomputeRanks(session.sessionId, now);
    return this.startRound({ args: { sessionId: session.sessionId, questionOrder: 1 }, identity: "match-engine" });
  }

  private startRound({ args }: ReducerContext<{ sessionId: string; questionOrder: number }>): Round {
    const session = this.requireSession(args.sessionId);
    const question = this.requireQuestionByOrder(session.sessionId, args.questionOrder);
    const now = Date.now();
    const matchStartedAt = session.matchStartedAt ?? now;
    const matchDeadline = matchStartedAt + TOTAL_MATCH_SECONDS * 1000;
    const startsAt = Math.min(Math.max(now, matchStartedAt), matchDeadline);
    const endsAt = Math.min(startsAt + QUESTION_TIME_LIMIT_MS, matchDeadline);
    for (const round of this.state.rounds.filter((round) => round.sessionId === session.sessionId && round.status === "active")) {
      round.status = "resolved";
      round.resolvedAt = now;
    }
    let round = this.state.rounds.find((candidate) => candidate.sessionId === session.sessionId && candidate.orderIndex === args.questionOrder);
    if (!round) {
      round = {
        roundId: this.nextId("round"),
        sessionId: session.sessionId,
        questionId: question.questionId,
        orderIndex: args.questionOrder,
        status: "active",
        startsAt,
        endsAt,
        resolvedAt: null
      };
      this.state.rounds.push(round);
    } else {
      round.status = "active";
      round.startsAt = startsAt;
      round.endsAt = endsAt;
      round.resolvedAt = null;
    }
    session.status = "playing";
    session.currentRound = args.questionOrder;
    session.updatedAt = now;
    this.matchEvent(session.sessionId, null, "question_start", args.questionOrder, null, null, { questionId: question.questionId });
    return round;
  }

  private submitAnswer({ args, identity }: ReducerContext<{ roundId: string; selectedOption: OptionKey; clientSentAt?: number }>): Answer {
    const parsed = selectedOptionSchema.safeParse(args);
    if (!parsed.success) throw new Error("Malformed answer.");
    const round = this.requireRound(args.roundId);
    if (round.status !== "active") throw new Error("Round is not active.");
    const participant = this.requireParticipantForIdentity(round.sessionId, identity);
    if (this.state.answers.some((answer) => answer.roundId === round.roundId && answer.participantId === participant.participantId)) {
      const stats = this.state.liveStats.find((candidate) => candidate.sessionId === round.sessionId);
      if (stats) {
        stats.duplicateAnswersRejected += 1;
        stats.updatedAt = Date.now();
      }
      throw new Error("Duplicate answer rejected.");
    }
    const question = this.requireQuestion(round.questionId);
    const now = Date.now();
    if (now > round.endsAt) throw new Error("Round has ended.");
    const responseMs = Math.max(0, Math.min(now - round.startsAt, QUESTION_TIME_LIMIT_MS));
    const isCorrect = args.selectedOption === question.correctOption;
    const scoreDelta = computeAnswerScore({ isCorrect, responseMs });
    const answer: Answer = {
      answerId: this.nextId("answer"),
      sessionId: round.sessionId,
      roundId: round.roundId,
      participantId: participant.participantId,
      selectedOption: args.selectedOption,
      isCorrect,
      responseMs,
      scoreDelta,
      serverReceivedAt: now
    };
    this.state.answers.push(answer);
    const score = this.requireScore(round.sessionId, participant.participantId);
    score.totalScore += scoreDelta;
    score.correctCount += isCorrect ? 1 : 0;
    score.totalResponseMs += responseMs;
    score.fastestResponseMs = score.fastestResponseMs === null ? responseMs : Math.min(score.fastestResponseMs, responseMs);
    score.lastAnswerAt = now;
    score.updatedAt = now;
    this.recomputeRanks(round.sessionId, now);
    this.matchEvent(round.sessionId, participant.participantId, "answer", round.orderIndex, score.totalScore, score.currentRank, {
      selectedOption: args.selectedOption,
      isCorrect,
      responseMs
    });
    this.matchEvent(round.sessionId, participant.participantId, "score_delta", round.orderIndex, score.totalScore, score.currentRank, {
      scoreDelta
    });
    this.recalculateStats(round.sessionId);
    return answer;
  }

  private resolveRound({ args }: ReducerContext<{ roundId: string }>): Round {
    const round = this.requireRound(args.roundId);
    if (round.status === "resolved") return round;
    const now = Date.now();
    round.status = "resolved";
    round.resolvedAt = now;
    this.matchEvent(round.sessionId, null, "round_resolved", round.orderIndex, null, null, {});
    const session = this.requireSession(round.sessionId);
    if (round.orderIndex >= session.questionCount) {
      this.finishMatch({ args: { sessionId: session.sessionId }, identity: "match-engine" });
    } else {
      this.startRound({ args: { sessionId: session.sessionId, questionOrder: round.orderIndex + 1 }, identity: "match-engine" });
    }
    return round;
  }

  private finishMatch({ args }: ReducerContext<{ sessionId: string; force?: boolean }>): Session {
    const session = this.requireSession(args.sessionId);
    if (session.status === "finished" || session.status === "replay") return session;
    const now = Date.now();
    for (const round of this.state.rounds.filter((round) => round.sessionId === session.sessionId && round.status === "active")) {
      round.status = "resolved";
      round.resolvedAt = now;
    }
    session.status = "finished";
    session.matchFinishedAt = now;
    session.updatedAt = now;
    const winner = this.state.scores.filter((score) => score.sessionId === session.sessionId).sort(compareScores)[0];
    this.matchEvent(session.sessionId, winner?.participantId ?? null, "match_finished", null, winner?.totalScore ?? null, winner?.currentRank ?? null, {});
    return session;
  }

  private heartbeat({ args, identity }: ReducerContext<{ sessionId: string; clientLatencyMs?: number }>): Participant | null {
    const participant = this.state.participants.find(
      (candidate) => candidate.sessionId === args.sessionId && candidate.identity === identity
    );
    if (!participant) return null;
    participant.lastSeen = Date.now();
    participant.clientLatencyMs = args.clientLatencyMs ?? participant.clientLatencyMs;
    this.recalculateStats(args.sessionId);
    return participant;
  }

  private liveTick({ args }: ReducerContext<{ sessionId: string }>): LiveStats {
    this.recalculateStats(args.sessionId);
    const stats = this.state.liveStats.find((candidate) => candidate.sessionId === args.sessionId);
    if (!stats) throw new Error(`LiveStats not found: ${args.sessionId}`);
    return stats;
  }

  private resetDemo({ args }: ReducerContext<{ sessionId?: string }>): Session {
    this.state = emptyState();
    return this.seedSession(args.sessionId);
  }

  private addSimulatedPlayers({ args }: ReducerContext<{ sessionId: string; count: number }>): Participant[] {
    const session = this.requireSession(args.sessionId);
    const now = Date.now();
    const inserted: Participant[] = [];
    const avatars = ["🚀", "🧠", "⚡", "✨", "🔥", "🐯"];
    for (let index = 0; index < Math.max(0, Math.min(args.count, 250)); index += 1) {
      const participant: Participant = {
        participantId: this.nextId("participant"),
        sessionId: session.sessionId,
        identity: `sim-${Date.now()}-${index}`,
        displayName: `Rusher ${this.state.participants.length + 1}`,
        avatar: avatars[index % avatars.length] ?? "🚀",
        joinedAt: now,
        lastSeen: now,
        isSimulated: true,
        clientLatencyMs: 35 + (index % 70)
      };
      this.state.participants.push(participant);
      this.createScore(session.sessionId, participant.participantId, now);
      inserted.push(participant);
      this.matchEvent(session.sessionId, participant.participantId, "join", null, null, null, { simulated: true });
    }
    if (session.status === "lobby") session.status = "topic_voting";
    this.recomputeRanks(session.sessionId, now);
    this.recalculateStats(session.sessionId);
    return inserted;
  }

  private simulateAnswerBurst({ args }: ReducerContext<{ sessionId: string; count?: number }>): Answer[] {
    const session = this.requireSession(args.sessionId);
    if (session.status !== "playing") return [];
    const round = this.state.rounds.find((candidate) => candidate.sessionId === session.sessionId && candidate.status === "active");
    if (!round) return [];
    const question = this.requireQuestion(round.questionId);
    const now = Date.now();
    if (now < round.startsAt || now > round.endsAt + 200) return [];
    const answered = new Set(this.state.answers.filter((answer) => answer.roundId === round.roundId).map((answer) => answer.participantId));
    const candidates = this.state.participants
      .filter((participant) => participant.sessionId === session.sessionId && participant.isSimulated && !answered.has(participant.participantId))
      .sort((a, b) => a.participantId.localeCompare(b.participantId))
      .slice(0, Math.max(0, Math.min(args.count ?? SIMULATED_ANSWER_BURST_SIZE, 32)));
    const inserted: Answer[] = [];
    const wrongOptions: OptionKey[] = ["A", "B", "C", "D"].filter((option) => option !== question.correctOption) as OptionKey[];
    candidates.forEach((participant, index) => {
      const answerTime = now + index;
      const responseMs = Math.max(0, Math.min(answerTime - round.startsAt + (index % 5) * 9, QUESTION_TIME_LIMIT_MS));
      const isCorrect = (index + round.orderIndex + Number(participant.participantId.split("-").at(-1) ?? 0)) % 5 !== 0;
      const selectedOption = isCorrect ? question.correctOption : wrongOptions[index % wrongOptions.length] ?? "A";
      const scoreDelta = computeAnswerScore({ isCorrect, responseMs });
      const answer: Answer = {
        answerId: this.nextId("answer"),
        sessionId: round.sessionId,
        roundId: round.roundId,
        participantId: participant.participantId,
        selectedOption,
        isCorrect,
        responseMs,
        scoreDelta,
        serverReceivedAt: answerTime
      };
      this.state.answers.push(answer);
      const score = this.requireScore(round.sessionId, participant.participantId);
      score.totalScore += scoreDelta;
      score.correctCount += isCorrect ? 1 : 0;
      score.totalResponseMs += responseMs;
      score.fastestResponseMs = score.fastestResponseMs === null ? responseMs : Math.min(score.fastestResponseMs, responseMs);
      score.lastAnswerAt = answerTime;
      score.updatedAt = answerTime;
      this.matchEvent(round.sessionId, participant.participantId, "answer", round.orderIndex, score.totalScore, score.currentRank, {
        selectedOption,
        isCorrect,
        responseMs,
        simulated: true
      });
      this.matchEvent(round.sessionId, participant.participantId, "score_delta", round.orderIndex, score.totalScore, score.currentRank, {
        scoreDelta,
        simulated: true
      });
      inserted.push(answer);
    });
    if (inserted.length) {
      this.recomputeRanks(round.sessionId, now);
      this.recalculateStats(round.sessionId);
    }
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

  private seedSession(sessionId = DEFAULT_SESSION_ID): Session {
    const now = Date.now();
    const session: Session = {
      sessionId,
      code: DEFAULT_SESSION_CODE,
      status: "lobby",
      selectedTopic: null,
      questionCount: QUESTION_COUNT,
      currentRound: 0,
      matchStartedAt: null,
      matchFinishedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.state.sessions.push(session);
    this.state.liveStats.push(emptyStats(session.sessionId, now));
    this.recordAgentEvent({
      args: {
        sessionId: session.sessionId,
        agentName: "Seed Fallback Provider",
        eventType: "fallback_ready",
        content: "Five deterministic backup questions are ready if the LLM is unavailable.",
        confidence: 1,
        status: "complete"
      },
      identity: "system"
    });
    return session;
  }

  private createScore(sessionId: string, participantId: string, now: number): Score {
    const score: Score = {
      scoreId: this.nextId("score"),
      sessionId,
      participantId,
      totalScore: 0,
      correctCount: 0,
      totalResponseMs: 0,
      fastestResponseMs: null,
      currentRank: 1,
      previousRank: 1,
      lastAnswerAt: null,
      updatedAt: now
    };
    this.state.scores.push(score);
    this.recomputeRanks(sessionId, now);
    return score;
  }

  private requireSession(sessionId: string): Session {
    const session = this.state.sessions.find((candidate) => candidate.sessionId === sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session;
  }

  private requireSessionByCode(code: string): Session {
    const session = this.state.sessions.find((candidate) => candidate.code === code || candidate.sessionId === code);
    if (!session) throw new Error(`Session not found: ${code}`);
    return session;
  }

  private requireParticipantForIdentity(sessionId: string, identity: string): Participant {
    const participant = this.state.participants.find(
      (candidate) => candidate.sessionId === sessionId && candidate.identity === identity
    );
    if (!participant) throw new Error("Join the tournament before acting.");
    return participant;
  }

  private requireScore(sessionId: string, participantId: string): Score {
    const score = this.state.scores.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
    if (!score) throw new Error(`Score not found for participant: ${participantId}`);
    return score;
  }

  private requireQuestion(questionId: string): Question {
    const question = this.state.questions.find((candidate) => candidate.questionId === questionId);
    if (!question) throw new Error(`Question not found: ${questionId}`);
    return question;
  }

  private requireQuestionByOrder(sessionId: string, orderIndex: number): Question {
    const question = this.state.questions.find((candidate) => candidate.sessionId === sessionId && candidate.orderIndex === orderIndex);
    if (!question) throw new Error(`Question ${orderIndex} not found.`);
    return question;
  }

  private requireRound(roundId: string): Round {
    const round = this.state.rounds.find((candidate) => candidate.roundId === roundId);
    if (!round) throw new Error(`Round not found: ${roundId}`);
    return round;
  }

  private recomputeRanks(sessionId: string, now: number): void {
    const sorted = this.state.scores.filter((score) => score.sessionId === sessionId).sort(compareScores);
    sorted.forEach((score, index) => {
      const nextRank = index + 1;
      if (score.currentRank !== nextRank) {
        score.previousRank = score.currentRank;
        score.currentRank = nextRank;
        this.matchEvent(sessionId, score.participantId, "rank_change", null, score.totalScore, score.currentRank, {
          previousRank: score.previousRank,
          currentRank: score.currentRank
        });
      } else {
        score.previousRank = score.currentRank;
      }
      score.updatedAt = now;
    });
  }

  private matchEvent(
    sessionId: string,
    participantId: string | null,
    eventType: MatchEventType,
    roundIndex: number | null,
    scoreAfter: number | null,
    rankAfter: number | null,
    payload: Record<string, unknown>
  ): MatchEvent {
    const event: MatchEvent = {
      eventId: this.nextId("match-event"),
      sessionId,
      participantId,
      eventType,
      roundIndex,
      scoreAfter,
      rankAfter,
      payload,
      createdAt: Date.now()
    };
    this.state.matchEvents.push(event);
    return event;
  }

  private audit(sessionId: string, actorIdentity: string | null, eventType: string, message: string): AuditEvent {
    const event: AuditEvent = {
      auditId: this.nextId("audit"),
      sessionId,
      actorIdentity,
      eventType,
      message,
      createdAt: Date.now()
    };
    this.state.auditEvents.push(event);
    return event;
  }

  private recalculateStats(sessionId: string): void {
    const now = Date.now();
    const stats = this.state.liveStats.find((candidate) => candidate.sessionId === sessionId) ?? emptyStats(sessionId, now);
    if (!this.state.liveStats.includes(stats)) this.state.liveStats.push(stats);
    const participants = this.state.participants.filter((participant) => participant.sessionId === sessionId);
    const answers = this.state.answers.filter((answer) => answer.sessionId === sessionId);
    stats.joinedCount = participants.length;
    stats.realJoinedCount = participants.filter((participant) => !participant.isSimulated).length;
    stats.simulatedJoinedCount = participants.filter((participant) => participant.isSimulated).length;
    stats.answersCount = answers.length;
    stats.answersPerSec = answers.filter((answer) => now - answer.serverReceivedAt <= 1000).length;
    stats.activeClients = participants.filter((participant) => now - participant.lastSeen <= 15_000).length;
    const latencies = participants
      .map((participant) => participant.clientLatencyMs)
      .filter((latency): latency is number => typeof latency === "number")
      .sort((a, b) => a - b);
    stats.p95LatencyMs = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0 : 48;
    stats.updatedAt = now;
  }

  private incrementReducerCount(sessionId: string, started: number): void {
    const stats = this.state.liveStats.find((candidate) => candidate.sessionId === sessionId);
    if (!stats) return;
    stats.reducerCalls += 1;
    stats.p95LatencyMs = Math.max(24, Math.min(220, stats.p95LatencyMs || Date.now() - started));
    stats.updatedAt = Date.now();
  }

  private nextId(prefix: string): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}-${next}`;
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot, this.stateVersion);
  }
}


function emptyState(): QuizRushState {
  return {
    sessions: [],
    participants: [],
    topicVotes: [],
    questions: [],
    rounds: [],
    answers: [],
    scores: [],
    matchEvents: [],
    agentRequests: [],
    agentEvents: [],
    liveStats: [],
    auditEvents: []
  };
}

function emptyStats(sessionId: string, now: number): LiveStats {
  return {
    sessionId,
    joinedCount: 0,
    realJoinedCount: 0,
    simulatedJoinedCount: 0,
    answersCount: 0,
    answersPerSec: 0,
    reducerCalls: 0,
    duplicateAnswersRejected: 0,
    p95LatencyMs: 48,
    activeClients: 0,
    updatedAt: now
  };
}

function selectedTopicFromVotes(votes: TopicVote[]): string {
  if (!votes.length) return DEFAULT_SELECTED_TOPIC;
  const counts = new Map<string, number>();
  for (const vote of votes) counts.set(vote.topic, (counts.get(vote.topic) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || DEFAULT_TOPICS.indexOf(a[0]) - DEFAULT_TOPICS.indexOf(b[0]));
  return top.slice(0, 3).map(([topic]) => topic).join(" + ") || DEFAULT_SELECTED_TOPIC;
}

function cleanName(name: string): string {
  return name.trim().slice(0, 24) || "Player";
}

function sessionIdFromArgs(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const record = args as Record<string, unknown>;
  return typeof record.sessionId === "string" ? record.sessionId : null;
}

function sessionIdFromResult(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.sessionId === "string") return record.sessionId;
  if ("participant" in record && record.participant && typeof record.participant === "object") {
    const participant = record.participant as Record<string, unknown>;
    return typeof participant.sessionId === "string" ? participant.sessionId : null;
  }
  return null;
}
