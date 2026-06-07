import { DbConnection } from "../apps/agent-worker/src/spacetime/module_bindings";

const shouldSuppressSdkCacheWarning = (args: unknown[]) => {
  const message = args.map((arg) => (typeof arg === "string" ? arg : "")).join(" ");
  return message.includes("Updating a row that was not present in the cache");
};

const originalConsoleLog = console.log.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

console.log = (...args: unknown[]) => {
  if (shouldSuppressSdkCacheWarning(args)) return;
  originalConsoleLog(...args);
};
console.warn = (...args: unknown[]) => {
  if (shouldSuppressSdkCacheWarning(args)) return;
  originalConsoleWarn(...args);
};
console.error = (...args: unknown[]) => {
  if (shouldSuppressSdkCacheWarning(args)) return;
  originalConsoleError(...args);
};

const host = process.env.STDB_HOST ?? process.env.AGENT_SPACETIMEDB_HOST ?? process.env.VITE_SPACETIMEDB_HOST ?? "https://maincloud.spacetimedb.com";
const moduleName = process.env.STDB_MODULE ?? process.env.AGENT_SPACETIMEDB_MODULE ?? process.env.VITE_SPACETIMEDB_MODULE ?? "quizrush-live";
const appUrl = process.env.APP_URL ?? process.env.VITE_PUBLIC_APP_URL ?? "https://quizel-eta.vercel.app";
const sessionCode = process.env.SESSION ?? process.env.SESSION_CODE ?? "ARENA-42";

