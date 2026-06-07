import { QUESTION_COUNT, type OptionKey, type QuizRushState, type ReducerReceipt } from "@quizrush/shared";
import { DbConnection } from "./module_bindings";
import type {
  AdmissionTicket as StdbAdmissionTicket,
  AgentEvent as StdbAgentEvent,
  AgentRequest as StdbAgentRequest,
  Answer as StdbAnswer,
  AuditEvent as StdbAuditEvent,
  FinalResult as StdbFinalResult,
  LiveStats as StdbLiveStats,
  MatchEvent as StdbMatchEvent,
  OperationTrace as StdbOperationTrace,
  Participant as StdbParticipant,
  PlayerIntent as StdbPlayerIntent,
  QuestionPack as StdbQuestionPack,
  QuestionPublic as StdbQuestionPublic,
  Round as StdbRound,
  Score as StdbScore,
  Session as StdbSession,
  SessionCapacity as StdbSessionCapacity,
  ShareCard as StdbShareCard,
  TopicFact as StdbTopicFact,
  TopicVote as StdbTopicVote
} from "./module_bindings/types";

type AnyRecord = Record<string, unknown>;

const reducerMethods: Record<string, string> = {
  add_simulated_players: "addSimulatedPlayers",
  create_session: "createSession",
  create_share_card: "createShareCard",
  hard_reset_demo: "hardResetDemo",
  increment_share_view: "incrementShareView",
  finish_match: "finishMatch",
  heartbeat: "heartbeat",
  join_session: "joinSession",
  live_tick: "liveTick",
  record_agent_event: "recordAgentEvent",
  request_questions: "requestQuestions",
  reset_demo: "resetDemo",
  resolve_round: "resolveRound",
  simulate_answer_burst: "simulateAnswerBurst",
  start_match: "startMatch",
  start_round: "startRound",
  submit_answer: "submitAnswer",
  submit_parsed_intent: "submitParsedIntent",
  submit_player_intent: "submitPlayerIntent",
  submit_question_batch: "submitQuestionBatch",
  submit_question_pack: "submitQuestionPack",
  submit_topic_facts: "submitTopicFacts",
  submit_topic_vote: "submitTopicVote"
};

export function buildDirectSpacetimeConnection(input: {
  host: string;
  module: string;
  onConnect: (connection: DbConnection, token: string) => void;
  onConnectError: (error: Error) => void;
  onDisconnect: (error?: Error) => void;
}): DbConnection {
  return DbConnection.builder()
    .withUri(input.host)
    .withDatabaseName(input.module)
    .withConfirmedReads(false)
    .withToken(loadDirectSpacetimeToken(input.host, input.module))
    .onConnect((connection, _identity, token) => {
      saveDirectSpacetimeToken(input.host, input.module, token);
      input.onConnect(connection, token);
    })
    .onConnectError((_ctx, error) => input.onConnectError(error))
    .onDisconnect((_ctx, error) => input.onDisconnect(error))
    .build();
}

export function registerDirectSnapshotListeners(connection: DbConnection, onChange: () => void): () => void {
  const tableHandles = [
    connection.db.session,
    connection.db.participant,
    connection.db.topic_vote,
    connection.db.player_intent,
    connection.db.question_pack,
    connection.db.question_public,
    connection.db.topic_fact,
    connection.db.round,
    connection.db.answer,
    connection.db.score,
    connection.db.final_result,
    connection.db.share_card,
    connection.db.session_capacity,
    connection.db.admission_ticket,
    connection.db.match_event,
    connection.db.agent_request,
    connection.db.agent_event,
    connection.db.live_stats,
    connection.db.audit_event,
    connection.db.operation_trace
  ] as Array<{
    onInsert: (callback: (...args: unknown[]) => void) => void;
    onDelete: (callback: (...args: unknown[]) => void) => void;
    onUpdate?: (callback: (...args: unknown[]) => void) => void;
    removeOnInsert: (callback: (...args: unknown[]) => void) => void;
    removeOnDelete: (callback: (...args: unknown[]) => void) => void;
    removeOnUpdate?: (callback: (...args: unknown[]) => void) => void;
  }>;

  const callbacks: Array<() => void> = [];
  for (const table of tableHandles) {
    const onInsert = () => onChange();
    const onDelete = () => onChange();
    const onUpdate = () => onChange();
    table.onInsert(onInsert);
    table.onDelete(onDelete);
    table.onUpdate?.(onUpdate);
    callbacks.push(() => {
      table.removeOnInsert(onInsert);
      table.removeOnDelete(onDelete);
      table.removeOnUpdate?.(onUpdate);
    });
  }

  return () => {
    for (const remove of callbacks) remove();
  };
}

