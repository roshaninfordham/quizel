import { Effect } from "effect";
import { QUESTION_COUNT, type OptionKey, type QuizRushState, type ReducerReceipt } from "@quizrush/shared";
import { SpacetimeWriteError } from "../llm/errors";
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
import type { RealtimeClient } from "./realtimeClient";

type AnyRecord = Record<string, unknown>;

const reducerMethods: Record<string, string> = {
  record_agent_event: "recordAgentEvent",
  submit_question_pack: "submitQuestionPack",
  submit_topic_facts: "submitTopicFacts"
};

export function makeDirectSpacetimeClient(input: {
  host: string;
  module: string;
}): Effect.Effect<RealtimeClient, SpacetimeWriteError> {
  return Effect.tryPromise({
    try: async () => {
      let latestSnapshot: { state: QuizRushState; stateVersion: number } | null = null;
      let lastDeliveredVersion = -1;
      let stateVersion = 0;
      const snapshotWaiters = new Set<{
        resolve: (snapshot: { state: QuizRushState; stateVersion: number }) => void;
        reject: (error: Error) => void;
      }>();

      const emitSnapshot = (connection: DbConnection) => {
        stateVersion += 1;
        latestSnapshot = { state: snapshotFromDirectConnection(connection), stateVersion };
        for (const waiter of snapshotWaiters) waiter.resolve(latestSnapshot);
        snapshotWaiters.clear();
      };

      const failWaiters = (error: Error) => {
        for (const waiter of snapshotWaiters) waiter.reject(error);
        snapshotWaiters.clear();
      };

      const connection = await new Promise<DbConnection>((resolve, reject) => {
        let removeListeners: (() => void) | undefined;
        const built = DbConnection.builder()
          .withUri(input.host)
          .withDatabaseName(input.module)
          .withConfirmedReads(false)
          .withToken(process.env.AGENT_SPACETIMEDB_TOKEN || undefined)
          .onConnect((connected) => {
            removeListeners = registerDirectSnapshotListeners(connected, () => emitSnapshot(connected));
            connected
              .subscriptionBuilder()
              .onApplied(() => {
                emitSnapshot(connected);
                resolve(connected);
              })
              .onError(() => {
                removeListeners?.();
                reject(new Error("Direct SpaceTimeDB subscription failed."));
              })
              .subscribeToAllTables();
          })
          .onConnectError((_ctx, error) => reject(error))
          .onDisconnect((_ctx, error) => {
            removeListeners?.();
            if (error) failWaiters(error);
          })
          .build();
        setTimeout(() => reject(new Error("Direct SpaceTimeDB connection timed out.")), 10_000);
        return built;
      });

      return {
        waitForSnapshot: () =>
          Effect.tryPromise({
            try: () =>
              new Promise<QuizRushState>((resolve, reject) => {
                if (latestSnapshot && latestSnapshot.stateVersion !== lastDeliveredVersion) {
                  lastDeliveredVersion = latestSnapshot.stateVersion;
                  resolve(latestSnapshot.state);
                  return;
                }
                snapshotWaiters.add({
                  resolve: (snapshot) => {
                    lastDeliveredVersion = snapshot.stateVersion;
                    resolve(snapshot.state);
                  },
                  reject
                });
              }),
            catch: (error) => new SpacetimeWriteError(error instanceof Error ? error.message : String(error))
          }),
        callReducer: <T = unknown>(reducer: string, args: unknown) =>
          Effect.tryPromise({
            try: async () => {
              const methodName = reducerMethods[reducer];
              const method = methodName ? (connection.reducers as Record<string, (params: unknown) => Promise<void>>)[methodName] : undefined;
              if (!method) throw new Error(`Unknown direct SpaceTimeDB reducer: ${reducer}`);
              await method(toDirectReducerArgs(reducer, args));
              emitSnapshot(connection);
              return {
                ok: true,
                reducer,
                stateVersion,
                serverTime: Date.now()
              } satisfies ReducerReceipt<T>;
            },
            catch: (error) => new SpacetimeWriteError(error instanceof Error ? error.message : String(error))
          }),
        close: () => Effect.sync(() => connection.disconnect())
      };
    },
    catch: (error) => new SpacetimeWriteError(error instanceof Error ? error.message : String(error))
  });
}

function registerDirectSnapshotListeners(connection: DbConnection, onChange: () => void): () => void {
  const tables = [
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

  const removers: Array<() => void> = [];
  for (const table of tables) {
    const onInsert = () => onChange();
    const onDelete = () => onChange();
    const onUpdate = () => onChange();
    table.onInsert(onInsert);
    table.onDelete(onDelete);
    table.onUpdate?.(onUpdate);
    removers.push(() => {
      table.removeOnInsert(onInsert);
      table.removeOnDelete(onDelete);
      table.removeOnUpdate?.(onUpdate);
    });
  }

  return () => {
    for (const remove of removers) remove();
  };
}

function snapshotFromDirectConnection(connection: DbConnection): QuizRushState {
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

function toDirectReducerArgs(name: string, rawArgs: unknown): unknown {
  const args = toRecord(rawArgs);
  switch (name) {
    case "record_agent_event":
      return {
        sessionId: stringArg(args, "sessionId"),
        agentName: stringArg(args, "agentName", "Agent Worker"),
        eventType: stringArg(args, "eventType", "event"),
        content: stringArg(args, "content"),
        confidence: numberArg(args, "confidence", 0.8),
        status: stringArg(args, "status", "complete")
      };
    case "submit_question_pack":
      return {
        sessionId: stringArg(args, "sessionId"),
        selectedTopic: stringArg(args, "selectedTopic"),
        questionsJson: JSON.stringify({ questions: arrayArg(args, "questions") }),
        requestId: optionalStringArg(args, "requestId")
      };
    case "submit_topic_facts":
      return {
        sessionId: stringArg(args, "sessionId"),
        topicKey: stringArg(args, "topicKey"),
        factsJson: JSON.stringify({ facts: arrayArg(args, "facts") })
      };
    default:
      return args;
  }
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
  return { voteId: row.voteId, sessionId: row.sessionId, participantId: row.participantId, topic: row.topic, createdAt: toNumber(row.createdAtMs) };
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
