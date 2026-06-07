import {
  DEFAULT_SELECTED_TOPIC,
  DEFAULT_SESSION_CODE,
  DEFAULT_SESSION_ID,
  DEFAULT_TOPICS,
  MAX_PLAYERS_HARD,
  MAX_PLAYERS_SOFT,
  QUESTION_COUNT,
  QUESTION_TIME_LIMIT_MS,
  ROUND_LEAD_TIME_MS,
  ANSWER_GRACE_MS,
  SIMULATED_ANSWER_BURST_SIZE,
  TOTAL_MATCH_SECONDS
} from "./constants";
import { questionBatchSchema, selectedOptionSchema } from "./schemas";
import { computeAnswerScoreBreakdown, compareScores, percentile } from "./scoring";
import { buildTopicFallbackQuestions } from "./topicFallbackQuestions";
import { normalizeIntent } from "./intentNormalization";
import type {
  AgentEvent,
  AgentRequest,
  AdmissionTicket,
  Answer,
  AuditEvent,
  FinalResult,
  LiveStats,
  MatchEvent,
  MatchEventType,
  OptionKey,
  OperationTrace,
  Participant,
  PlayerIntent,
  Question,
  QuestionInput,
  QuestionPack,
  QuestionSecret,
  QuizRushState,
  ReducerReceipt,
  Round,
  Score,
  Session,
  SessionCapacity,
  ShareCard,
  TopicFact,
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
      this.recordOperationTrace(sessionId ?? DEFAULT_SESSION_ID, reducer, identity, true, Date.now() - started, null);
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
      this.recordOperationTrace(sessionId ?? DEFAULT_SESSION_ID, reducer, identity, false, Date.now() - started, error instanceof Error ? error.message : String(error));
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
      case "submit_player_intent":
        return this.submitPlayerIntent(context as ReducerContext<{ sessionId: string; rawText: string; transcriptSource?: "typed" | "speech" }>);
      case "submit_parsed_intent":
        return this.submitParsedIntent(context as ReducerContext<{ intentId: string; parsed: ReturnType<typeof normalizeIntent> }>);
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
      case "submit_topic_facts":
        return this.submitTopicFacts(
          context as ReducerContext<{
            sessionId: string;
            topicKey: string;
            facts?: TopicFact[];
            factsJson?: string;
          }>
        );
      case "start_match":
        return this.startMatch(context as ReducerContext<{ sessionId: string }>);
      case "start_round":
        return this.startRound(context as ReducerContext<{ sessionId: string; questionOrder: number }>);
      case "submit_answer":
        return this.submitAnswer(
          context as ReducerContext<{
            roundId: string;
            selectedOption: OptionKey;
            clientSentAt?: number;
            clientEventId?: string;
            clientQuestionRenderedAtMs?: number;
            clientClickedAtMs?: number;
          }>
        );
      case "resolve_round":
        return this.resolveRound(context as ReducerContext<{ roundId: string }>);
      case "finish_match":
        return this.finishMatch(context as ReducerContext<{ sessionId: string; force?: boolean }>);
      case "create_share_card":
        return this.createShareCard(context as ReducerContext<{ sessionId: string; participantId?: string }>);
      case "increment_share_view":
        return this.incrementShareView(context as ReducerContext<{ slug: string }>);
      case "heartbeat":
        return this.heartbeat(context as ReducerContext<{ sessionId: string; clientLatencyMs?: number }>);
      case "live_tick":
        return this.liveTick(context as ReducerContext<{ sessionId: string }>);
      case "reset_demo":
        return this.resetDemo(context as ReducerContext<{ sessionId?: string }>);
      case "hard_reset_demo":
        return this.hardResetDemo(context as ReducerContext<{ sessionId?: string }>);
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
      maxRacers: MAX_PLAYERS_HARD,
      admittedCount: 0,
      capacityStatus: "open",
      capacityReason: null,
      createdAt: now,
      updatedAt: now
    };
    this.state.sessions.push(session);
    this.state.liveStats.push(emptyStats(session.sessionId, now));
    this.state.sessionCapacities.push(emptyCapacity(session.sessionId, now));
    this.recordAgentEvent({
      args: {
        sessionId: session.sessionId,
        agentName: "Seed Fallback Provider",
        eventType: "fallback_ready",
        content: "Topic-specific deterministic backup questions are ready if the LLM is unavailable.",
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

    const capacity = this.ensureCapacity(session.sessionId, now);
    const admissionStatus = capacity.admittedCount < capacity.maxRacersHard ? "admitted" : "waitlisted";
    const championStatus = admissionStatus === "admitted" ? "active" : "spectator";
    const participant: Participant = {
      participantId: this.nextId("participant"),
      sessionId: session.sessionId,
      identity,
      displayName: cleanName(args.displayName),
      avatar: args.avatar || "🚀",
      admissionStatus,
      championStatus,
      joinedAt: now,
      lastSeen: now,
      isSimulated: false,
      clientLatencyMs: null
    };
    this.state.participants.push(participant);
    const score = this.createScore(session.sessionId, participant.participantId, now, championStatus);
    this.issueAdmissionTicket(session.sessionId, participant.participantId, admissionStatus, now);
    if (session.status === "lobby") session.status = "topic_voting";
    this.updateCapacity(session.sessionId, now);
    session.updatedAt = now;
    this.matchEvent(session.sessionId, participant.participantId, admissionStatus === "admitted" ? "join" : "waitlisted", null, null, null, {
      displayName: participant.displayName,
      avatar: participant.avatar,
      admissionStatus
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
    session.selectedTopic = selectedTopicFromVotes(this.state.topicVotes.filter((vote) => vote.sessionId === session.sessionId));
    session.updatedAt = now;
    this.matchEvent(session.sessionId, participant.participantId, "topic_vote", null, null, null, { topics });
    return inserted;
  }

  private submitPlayerIntent({
    args,
    identity
  }: ReducerContext<{ sessionId: string; rawText: string; transcriptSource?: "typed" | "speech" }>): PlayerIntent {
    const session = this.requireSession(args.sessionId);
    const participant = this.requireParticipantForIdentity(session.sessionId, identity);
    const parsed = normalizeIntent(args.rawText);
    const now = Date.now();
    this.state.playerIntents = this.state.playerIntents.filter((intent) => intent.participantId !== participant.participantId);
    const intent: PlayerIntent = {
      intentId: this.nextId("player-intent"),
      sessionId: session.sessionId,
      participantId: participant.participantId,
      rawText: parsed.rawText,
      transcriptSource: args.transcriptSource ?? "typed",
      cleanedText: parsed.cleanedText,
      canonicalTopics: parsed.canonicalTopics,
      topicKey: parsed.topicKey,
      arenaName: parsed.displayArenaName,
      difficultyHint: parsed.difficultyHint,
      confidence: parsed.confidence,
      status: "parsed",
      createdAt: now,
      updatedAt: now
    };
    this.state.playerIntents.push(intent);
    if (session.status === "lobby") session.status = "topic_voting";
    session.selectedTopic = intent.arenaName;
    session.updatedAt = now;
    this.matchEvent(session.sessionId, participant.participantId, "intent_submitted", null, null, null, {
      rawText: intent.rawText,
      transcriptSource: intent.transcriptSource
    });
    this.matchEvent(session.sessionId, participant.participantId, "intent_parsed", null, null, null, {
      arenaName: intent.arenaName,
      topics: intent.canonicalTopics,
      topicKey: intent.topicKey,
      confidence: intent.confidence
    });
    return intent;
  }

  private submitParsedIntent({ args }: ReducerContext<{ intentId: string; parsed: ReturnType<typeof normalizeIntent> }>): PlayerIntent {
    const intent = this.state.playerIntents.find((candidate) => candidate.intentId === args.intentId);
    if (!intent) throw new Error(`PlayerIntent not found: ${args.intentId}`);
    const now = Date.now();
    intent.cleanedText = args.parsed.cleanedText;
    intent.canonicalTopics = args.parsed.canonicalTopics;
    intent.topicKey = args.parsed.topicKey;
    intent.arenaName = args.parsed.displayArenaName;
    intent.difficultyHint = args.parsed.difficultyHint;
    intent.confidence = args.parsed.confidence;
    intent.status = "parsed";
    intent.updatedAt = now;
    const session = this.requireSession(intent.sessionId);
    session.selectedTopic = intent.arenaName;
    session.updatedAt = now;
    this.matchEvent(intent.sessionId, intent.participantId, "intent_parsed", null, null, null, {
      arenaName: intent.arenaName,
      topics: intent.canonicalTopics,
      topicKey: intent.topicKey,
      confidence: intent.confidence
    });
    return intent;
  }

  private requestQuestions({ args, identity }: ReducerContext<{ sessionId: string; topic?: string; questionCount?: number }>): AgentRequest {
    const session = this.requireSession(args.sessionId);
    const now = Date.now();
    const topic = normalizeIntent(args.topic?.trim() || selectedTopicFromVotes(this.state.topicVotes.filter((vote) => vote.sessionId === session.sessionId))).displayArenaName;
    const questionCount = args.questionCount ?? QUESTION_COUNT;
    const pendingSameTopic = this.state.agentRequests.find(
      (request) => request.sessionId === session.sessionId && request.status === "pending" && request.topic === topic
    );
    if (pendingSameTopic) return pendingSameTopic;
    for (const request of this.state.agentRequests.filter(
      (candidate) => candidate.sessionId === session.sessionId && candidate.status === "pending"
    )) {
      request.status = "failed";
      request.updatedAt = now;
      request.errorMessage = `Superseded by newer quiz request for ${topic}.`;
    }
    if (!["playing", "finished", "replay"].includes(session.status)) {
      this.state.questions = this.state.questions.filter((question) => question.sessionId !== session.sessionId);
      this.state.rounds = this.state.rounds.filter((round) => round.sessionId !== session.sessionId);
    }
    session.status = "generating";
    session.selectedTopic = topic;
    session.questionCount = questionCount;
    session.updatedAt = now;
    const request: AgentRequest = {
      requestId: this.nextId("agent-request"),
      sessionId: session.sessionId,
      requestType: "quiz_generation",
      topic,
      questionCount,
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
    this.submitQuestionPack({
      args: {
        sessionId: session.sessionId,
        selectedTopic: topic,
        questions: buildTopicFallbackQuestions(topic, questionCount)
      },
      identity: "seed-fallback"
    });
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
    this.state.questionPacks = this.state.questionPacks.filter((pack) => pack.sessionId !== session.sessionId);
    this.state.questions = this.state.questions.filter((question) => question.sessionId !== session.sessionId);
    this.state.questionSecrets = this.state.questionSecrets.filter((secret) => secret.sessionId !== session.sessionId);
    this.state.rounds = this.state.rounds.filter((round) => round.sessionId !== session.sessionId);
    const normalized = normalizeIntent(topic);
    const pack: QuestionPack = {
      packId: this.nextId("pack"),
      sessionId: session.sessionId,
      participantId: null,
      topicKey: `${packTopicKey(normalized.displayArenaName, normalized.topicKey)}::${normalized.difficultyHint}`,
      displayTopic: normalized.displayArenaName,
      sourceType: identity === "agent-worker" ? "grounded_llm" : "seed_fallback",
      qualityScore: identity === "agent-worker" ? 90 : 82,
      status: identity === "agent-worker" ? "final" : "provisional",
      createdAt: now
    };
    this.state.questionPacks.push(pack);
    const inserted = parsed.data.questions.slice(0, session.questionCount).map<Question>((question, index) => {
      const questionId = this.nextId("question");
      const publicQuestion: Question = {
        questionId,
        packId: pack.packId,
        sessionId: session.sessionId,
        participantId: null,
        topicKey: pack.topicKey,
        orderIndex: index + 1,
        questionText: question.questionText,
        optionA: question.options.A,
        optionB: question.options.B,
        optionC: question.options.C,
        optionD: question.options.D,
        displayTopic: pack.displayTopic,
        topic: question.topic || topic,
        sourceTitle: question.sourceTitle ?? null,
        sourceUrl: question.sourceUrl ?? null,
        generatedBy: identity === "agent-worker" ? "Quiz Builder Agent" : "Seed Fallback Provider",
        fairnessStatus: identity === "agent-worker" ? "approved" : "fallback",
        createdAt: now
      };
      this.state.questionSecrets.push({
        questionId,
        packId: pack.packId,
        sessionId: session.sessionId,
        participantId: null,
        correctOption: question.correctOption,
        explanation: question.explanation,
        factIds: question.factIds ?? [],
        createdAt: now
      });
      return publicQuestion;
    });
    this.state.questions.push(...inserted);
    session.selectedTopic = topic;
    session.status = inserted.length >= session.questionCount ? "ready" : "generating";
    session.updatedAt = now;
    for (const intent of this.state.playerIntents.filter((candidate) => candidate.sessionId === session.sessionId)) {
      intent.status = "pack_ready";
      intent.updatedAt = now;
    }
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
    this.matchEvent(session.sessionId, null, "pack_ready", null, null, null, {
      topic,
      questions: inserted.length,
      source: identity === "agent-worker" ? "llm" : "instant"
    });
    return inserted;
  }

  private submitTopicFacts({
    args
  }: ReducerContext<{ sessionId: string; topicKey: string; facts?: TopicFact[]; factsJson?: string }>): TopicFact[] {
    this.requireSession(args.sessionId);
    const payload = args.factsJson ? (JSON.parse(args.factsJson) as { facts?: unknown[] }) : { facts: args.facts };
    const rawFacts = Array.isArray(payload.facts) ? payload.facts : [];
    const now = Date.now();
    const facts: TopicFact[] = rawFacts
      .filter(isTopicFactDraft)
      .slice(0, 12)
      .map((fact, index) => ({
        factId: String(fact.factId ?? `${args.topicKey || "topic"}-fact-${index + 1}`).slice(0, 80),
        sessionId: args.sessionId,
        topicKey: String(fact.topicKey ?? args.topicKey).slice(0, 96),
        displayName: String(fact.displayName ?? args.topicKey).slice(0, 120),
        sourceTitle: String(fact.sourceTitle ?? "Firecrawl result").slice(0, 160),
        sourceUrl: String(fact.sourceUrl ?? "https://firecrawl.dev").slice(0, 260),
        sourceType: fact.sourceType === "local" || fact.sourceType === "llm_fallback" ? fact.sourceType : "firecrawl",
        factText: fact.factText.trim().replace(/\s+/g, " ").slice(0, 360),
        confidence: typeof fact.confidence === "number" ? Math.max(0, Math.min(1, fact.confidence)) : 0.78,
        createdAt: now
      }));

    const factIds = new Set(facts.map((fact) => fact.factId));
    this.state.topicFacts = this.state.topicFacts.filter(
      (fact) => fact.sessionId !== args.sessionId || fact.topicKey !== args.topicKey || !factIds.has(fact.factId)
    );
    this.state.topicFacts.push(...facts);
    this.recordAgentEvent({
      args: {
        sessionId: args.sessionId,
        agentName: "Firecrawl Grounding Agent",
        eventType: "facts_committed",
        content: `${facts.length} compact facts stored for ${args.topicKey}.`,
        confidence: facts.length ? 0.86 : 0.2,
        status: facts.length ? "complete" : "fallback"
      },
      identity: "agent-worker"
    });
    return facts;
  }

  private startMatch({ args }: ReducerContext<{ sessionId: string }>): Round {
    const session = this.requireSession(args.sessionId);
    if (!this.state.participants.some((participant) => participant.sessionId === session.sessionId && participant.admissionStatus === "admitted")) {
      throw new Error("At least one participant must join before the match starts.");
    }
    if (this.state.questions.filter((question) => question.sessionId === session.sessionId).length < session.questionCount) {
      this.submitQuestionPack({
        args: {
          sessionId: session.sessionId,
          selectedTopic: session.selectedTopic ?? DEFAULT_SELECTED_TOPIC,
          questions: buildTopicFallbackQuestions(session.selectedTopic ?? DEFAULT_SELECTED_TOPIC, session.questionCount)
        },
        identity: "seed-fallback"
      });
    }
    const now = Date.now();
    const raceStartsAt = now + ROUND_LEAD_TIME_MS;
    session.status = "playing";
    session.currentRound = 1;
    session.matchStartedAt = raceStartsAt;
    session.matchFinishedAt = null;
    session.updatedAt = now;
    this.state.answers = this.state.answers.filter((answer) => answer.sessionId !== session.sessionId);
    this.state.finalResults = this.state.finalResults.filter((result) => result.sessionId !== session.sessionId);
    for (const participant of this.state.participants.filter((participant) => participant.sessionId === session.sessionId)) {
      participant.championStatus = participant.admissionStatus === "admitted" ? "active" : "spectator";
    }
    for (const score of this.state.scores.filter((score) => score.sessionId === session.sessionId)) {
      score.totalScore = 0;
      score.correctCount = 0;
      score.wrongCount = 0;
      score.answeredCount = 0;
      score.totalResponseMs = 0;
      score.totalOfficialResponseMs = 0;
      score.totalObservedResponseMs = null;
      score.fastestResponseMs = null;
      score.fastestOfficialResponseMs = null;
      score.fastestObservedResponseMs = null;
      score.averageResponseMs = null;
      score.averageOfficialResponseMs = null;
      score.normalizedScore = 0;
      score.streakCount = 0;
      score.lastAnswerCorrect = null;
      score.championStatus = this.state.participants.find((participant) => participant.participantId === score.participantId)?.championStatus ?? "active";
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
    const scheduledStart = args.questionOrder === 1 ? matchStartedAt : now + ROUND_LEAD_TIME_MS;
    const startsAt = Math.min(Math.max(scheduledStart, matchStartedAt), matchDeadline);
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

  private submitAnswer({
    args,
    identity
  }: ReducerContext<{
    roundId: string;
    selectedOption: OptionKey;
    clientSentAt?: number;
    clientEventId?: string;
    clientQuestionRenderedAtMs?: number;
    clientClickedAtMs?: number;
  }>): Answer {
    const parsed = selectedOptionSchema.safeParse(args);
    if (!parsed.success) throw new Error("Malformed answer.");
    const round = this.requireRound(args.roundId);
    if (round.status !== "active") throw new Error("Round is not active.");
    const participant = this.requireParticipantForIdentity(round.sessionId, identity);
    if (participant.admissionStatus !== "admitted") throw new Error("Only admitted racers can submit answers.");
    if (this.state.answers.some((answer) => answer.roundId === round.roundId && answer.participantId === participant.participantId)) {
      const stats = this.state.liveStats.find((candidate) => candidate.sessionId === round.sessionId);
      if (stats) {
        stats.duplicateAnswersRejected += 1;
        stats.updatedAt = Date.now();
      }
      throw new Error("Duplicate answer rejected.");
    }
    if (args.clientEventId) {
      const duplicateClientEvent = this.state.answers.some(
        (answer) => answer.participantId === participant.participantId && answer.clientEventId === args.clientEventId
      );
      if (duplicateClientEvent) throw new Error("Duplicate answer event rejected.");
    }
    const secret = this.requireQuestionSecret(round.questionId);
    const now = Date.now();
    if (now < round.startsAt) throw new Error("Round has not started.");
    if (now > round.endsAt + ANSWER_GRACE_MS) throw new Error("Round has ended.");
    const officialResponseMs = Math.max(0, Math.min(now - round.startsAt, QUESTION_TIME_LIMIT_MS));
    const observedResponseMs =
      typeof args.clientClickedAtMs === "number" &&
      typeof args.clientQuestionRenderedAtMs === "number" &&
      args.clientClickedAtMs >= args.clientQuestionRenderedAtMs
        ? Math.round(args.clientClickedAtMs - args.clientQuestionRenderedAtMs)
        : null;
    const timingSuspicious =
      observedResponseMs !== null &&
      (observedResponseMs < 80 || Math.abs(observedResponseMs - officialResponseMs) > Math.max(600, officialResponseMs * 0.75));
    const isCorrect = args.selectedOption === secret.correctOption;
    const score = this.requireScore(round.sessionId, participant.participantId);
    const breakdown = computeAnswerScoreBreakdown({ isCorrect, responseMs: officialResponseMs, previousAnswerWasCorrect: score.lastAnswerCorrect === true });
    const answer: Answer = {
      answerId: this.nextId("answer"),
      sessionId: round.sessionId,
      roundId: round.roundId,
      questionId: round.questionId,
      participantId: participant.participantId,
      selectedOption: args.selectedOption,
      isCorrect,
      responseMs: officialResponseMs,
      responseMsServer: officialResponseMs,
      officialResponseMs,
      observedResponseMs,
      clientQuestionRenderedAtMs: args.clientQuestionRenderedAtMs ?? null,
      clientClickedAtMs: args.clientClickedAtMs ?? null,
      clientSentAt: args.clientSentAt ?? null,
      clientEventId: args.clientEventId ?? null,
      correctnessPoints: breakdown.correctnessPoints,
      speedBonus: breakdown.speedBonus,
      streakBonus: breakdown.streakBonus,
      scoreDelta: breakdown.scoreDelta,
      serverReceivedAt: now,
      serverCommittedAt: now,
      participantLatencyMsSnapshot: participant.clientLatencyMs,
      timingSuspicious,
      createdAt: now
    };
    this.state.answers.push(answer);
    score.totalScore += breakdown.scoreDelta;
    score.correctCount += isCorrect ? 1 : 0;
    score.wrongCount += isCorrect ? 0 : 1;
    score.answeredCount += 1;
    score.totalResponseMs += isCorrect ? officialResponseMs : 0;
    score.totalOfficialResponseMs = score.totalResponseMs;
    if (isCorrect && observedResponseMs !== null) {
      score.totalObservedResponseMs = (score.totalObservedResponseMs ?? 0) + observedResponseMs;
    }
    if (isCorrect) {
      score.fastestResponseMs = score.fastestResponseMs === null ? officialResponseMs : Math.min(score.fastestResponseMs, officialResponseMs);
      score.fastestOfficialResponseMs = score.fastestResponseMs;
      if (observedResponseMs !== null) {
        score.fastestObservedResponseMs = score.fastestObservedResponseMs === null ? observedResponseMs : Math.min(score.fastestObservedResponseMs, observedResponseMs);
      }
    }
    score.averageResponseMs = Math.round(score.totalResponseMs / Math.max(1, score.correctCount));
    score.averageOfficialResponseMs = score.averageResponseMs;
    score.streakCount = isCorrect ? score.streakCount + 1 : 0;
    score.lastAnswerCorrect = isCorrect;
    score.normalizedScore = normalizedScore(score, this.requireSession(round.sessionId).questionCount);
    score.lastAnswerAt = now;
    score.updatedAt = now;
    this.recomputeRanks(round.sessionId, now);
    this.matchEvent(round.sessionId, participant.participantId, "answer", round.orderIndex, score.totalScore, score.currentRank, {
      selectedOption: args.selectedOption,
      isCorrect,
      officialResponseMs,
      observedResponseMs,
      timingSuspicious
    });
    this.matchEvent(round.sessionId, participant.participantId, "score_delta", round.orderIndex, score.totalScore, score.currentRank, {
      scoreDelta: breakdown.scoreDelta,
      correctnessPoints: breakdown.correctnessPoints,
      speedBonus: breakdown.speedBonus,
      streakBonus: breakdown.streakBonus
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
    this.snapshotFinalResults(session.sessionId, now);
    const winner = this.state.scores.filter((score) => score.sessionId === session.sessionId).sort(compareScores)[0];
    if (winner) {
      winner.championStatus = "champion";
      const winnerParticipant = this.state.participants.find((participant) => participant.participantId === winner.participantId);
      if (winnerParticipant) winnerParticipant.championStatus = "champion";
      const final = this.state.finalResults.find((result) => result.participantId === winner.participantId && result.sessionId === session.sessionId);
      if (final) final.championStatus = "champion";
    }
    this.matchEvent(session.sessionId, winner?.participantId ?? null, "match_finished", null, winner?.totalScore ?? null, winner?.currentRank ?? null, {});
    return session;
  }

  private createShareCard({ args, identity }: ReducerContext<{ sessionId: string; participantId?: string }>): ShareCard {
    const session = this.requireSession(args.sessionId);
    const participant =
      (args.participantId ? this.state.participants.find((candidate) => candidate.participantId === args.participantId) : undefined) ??
      this.requireParticipantForIdentity(session.sessionId, identity);
    const result = this.state.finalResults.find(
      (candidate) => candidate.sessionId === session.sessionId && candidate.participantId === participant.participantId
    );
    if (!result) throw new Error("Final result is not ready yet.");
    const now = Date.now();
    const existing = this.state.shareCards.find(
      (candidate) => candidate.sessionId === session.sessionId && candidate.participantId === participant.participantId
    );
    if (existing) return existing;
    const share: ShareCard = {
      shareId: this.nextId("share"),
      slug: this.uniqueShareSlug(),
      sessionId: session.sessionId,
      participantId: participant.participantId,
      displayName: participant.displayName,
      avatar: participant.avatar,
      avatarType: "emoji",
      avatarEmoji: participant.avatar,
      avatarColor: null,
      avatarUrl: null,
      displayTopic: session.selectedTopic ?? "QuizRush Arena",
      finalRank: result.finalRank,
      totalParticipants: result.totalParticipants,
      championStatus: result.championStatus,
      totalScore: result.totalScore,
      correctCount: result.correctCount,
      questionCount: result.questionCount,
      totalResponseMsOfficial: result.totalOfficialResponseMs,
      totalResponseMsObserved: null,
      fastestResponseMs: result.fastestResponseMs,
      fastestResponseMsOfficial: result.fastestOfficialResponseMs,
      fastestResponseMsObserved: null,
      percentile: result.percentile,
      shareText: `${participant.displayName} placed #${result.finalRank} with ${result.totalScore.toLocaleString()} points in QuizRush Arena.`,
      createdAt: now,
      expiresAt: null,
      viewCount: 0
    };
    this.state.shareCards.push(share);
    this.matchEvent(session.sessionId, participant.participantId, "share_created", null, result.totalScore, result.finalRank, { slug: share.slug });
    return share;
  }

  private incrementShareView({ args }: ReducerContext<{ slug: string }>): ShareCard {
    const share = this.state.shareCards.find((candidate) => candidate.slug === args.slug);
    if (!share) throw new Error("Share card not found or expired.");
    share.viewCount += 1;
    return share;
  }

  private uniqueShareSlug(): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      let slug = "";
      for (let index = 0; index < 12; index += 1) {
        slug += alphabet[Math.floor(Math.random() * alphabet.length)] ?? "x";
      }
      if (!this.state.shareCards.some((card) => card.slug === slug)) return slug;
    }
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
    const durableShareCards = this.state.shareCards;
    this.state = emptyState();
    this.state.shareCards = durableShareCards;
    return this.seedSession(args.sessionId);
  }

  private hardResetDemo({ args }: ReducerContext<{ sessionId?: string }>): Session {
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
        admissionStatus: "admitted",
        championStatus: "active",
        joinedAt: now,
        lastSeen: now,
        isSimulated: true,
        clientLatencyMs: 35 + (index % 70)
      };
      this.state.participants.push(participant);
      this.createScore(session.sessionId, participant.participantId, now, "active");
      this.issueAdmissionTicket(session.sessionId, participant.participantId, "admitted", now);
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
    const secret = this.requireQuestionSecret(round.questionId);
    const now = Date.now();
    if (now < round.startsAt || now > round.endsAt + 200) return [];
    const answered = new Set(this.state.answers.filter((answer) => answer.roundId === round.roundId).map((answer) => answer.participantId));
    const candidates = this.state.participants
      .filter((participant) => participant.sessionId === session.sessionId && participant.isSimulated && !answered.has(participant.participantId))
      .sort((a, b) => a.participantId.localeCompare(b.participantId))
      .slice(0, Math.max(0, Math.min(args.count ?? SIMULATED_ANSWER_BURST_SIZE, 32)));
    const inserted: Answer[] = [];
    const wrongOptions: OptionKey[] = ["A", "B", "C", "D"].filter((option) => option !== secret.correctOption) as OptionKey[];
    candidates.forEach((participant, index) => {
      const answerTime = now + index;
      const responseMs = Math.max(0, Math.min(answerTime - round.startsAt + (index % 5) * 9, QUESTION_TIME_LIMIT_MS));
      const isCorrect = (index + round.orderIndex + Number(participant.participantId.split("-").at(-1) ?? 0)) % 5 !== 0;
      const selectedOption = isCorrect ? secret.correctOption : wrongOptions[index % wrongOptions.length] ?? "A";
      const score = this.requireScore(round.sessionId, participant.participantId);
      const breakdown = computeAnswerScoreBreakdown({ isCorrect, responseMs, previousAnswerWasCorrect: score.lastAnswerCorrect === true });
      const answer: Answer = {
        answerId: this.nextId("answer"),
        sessionId: round.sessionId,
        roundId: round.roundId,
        questionId: round.questionId,
        participantId: participant.participantId,
        selectedOption,
        isCorrect,
        responseMs,
        responseMsServer: responseMs,
        officialResponseMs: responseMs,
        observedResponseMs: null,
        clientQuestionRenderedAtMs: null,
        clientClickedAtMs: null,
        clientSentAt: null,
        clientEventId: `sim-${participant.participantId}-${round.roundId}`,
        correctnessPoints: breakdown.correctnessPoints,
        speedBonus: breakdown.speedBonus,
        streakBonus: breakdown.streakBonus,
        scoreDelta: breakdown.scoreDelta,
        serverReceivedAt: answerTime,
        serverCommittedAt: answerTime,
        participantLatencyMsSnapshot: participant.clientLatencyMs,
        timingSuspicious: false,
        createdAt: answerTime
      };
      this.state.answers.push(answer);
      score.totalScore += breakdown.scoreDelta;
      score.correctCount += isCorrect ? 1 : 0;
      score.wrongCount += isCorrect ? 0 : 1;
      score.answeredCount += 1;
      score.totalResponseMs += isCorrect ? responseMs : 0;
      score.totalOfficialResponseMs = score.totalResponseMs;
      if (isCorrect) score.fastestResponseMs = score.fastestResponseMs === null ? responseMs : Math.min(score.fastestResponseMs, responseMs);
      score.fastestOfficialResponseMs = score.fastestResponseMs;
      score.averageResponseMs = Math.round(score.totalResponseMs / Math.max(1, score.correctCount));
      score.averageOfficialResponseMs = score.averageResponseMs;
      score.streakCount = isCorrect ? score.streakCount + 1 : 0;
      score.lastAnswerCorrect = isCorrect;
      score.normalizedScore = normalizedScore(score, session.questionCount);
      score.lastAnswerAt = answerTime;
      score.updatedAt = answerTime;
      this.matchEvent(round.sessionId, participant.participantId, "answer", round.orderIndex, score.totalScore, score.currentRank, {
        selectedOption,
        isCorrect,
        responseMs,
        simulated: true
      });
      this.matchEvent(round.sessionId, participant.participantId, "score_delta", round.orderIndex, score.totalScore, score.currentRank, {
        scoreDelta: breakdown.scoreDelta,
        correctnessPoints: breakdown.correctnessPoints,
        speedBonus: breakdown.speedBonus,
        streakBonus: breakdown.streakBonus,
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

  private recordOperationTrace(
    sessionId: string,
    reducer: string,
    identity: string,
    ok: boolean,
    durationMs: number,
    errorMessage: string | null
  ): OperationTrace {
    const trace: OperationTrace = {
      traceId: this.nextId("operation-trace"),
      sessionId,
      reducer,
      identity,
      ok,
      durationMs,
      stateVersion: this.stateVersion,
      errorMessage,
      createdAt: Date.now()
    };
    this.state.operationTraces.push(trace);
    return trace;
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
      maxRacers: MAX_PLAYERS_HARD,
      admittedCount: 0,
      capacityStatus: "open",
      capacityReason: null,
      createdAt: now,
      updatedAt: now
    };
    this.state.sessions.push(session);
    this.state.liveStats.push(emptyStats(session.sessionId, now));
    this.state.sessionCapacities.push(emptyCapacity(session.sessionId, now));
    this.recordAgentEvent({
      args: {
        sessionId: session.sessionId,
        agentName: "Seed Fallback Provider",
        eventType: "fallback_ready",
        content: "Topic-specific deterministic backup questions are ready if the LLM is unavailable.",
        confidence: 1,
        status: "complete"
      },
      identity: "system"
    });
    return session;
  }

  private snapshotFinalResults(sessionId: string, now: number): void {
    const sorted = this.state.scores
      .filter((score) => score.sessionId === sessionId)
      .sort(compareScores);
    const totalParticipants = sorted.length;
    this.state.finalResults = this.state.finalResults.filter((result) => result.sessionId !== sessionId);
    this.state.finalResults.push(
      ...sorted.map<FinalResult>((score, index) => ({
        finalResultId: `${sessionId}:${score.participantId}`,
        sessionId,
        participantId: score.participantId,
        finalRank: index + 1,
        totalParticipants,
        championStatus: index === 0 ? "champion" : score.championStatus === "spectator" ? "spectator" : "finished",
        totalScore: score.totalScore,
        correctCount: score.correctCount,
        questionCount: this.requireSession(sessionId).questionCount,
        answeredCount: score.answeredCount,
        totalResponseMs: score.totalResponseMs,
        totalOfficialResponseMs: score.totalOfficialResponseMs,
        fastestResponseMs: score.fastestResponseMs,
        fastestOfficialResponseMs: score.fastestOfficialResponseMs,
        averageOfficialResponseMs: score.averageOfficialResponseMs,
        normalizedScore: score.normalizedScore,
        percentile: percentile(index + 1, totalParticipants),
        createdAt: now
      }))
    );
  }

  private createScore(sessionId: string, participantId: string, now: number, championStatus: Score["championStatus"] = "active"): Score {
    const score: Score = {
      scoreId: this.nextId("score"),
      sessionId,
      participantId,
      totalScore: 0,
      correctCount: 0,
      wrongCount: 0,
      answeredCount: 0,
      totalResponseMs: 0,
      totalOfficialResponseMs: 0,
      totalObservedResponseMs: null,
      fastestResponseMs: null,
      fastestOfficialResponseMs: null,
      fastestObservedResponseMs: null,
      averageResponseMs: null,
      averageOfficialResponseMs: null,
      normalizedScore: 0,
      streakCount: 0,
      lastAnswerCorrect: null,
      championStatus,
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

  private requireQuestionSecret(questionId: string): QuestionSecret {
    const secret = this.state.questionSecrets.find((candidate) => candidate.questionId === questionId);
    if (!secret) throw new Error(`Question secret not found: ${questionId}`);
    return secret;
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
    const capacity = this.updateCapacity(sessionId, now);
    const answers = this.state.answers.filter((answer) => answer.sessionId === sessionId);
    stats.joinedCount = participants.length;
    stats.realJoinedCount = participants.filter((participant) => !participant.isSimulated).length;
    stats.simulatedJoinedCount = participants.filter((participant) => participant.isSimulated).length;
    stats.admittedRacers = participants.filter((participant) => participant.admissionStatus === "admitted").length;
    stats.waitlistedUsers = participants.filter((participant) => participant.admissionStatus === "waitlisted").length;
    stats.capacityStatus = capacity.status;
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

  private ensureCapacity(sessionId: string, now: number): SessionCapacity {
    const existing = this.state.sessionCapacities.find((candidate) => candidate.sessionId === sessionId);
    if (existing) return existing;
    const capacity = emptyCapacity(sessionId, now);
    this.state.sessionCapacities.push(capacity);
    return capacity;
  }

  private updateCapacity(sessionId: string, now: number): SessionCapacity {
    const capacity = this.ensureCapacity(sessionId, now);
    const participants = this.state.participants.filter((participant) => participant.sessionId === sessionId);
    capacity.admittedCount = participants.filter((participant) => participant.admissionStatus === "admitted").length;
    capacity.waitlistedCount = participants.filter((participant) => participant.admissionStatus === "waitlisted").length;
    capacity.spectatorCount = participants.filter((participant) => participant.admissionStatus === "spectator").length;
    capacity.status =
      capacity.admittedCount >= capacity.maxRacersHard
        ? "full"
        : capacity.admittedCount >= capacity.maxRacersSoft
          ? "soft_full"
          : "open";
    capacity.reason =
      capacity.status === "full"
        ? "Measured hard cap reached for current deployment."
        : capacity.status === "soft_full"
          ? "Soft cap reached; admission is conservative until next load test."
          : null;
    capacity.updatedAt = now;
    const session = this.state.sessions.find((candidate) => candidate.sessionId === sessionId);
    if (session) {
      session.admittedCount = capacity.admittedCount;
      session.capacityStatus = capacity.status;
      session.capacityReason = capacity.reason;
      session.maxRacers = capacity.maxRacersHard;
      session.updatedAt = now;
    }
    return capacity;
  }

  private issueAdmissionTicket(
    sessionId: string,
    participantId: string,
    status: AdmissionTicket["status"],
    now: number
  ): AdmissionTicket {
    const existing = this.state.admissionTickets.find((ticket) => ticket.sessionId === sessionId && ticket.participantId === participantId);
    if (existing) return existing;
    const queuePosition =
      status === "waitlisted"
        ? this.state.admissionTickets.filter((ticket) => ticket.sessionId === sessionId && ticket.status === "waitlisted").length + 1
        : null;
    const ticket: AdmissionTicket = {
      ticketId: this.nextId("admission"),
      sessionId,
      participantId,
      status,
      queuePosition,
      issuedAt: now
    };
    this.state.admissionTickets.push(ticket);
    return ticket;
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
    playerIntents: [],
    questionPacks: [],
    questions: [],
    questionSecrets: [],
    rounds: [],
    answers: [],
    scores: [],
    finalResults: [],
    shareCards: [],
    sessionCapacities: [],
    admissionTickets: [],
    matchEvents: [],
    agentRequests: [],
    agentEvents: [],
    topicFacts: [],
    liveStats: [],
    auditEvents: [],
    operationTraces: []
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
    p95AnswerCommitMs: 48,
    p95SubscriptionRenderMs: 120,
    activeClients: 0,
    admittedRacers: 0,
    waitlistedUsers: 0,
    capacityStatus: "open",
    updatedAt: now
  };
}

function emptyCapacity(sessionId: string, now: number): SessionCapacity {
  return {
    sessionId,
    maxRacersSoft: MAX_PLAYERS_SOFT,
    maxRacersHard: MAX_PLAYERS_HARD,
    admittedCount: 0,
    waitlistedCount: 0,
    spectatorCount: 0,
    status: "open",
    reason: null,
    updatedAt: now
  };
}

function normalizedScore(score: Score, questionCount: number): number {
  const accuracy = questionCount > 0 ? score.correctCount / questionCount : 0;
  const averageResponse = score.averageOfficialResponseMs ?? score.averageResponseMs ?? QUESTION_TIME_LIMIT_MS;
  const speed = 1 - Math.max(0, Math.min(1, averageResponse / QUESTION_TIME_LIMIT_MS));
  const streak = Math.max(0, Math.min(1, score.streakCount / Math.max(1, questionCount)));
  return Math.round((0.7 * accuracy + 0.25 * speed + 0.05 * streak) * 100_000) / 1000;
}

function isTopicFactDraft(value: unknown): value is Partial<TopicFact> & { factText: string } {
  if (!value || typeof value !== "object") return false;
  const fact = value as Partial<TopicFact>;
  return typeof fact.factText === "string" && fact.factText.trim().length > 12;
}

function selectedTopicFromVotes(votes: TopicVote[]): string {
  if (!votes.length) return DEFAULT_SELECTED_TOPIC;
  const counts = new Map<string, number>();
  for (const vote of votes) counts.set(vote.topic, (counts.get(vote.topic) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || DEFAULT_TOPICS.indexOf(a[0]) - DEFAULT_TOPICS.indexOf(b[0]));
  return top.slice(0, 3).map(([topic]) => topic).join(" + ") || DEFAULT_SELECTED_TOPIC;
}

function packTopicKey(displayTopic: string, fallbackTopicKey: string): string {
  return displayTopic.toLowerCase() === "space" ? "space" : fallbackTopicKey;
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