export async function callDirectReducer<T = unknown>(
  connection: DbConnection,
  name: string,
  args: unknown,
  stateVersion: number
): Promise<{ receipt: ReducerReceipt<T>; snapshot: QuizRushState }> {
  const methodName = reducerMethods[name];
  const reducer = methodName ? (connection.reducers as Record<string, (params: unknown) => Promise<void>>)[methodName] : undefined;
  if (!reducer) {
    return {
      receipt: {
        ok: false,
        reducer: name,
        error: `Unknown reducer: ${name}`,
        stateVersion,
        serverTime: Date.now()
      },
      snapshot: snapshotFromDirectConnection(connection)
    };
  }

  try {
    await reducer(toDirectReducerArgs(name, args));
    const snapshot = snapshotFromDirectConnection(connection);
    return {
      receipt: {
        ok: true,
        reducer: name,
        data: deriveReducerData<T>(connection, snapshot, name, args),
        stateVersion: stateVersion + 1,
        serverTime: Date.now()
      },
      snapshot
    };
  } catch (error) {
    return {
      receipt: {
        ok: false,
        reducer: name,
        error: error instanceof Error ? error.message : String(error),
        stateVersion: stateVersion + 1,
        serverTime: Date.now()
      },
      snapshot: snapshotFromDirectConnection(connection)
    };
  }
}

export function snapshotFromDirectConnection(connection: DbConnection): QuizRushState {
  return {
    sessions: Array.from(connection.db.session.iter()).map(mapSession),
    participants: Array.from(connection.db.participant.iter()).map(mapParticipant),
    topicVotes: Array.from(connection.db.topic_vote.iter()).map(mapTopicVote),
    playerIntents: Array.from(connection.db.player_intent.iter()).map(mapPlayerIntent),
    questionPacks: Array.from(connection.db.question_pack.iter()).map(mapQuestionPack),
    questions: Array.from(connection.db.question_public.iter()).map(mapQuestion),
    questionSecrets: [],
    topicFacts: Array.from(connection.db.topic_fact.iter()).map(mapTopicFact),
    rounds: Array.from(connection.db.round.iter()).map(mapRound),
    answers: Array.from(connection.db.answer.iter()).map(mapAnswer),
    scores: Array.from(connection.db.score.iter()).map(mapScore),
    finalResults: Array.from(connection.db.final_result.iter()).map(mapFinalResult),
    shareCards: Array.from(connection.db.share_card.iter()).map(mapShareCard),
    sessionCapacities: Array.from(connection.db.session_capacity.iter()).map(mapSessionCapacity),
    admissionTickets: Array.from(connection.db.admission_ticket.iter()).map(mapAdmissionTicket),
    matchEvents: Array.from(connection.db.match_event.iter()).map(mapMatchEvent),
    agentRequests: Array.from(connection.db.agent_request.iter()).map(mapAgentRequest),
    agentEvents: Array.from(connection.db.agent_event.iter()).map(mapAgentEvent),
    liveStats: Array.from(connection.db.live_stats.iter()).map(mapLiveStats),
    auditEvents: Array.from(connection.db.audit_event.iter()).map(mapAuditEvent),
    operationTraces: Array.from(connection.db.operation_trace.iter()).map(mapOperationTrace)
  };
}

export function directTokenStorageKey(host: string, module: string): string {
  return `quizrush-spacetimedb-token:${host}:${module}`;
}