async function main() {
  const connection = await connect();
  try {
    const session =
      Array.from(connection.db.session.iter()).find((row) => row.code === sessionCode || row.sessionId === sessionCode) ??
      Array.from(connection.db.session.iter())[0];
    const sessionId = session?.sessionId ?? sessionCode;
    const participants = Array.from(connection.db.participant.iter()).filter((row) => row.sessionId === sessionId);
    const participantIds = new Set(participants.map((row) => row.participantId));

    const report = {
      generatedAt: new Date().toISOString(),
      deployment: {
        appUrl,
        joinUrl: `${appUrl.replace(/\/$/, "")}/join/${session?.code ?? sessionCode}`,
        arenaUrl: `${appUrl.replace(/\/$/, "")}/arena/${session?.code ?? sessionCode}`,
        spacetimeHost: host,
        spacetimeModule: moduleName,
        connected: true
      },
      session,
      capacity: Array.from(connection.db.session_capacity.iter()).find((row) => row.sessionId === sessionId) ?? null,
      counts: {
        participants: participants.length,
        admitted: participants.filter((row) => row.admissionStatus === "admitted").length,
        waitlisted: participants.filter((row) => row.admissionStatus === "waitlisted").length,
        spectators: participants.filter((row) => row.admissionStatus === "spectator").length,
        admissionTickets: Array.from(connection.db.admission_ticket.iter()).filter((row) => row.sessionId === sessionId).length,
        playerIntents: Array.from(connection.db.player_intent.iter()).filter((row) => row.sessionId === sessionId).length,
        generationJobs: Array.from(connection.db.agent_request.iter()).filter((row) => row.sessionId === sessionId).length,
        participantQuestionPacks: Array.from(connection.db.question_pack.iter()).filter((row) => row.sessionId === sessionId && participantIds.has(row.participantId ?? "")).length,
        roomQuestionPacks: Array.from(connection.db.question_pack.iter()).filter((row) => row.sessionId === sessionId && !row.participantId).length,
        questionPublic: Array.from(connection.db.question_public.iter()).filter((row) => row.sessionId === sessionId).length,
        rounds: Array.from(connection.db.round.iter()).filter((row) => row.sessionId === sessionId).length,
        answers: Array.from(connection.db.answer.iter()).filter((row) => row.sessionId === sessionId).length,
        scores: Array.from(connection.db.score.iter()).filter((row) => row.sessionId === sessionId).length,
        finalResults: Array.from(connection.db.final_result.iter()).filter((row) => row.sessionId === sessionId).length,
        shareCards: Array.from(connection.db.share_card.iter()).filter((row) => row.sessionId === sessionId).length,
        clientErrors: Array.from(connection.db.client_error.iter()).filter((row) => row.sessionId === sessionId).length
      },
      participants: participants
        .sort((a, b) => Number(a.joinedAtMs - b.joinedAtMs))
        .map((row) => ({
          participantId: row.participantId,
          identity: row.identity,
          displayName: row.displayName,
          admissionStatus: row.admissionStatus,
          championStatus: row.championStatus,
          isSimulated: row.isSimulated,
          lastSeenMs: Number(row.lastSeenMs)
        })),
      admissionTickets: latest(
        Array.from(connection.db.admission_ticket.iter()).filter((row) => row.sessionId === sessionId),
        "issuedAtMs",
        50
      ),
      playerIntents: latest(
        Array.from(connection.db.player_intent.iter()).filter((row) => row.sessionId === sessionId),
        "createdAtMs",
        50
      ).map((row) => ({
        participantId: row.participantId,
        rawText: row.rawText,
        arenaName: row.arenaName,
        topicKey: row.topicKey,
        status: row.status
      })),
      generationJobs: latest(Array.from(connection.db.agent_request.iter()).filter((row) => row.sessionId === sessionId), "createdAtMs", 50),
      participantQuestionPacks: latest(
        Array.from(connection.db.question_pack.iter()).filter((row) => row.sessionId === sessionId && participantIds.has(row.participantId ?? "")),
        "createdAtMs",
        50
      ).map((row) => ({
        packId: row.packId,
        participantId: row.participantId,
        displayTopic: row.displayTopic,
        sourceType: row.sourceType,
        qualityScore: row.qualityScore,
        status: row.status
      })),
      rounds: latest(Array.from(connection.db.round.iter()).filter((row) => row.sessionId === sessionId), "startsAtMs", 50),
      scores: Array.from(connection.db.score.iter())
        .filter((row) => row.sessionId === sessionId)
        .sort((a, b) => a.currentRank - b.currentRank)
        .slice(0, 50)
        .map((row) => ({
          participantId: row.participantId,
          rank: row.currentRank,
          totalScore: row.totalScore,
          correctCount: row.correctCount,
          answeredCount: row.answeredCount,
          totalAnswerResponseMs: row.totalAnswerResponseMs,
          fastestOfficialResponseMs: row.fastestOfficialResponseMs ?? null
        })),
      reducerFailures: latest(
        Array.from(connection.db.operation_trace.iter()).filter((row) => row.sessionId === sessionId && !row.ok),
        "createdAtMs",
        50
      ),
      clientErrors: latest(Array.from(connection.db.client_error.iter()).filter((row) => row.sessionId === sessionId), "createdAtMs", 50),
      agentEvents: latest(Array.from(connection.db.agent_event.iter()).filter((row) => row.sessionId === sessionId), "createdAtMs", 50),
      matchEvents: latest(Array.from(connection.db.match_event.iter()).filter((row) => row.sessionId === sessionId), "createdAtMs", 50)
    };

    console.log(JSON.stringify(report, (_, value) => (typeof value === "bigint" ? Number(value) : value), 2));
  } finally {
    connection.disconnect();
  }
}

function connect(): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error("Timed out connecting to SpacetimeDB."));
    }, 15_000);
    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(moduleName)
      .withConfirmedReads(false)
      .onConnect((connected) => {
        connected
          .subscriptionBuilder()
          .onApplied(() => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(connected);
          })
          .onError((_ctx, error) => {
            if (!settled) reject(error);
          })
          .subscribeToAllTables();
      })
      .onConnectError((_ctx, error) => {
        if (!settled) reject(error);
      })
      .onDisconnect((_ctx, error) => {
        if (!settled && error) reject(error);
      })
      .build();
    return connection;
  });
}

function latest<T extends Record<string, unknown>>(rows: T[], key: keyof T, count: number): T[] {
  return rows
    .sort((a, b) => toNumber(b[key]) - toNumber(a[key]))
    .slice(0, count);
}

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