function loadDirectSpacetimeToken(host: string, module: string): string | undefined {
  return window.localStorage.getItem(directTokenStorageKey(host, module)) ?? undefined;
}

function saveDirectSpacetimeToken(host: string, module: string, token: string): void {
  window.localStorage.setItem(directTokenStorageKey(host, module), token);
}

function toDirectReducerArgs(name: string, rawArgs: unknown): unknown {
  const args = toRecord(rawArgs);
  switch (name) {
    case "create_session":
      return {
        code: stringArg(args, "code"),
        questionCount: numberArg(args, "questionCount", QUESTION_COUNT)
      };
    case "join_session":
      return {
        code: stringArg(args, "code", stringArg(args, "joinCode")),
        displayName: stringArg(args, "displayName", "Player"),
        avatar: stringArg(args, "avatar", "R")
      };
    case "submit_topic_vote":
      return {
        sessionId: stringArg(args, "sessionId"),
        topicsJson: stringArg(args, "topicsJson", JSON.stringify(arrayArg(args, "topics")))
      };
    case "submit_player_intent":
      return {
        sessionId: stringArg(args, "sessionId"),
        rawText: stringArg(args, "rawText"),
        transcriptSource: stringArg(args, "transcriptSource", "typed")
      };
    case "submit_parsed_intent":
      return {
        intentId: stringArg(args, "intentId"),
        parsedJson: stringArg(args, "parsedJson", JSON.stringify(args.parsed ?? {}))
      };
    case "request_questions":
      return {
        sessionId: stringArg(args, "sessionId"),
        topic: stringArg(args, "topic"),
        questionCount: numberArg(args, "questionCount", QUESTION_COUNT)
      };
    case "submit_question_pack":
    case "submit_question_batch":
      return {
        sessionId: stringArg(args, "sessionId"),
        selectedTopic: stringArg(args, "selectedTopic"),
        questionsJson: stringArg(args, "questionsJson", JSON.stringify({ questions: arrayArg(args, "questions") })),
        requestId: optionalStringArg(args, "requestId")
      };
    case "submit_topic_facts":
      return {
        sessionId: stringArg(args, "sessionId"),
        topicKey: stringArg(args, "topicKey"),
        factsJson: stringArg(args, "factsJson", JSON.stringify({ facts: arrayArg(args, "facts") }))
      };
    case "submit_answer":
      return {
        roundId: stringArg(args, "roundId"),
        selectedOption: stringArg(args, "selectedOption"),
        clientEventId: optionalStringArg(args, "clientEventId"),
        clientSentAtMs: optionalBigIntArg(args, "clientSentAtMs", optionalNumberArg(args, "clientSentAt")),
        clientQuestionRenderedAtMs: optionalBigIntArg(args, "clientQuestionRenderedAtMs"),
        clientClickedAtMs: optionalBigIntArg(args, "clientClickedAtMs")
      };
    case "create_share_card":
      return {
        sessionId: stringArg(args, "sessionId"),
        participantId: optionalStringArg(args, "participantId")
      };
    case "increment_share_view":
      return {
        slug: stringArg(args, "slug")
      };
    case "start_round":
      return {
        sessionId: stringArg(args, "sessionId"),
        questionOrder: numberArg(args, "questionOrder", 1)
      };
    case "heartbeat":
      return {
        sessionId: stringArg(args, "sessionId"),
        clientLatencyMs: optionalNumberArg(args, "clientLatencyMs")
      };
    case "record_agent_event":
      return {
        sessionId: stringArg(args, "sessionId"),
        agentName: stringArg(args, "agentName", "Agent Worker"),
        eventType: stringArg(args, "eventType", "event"),
        content: stringArg(args, "content"),
        confidence: numberArg(args, "confidence", 0.8),
        status: stringArg(args, "status", "complete")
      };
    case "add_simulated_players":
    case "simulate_answer_burst":
      return {
        sessionId: stringArg(args, "sessionId"),
        count: numberArg(args, "count", 1)
      };
    case "finish_match":
    case "hard_reset_demo":
    case "live_tick":
    case "reset_demo":
    case "start_match":
      return { sessionId: stringArg(args, "sessionId") };
    case "resolve_round":
      return { roundId: stringArg(args, "roundId") };
    default:
      return args;
  }
}

function deriveReducerData<T>(connection: DbConnection, snapshot: QuizRushState, name: string, rawArgs: unknown): T | undefined {
  const args = toRecord(rawArgs);
  if (name === "create_share_card") {
    const sessionId = stringArg(args, "sessionId");
    const participantId =
      optionalStringArg(args, "participantId") ??
      snapshot.participants.find((candidate) => candidate.sessionId === sessionId && candidate.identity === connection.identity?.toString())?.participantId;
    const shareCard = snapshot.shareCards.find((candidate) => candidate.sessionId === sessionId && candidate.participantId === participantId);
    return shareCard as T | undefined;
  }

  if (name !== "join_session") return undefined;
  const code = stringArg(args, "code", stringArg(args, "joinCode"));
  const session = snapshot.sessions.find((candidate) => candidate.code === code || candidate.sessionId === code) ?? snapshot.sessions[0];
  const identity = connection.identity?.toString();
  const participant =
    snapshot.participants.find((candidate) => candidate.sessionId === session?.sessionId && candidate.identity === identity) ??
    snapshot.participants
      .filter((candidate) => candidate.sessionId === session?.sessionId)
      .sort((a, b) => b.joinedAt - a.joinedAt)[0];
  const score = snapshot.scores.find((candidate) => candidate.participantId === participant?.participantId);
  return participant ? ({ participant, score } as T) : undefined;
}

function mapSession(row: StdbSession): QuizRushState["sessions"][number] {
  return {
    sessionId: row.sessionId,
    code: row.code,
    status: row.status as QuizRushState["sessions"][number]["status"],
    selectedTopic: row.selectedTopic ?? null,
    questionCount: row.questionCount,
    currentRound: row.currentRound,
    matchStartedAt: toNullableNumber(row.matchStartedAtMs),
    matchFinishedAt: toNullableNumber(row.matchFinishedAtMs),
    maxRacers: row.maxRacers,
    admittedCount: row.admittedCount,
    capacityStatus: row.capacityStatus as QuizRushState["sessions"][number]["capacityStatus"],
    capacityReason: row.capacityReason ?? null,
    createdAt: toNumber(row.createdAtMs),
    updatedAt: toNumber(row.updatedAtMs)
  };
}

function mapParticipant(row: StdbParticipant): QuizRushState["participants"][number] {
  return {
    participantId: row.participantId,
    sessionId: row.sessionId,
    identity: row.identity,
    displayName: row.displayName,
    avatar: row.avatar,
    admissionStatus: row.admissionStatus as QuizRushState["participants"][number]["admissionStatus"],
    championStatus: row.championStatus as QuizRushState["participants"][number]["championStatus"],
    joinedAt: toNumber(row.joinedAtMs),
    lastSeen: toNumber(row.lastSeenMs),
    isSimulated: row.isSimulated,
    clientLatencyMs: row.clientLatencyMs ?? null
  };
}

function mapTopicVote(row: StdbTopicVote): QuizRushState["topicVotes"][number] {
  return {
    voteId: row.voteId,
    sessionId: row.sessionId,
    participantId: row.participantId,
    topic: row.topic,
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapPlayerIntent(row: StdbPlayerIntent): QuizRushState["playerIntents"][number] {
  return {
    intentId: row.intentId,
    sessionId: row.sessionId,
    participantId: row.participantId,
    rawText: row.rawText,
    transcriptSource: row.transcriptSource === "speech" ? "speech" : "typed",
    cleanedText: row.cleanedText,
    canonicalTopics: parseStringArray(row.canonicalTopicsJson),
    topicKey: row.topicKey,
    arenaName: row.arenaName,
    difficultyHint: row.difficultyHint as QuizRushState["playerIntents"][number]["difficultyHint"],
    confidence: row.confidence,
    status: row.status as QuizRushState["playerIntents"][number]["status"],
    createdAt: toNumber(row.createdAtMs),
    updatedAt: toNumber(row.updatedAtMs)
  };
}

function mapQuestionPack(row: StdbQuestionPack): QuizRushState["questionPacks"][number] {
  return {
    packId: row.packId,
    sessionId: row.sessionId,
    participantId: row.participantId ?? null,
    topicKey: row.topicKey,
    displayTopic: row.displayTopic,
    sourceType: row.sourceType as QuizRushState["questionPacks"][number]["sourceType"],
    qualityScore: row.qualityScore,
    status: row.status as QuizRushState["questionPacks"][number]["status"],
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapQuestion(row: StdbQuestionPublic): QuizRushState["questions"][number] {
  return {
    questionId: row.questionId,
    packId: row.packId ?? null,
    sessionId: row.sessionId,
    participantId: row.participantId ?? null,
    topicKey: row.topicKey,
    orderIndex: row.orderIndex,
    questionText: row.questionText,
    optionA: row.optionA,
    optionB: row.optionB,
    optionC: row.optionC,
    optionD: row.optionD,
    displayTopic: row.displayTopic,
    topic: row.topic,
    sourceTitle: row.sourceTitle || null,
    sourceUrl: row.sourceUrl || null,
    generatedBy: row.generatedBy,
    fairnessStatus: row.fairnessStatus as QuizRushState["questions"][number]["fairnessStatus"],
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapTopicFact(row: StdbTopicFact): QuizRushState["topicFacts"][number] {
  return {
    factId: row.factId,
    sessionId: row.sessionId,
    topicKey: row.topicKey,
    displayName: row.displayName,
    sourceTitle: row.sourceTitle,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType as QuizRushState["topicFacts"][number]["sourceType"],
    factText: row.factText,
    confidence: row.confidence,
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapRound(row: StdbRound): QuizRushState["rounds"][number] {
  return {
    roundId: row.roundId,
    sessionId: row.sessionId,
    questionId: row.questionId,
    orderIndex: row.orderIndex,
    status: row.status as QuizRushState["rounds"][number]["status"],
    startsAt: toNumber(row.startsAtMs),
    endsAt: toNumber(row.endsAtMs),
    resolvedAt: toNullableNumber(row.resolvedAtMs)
  };
}

function mapAnswer(row: StdbAnswer): QuizRushState["answers"][number] {
  return {
    answerId: row.answerId,
    sessionId: row.sessionId,
    roundId: row.roundId,
    questionId: row.questionId,
    participantId: row.participantId,
    selectedOption: row.selectedOption as OptionKey,
    isCorrect: row.isCorrect,
    responseMs: row.responseMs,
    responseMsServer: row.responseMsServer,
    officialResponseMs: row.officialResponseMs,
    observedResponseMs: row.observedResponseMs ?? null,
    clientQuestionRenderedAtMs: toNullableNumber(row.clientQuestionRenderedAtMs),
    clientClickedAtMs: toNullableNumber(row.clientClickedAtMs),
    clientSentAt: toNullableNumber(row.clientSentAtMs),
    clientEventId: row.clientEventId || null,
    correctnessPoints: row.correctnessPoints,
    speedBonus: row.speedBonus,
    streakBonus: row.streakBonus,
    scoreDelta: row.scoreDelta,
    serverReceivedAt: toNumber(row.serverReceivedAtMs),
    serverCommittedAt: toNumber(row.serverCommittedAtMs),
    participantLatencyMsSnapshot: row.participantLatencyMsSnapshot ?? null,
    timingSuspicious: row.timingSuspicious,
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapScore(row: StdbScore): QuizRushState["scores"][number] {
  return {
    scoreId: row.scoreId,
    sessionId: row.sessionId,
    participantId: row.participantId,
    totalScore: row.totalScore,
    correctCount: row.correctCount,
    wrongCount: row.wrongCount,
    answeredCount: row.answeredCount,
    totalResponseMs: row.totalResponseMs,
    totalOfficialResponseMs: row.totalOfficialResponseMs,
    totalObservedResponseMs: row.totalObservedResponseMs ?? null,
    fastestResponseMs: row.fastestResponseMs ?? null,
    fastestOfficialResponseMs: row.fastestOfficialResponseMs ?? null,
    fastestObservedResponseMs: row.fastestObservedResponseMs ?? null,
    averageResponseMs: row.averageResponseMs ?? null,
    averageOfficialResponseMs: row.averageOfficialResponseMs ?? null,
    normalizedScore: row.normalizedScore,
    streakCount: row.streakCount,
    lastAnswerCorrect: row.lastAnswerCorrect ?? null,
    championStatus: row.championStatus as QuizRushState["scores"][number]["championStatus"],
    currentRank: row.currentRank,
    previousRank: row.previousRank,
    lastAnswerAt: toNullableNumber(row.lastAnswerAtMs),
    updatedAt: toNumber(row.updatedAtMs)
  };
}

function mapFinalResult(row: StdbFinalResult): QuizRushState["finalResults"][number] {
  return {
    finalResultId: row.finalResultId,
    sessionId: row.sessionId,
    participantId: row.participantId,
    finalRank: row.finalRank,
    totalParticipants: row.totalParticipants,
    championStatus: row.championStatus as QuizRushState["finalResults"][number]["championStatus"],
    totalScore: row.totalScore,
    correctCount: row.correctCount,
    questionCount: row.questionCount,
    answeredCount: row.answeredCount,
    totalResponseMs: row.totalResponseMs,
    totalOfficialResponseMs: row.totalOfficialResponseMs,
    fastestResponseMs: row.fastestResponseMs ?? null,
    fastestOfficialResponseMs: row.fastestOfficialResponseMs ?? null,
    averageOfficialResponseMs: row.averageOfficialResponseMs ?? null,
    normalizedScore: row.normalizedScore,
    percentile: row.percentile,
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapShareCard(row: StdbShareCard): QuizRushState["shareCards"][number] {
  return {
    shareId: row.shareId,
    slug: row.slug,
    sessionId: row.sessionId,
    participantId: row.participantId,
    displayName: row.displayName,
    avatar: row.avatar,
    avatarType: row.avatarType as QuizRushState["shareCards"][number]["avatarType"],
    avatarEmoji: row.avatarEmoji ?? null,
    avatarColor: row.avatarColor ?? null,
    avatarUrl: row.avatarUrl ?? null,
    displayTopic: row.displayTopic,
    finalRank: row.finalRank,
    totalParticipants: row.totalParticipants,
    championStatus: row.championStatus as QuizRushState["shareCards"][number]["championStatus"],
    totalScore: row.totalScore,
    correctCount: row.correctCount,
    questionCount: row.questionCount,
    totalResponseMsOfficial: row.totalResponseMsOfficial,
    totalResponseMsObserved: row.totalResponseMsObserved ?? null,
    fastestResponseMs: row.fastestResponseMs ?? null,
    fastestResponseMsOfficial: row.fastestResponseMsOfficial ?? null,
    fastestResponseMsObserved: row.fastestResponseMsObserved ?? null,
    percentile: row.percentile,
    shareText: row.shareText,
    createdAt: toNumber(row.createdAtMs),
    expiresAt: toNullableNumber(row.expiresAtMs),
    viewCount: row.viewCount
  };
}

function mapSessionCapacity(row: StdbSessionCapacity): QuizRushState["sessionCapacities"][number] {
  return {
    sessionId: row.sessionId,
    maxRacersSoft: row.maxRacersSoft,
    maxRacersHard: row.maxRacersHard,
    admittedCount: row.admittedCount,
    waitlistedCount: row.waitlistedCount,
    spectatorCount: row.spectatorCount,
    status: row.status as QuizRushState["sessionCapacities"][number]["status"],
    reason: row.reason ?? null,
    updatedAt: toNumber(row.updatedAtMs)
  };
}

function mapAdmissionTicket(row: StdbAdmissionTicket): QuizRushState["admissionTickets"][number] {
  return {
    ticketId: row.ticketId,
    sessionId: row.sessionId,
    participantId: row.participantId,
    status: row.status as QuizRushState["admissionTickets"][number]["status"],
    queuePosition: row.queuePosition ?? null,
    issuedAt: toNumber(row.issuedAtMs)
  };
}

function mapMatchEvent(row: StdbMatchEvent): QuizRushState["matchEvents"][number] {
  return {
    eventId: row.eventId,
    sessionId: row.sessionId,
    participantId: row.participantId ?? null,
    eventType: row.eventType as QuizRushState["matchEvents"][number]["eventType"],
    roundIndex: row.roundIndex ?? null,
    scoreAfter: row.scoreAfter ?? null,
    rankAfter: row.rankAfter ?? null,
    payload: parseObject(row.payloadJson),
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapAgentRequest(row: StdbAgentRequest): QuizRushState["agentRequests"][number] {
  return {
    requestId: row.requestId,
    sessionId: row.sessionId,
    requestType: row.requestType as QuizRushState["agentRequests"][number]["requestType"],
    topic: row.topic,
    questionCount: row.questionCount,
    status: row.status as QuizRushState["agentRequests"][number]["status"],
    createdAt: toNumber(row.createdAtMs),
    updatedAt: toNumber(row.updatedAtMs),
    errorMessage: row.errorMessage ?? null
  };
}

function mapAgentEvent(row: StdbAgentEvent): QuizRushState["agentEvents"][number] {
  return {
    eventId: row.eventId,
    sessionId: row.sessionId,
    agentName: row.agentName,
    eventType: row.eventType,
    content: row.content,
    confidence: row.confidence,
    status: row.status as QuizRushState["agentEvents"][number]["status"],
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapLiveStats(row: StdbLiveStats): QuizRushState["liveStats"][number] {
  return {
    sessionId: row.sessionId,
    joinedCount: row.joinedCount,
    realJoinedCount: row.realJoinedCount,
    simulatedJoinedCount: row.simulatedJoinedCount,
    answersCount: row.answersCount,
    answersPerSec: row.answersPerSec,
    reducerCalls: row.reducerCalls,
    duplicateAnswersRejected: row.duplicateAnswersRejected,
    p95LatencyMs: row.p95LatencyMs,
    p95AnswerCommitMs: row.p95AnswerCommitMs,
    p95SubscriptionRenderMs: row.p95SubscriptionRenderMs,
    activeClients: row.activeClients,
    admittedRacers: row.admittedRacers,
    waitlistedUsers: row.waitlistedUsers,
    capacityStatus: row.capacityStatus as QuizRushState["liveStats"][number]["capacityStatus"],
    updatedAt: toNumber(row.updatedAtMs)
  };
}

function mapAuditEvent(row: StdbAuditEvent): QuizRushState["auditEvents"][number] {
  return {
    auditId: row.auditId,
    sessionId: row.sessionId,
    actorIdentity: row.actorIdentity,
    eventType: row.eventType,
    message: row.message,
    createdAt: toNumber(row.createdAtMs)
  };
}

function mapOperationTrace(row: StdbOperationTrace): QuizRushState["operationTraces"][number] {
  return {
    traceId: row.traceId,
    sessionId: row.sessionId,
    reducer: row.reducer,
    identity: row.identity,
    ok: row.ok,
    durationMs: row.durationMs,
    stateVersion: row.stateVersion,
    errorMessage: row.errorMessage ?? null,
    createdAt: toNumber(row.createdAtMs)
  };
}

function toRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function stringArg(args: AnyRecord, key: string, fallback = ""): string {
  const value = args[key];
  return typeof value === "string" ? value : fallback;
}

function optionalStringArg(args: AnyRecord, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value ? value : undefined;
}

function numberArg(args: AnyRecord, key: string, fallback: number): number {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumberArg(args: AnyRecord, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBigIntArg(args: AnyRecord, key: string, fallback?: number): bigint | undefined {
  const value = args[key];
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  return fallback === undefined ? undefined : BigInt(Math.trunc(fallback));
}

function arrayArg(args: AnyRecord, key: string): unknown[] {
  const value = args[key];
  return Array.isArray(value) ? value : [];
}

function toNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function toNullableNumber(value: bigint | number | null | undefined): number | null {
  return value === null || value === undefined ? null : toNumber(value);
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
