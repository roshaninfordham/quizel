import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { QUESTION_COUNT } from "../packages/shared/src/constants";
import { DbConnection } from "../apps/agent-worker/src/spacetime/module_bindings";

interface LoadClient {
  id: number;
  connection: DbConnection;
}

interface TimedSample {
  ok: boolean;
  ms: number;
  error?: string;
}

interface LoadResult {
  runId: string;
  startedAt: string;
  config: {
    users: number;
    topics: number;
    host: string;
    module: string;
    appUrl: string;
    subscribeAllTables: boolean;
    connectConcurrency: number;
    joinConcurrency: number;
    answerConcurrency: number;
  };
  staticVercel: {
    attempted: number;
    ok: number;
    failed: number;
    p50Ms: number;
    p95Ms: number;
  };
  realtime: {
    connected: number;
    joined: number;
    joinFailed: number;
    answerAttempts: number;
    answerSendOk: number;
    answerSendFailed: number;
    answerCommitted: number;
    duplicateRejected: number;
    roundsResolved: number;
    finalStatus: string | null;
    participantsAfterRun: number;
    answersAfterRun: number;
    scoresAfterRun: number;
  };
  timings: {
    connect: Stats;
    join: Stats;
    answer: Stats;
    roundResolve: Stats;
    startMatch: Stats;
    staticFetch: Stats;
  };
  throughput: {
    answerWindowMs: number;
    successfulAnswersPerSec: number;
  };
  observed: {
    reducerCalls: number;
    liveStatsAnswersPerSec: number;
    duplicateAnswersRejected: number;
    p95LatencyMs: number;
    topScore: number;
  };
  errors: {
    fatal?: string;
    connect: string[];
    join: string[];
    answer: string[];
    roundResolve: string[];
  };
  recommendation: {
    status: "pass" | "degraded" | "fail";
    notes: string[];
  };
}

interface Stats {
  count: number;
  ok: number;
  failed: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

const sourceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(sourceDir, "..");

const users = numberEnv("USERS", 100);
const topics = numberEnv("TOPICS", 10);
const host = process.env.STDB_HOST ?? process.env.AGENT_SPACETIMEDB_HOST ?? "https://maincloud.spacetimedb.com";
const moduleName = process.env.STDB_MODULE ?? process.env.AGENT_SPACETIMEDB_MODULE ?? "quizrush-live";
const appUrl = process.env.APP_URL ?? "https://quizel-eta.vercel.app";
const code = process.env.SESSION_CODE ?? "ARENA-42";
const sessionId = process.env.SESSION_ID ?? "session-demo";
const subscribeAllTables = process.env.SUBSCRIBE_ALL_TABLES !== "false";
const connectConcurrency = numberEnv("CONNECT_CONCURRENCY", 50);
const joinConcurrency = numberEnv("JOIN_CONCURRENCY", 50);
const answerConcurrency = numberEnv("ANSWER_CONCURRENCY", 200);
const staticRequests = numberEnv("STATIC_REQUESTS", Math.min(users, 100));
const staticConcurrency = numberEnv("STATIC_CONCURRENCY", 25);
const resetAfter = process.env.RESET_AFTER !== "false";
const runId = process.env.RUN_ID ?? `load-${new Date().toISOString().replace(/[:.]/g, "-")}`;

const avatarChoices = ["R", "A", "Q", "S", "T", "Z", "K", "M"];

async function main() {
  const startedAt = new Date().toISOString();
  const clients: LoadClient[] = [];
  let operator: LoadClient | undefined;
  const connectSamples: TimedSample[] = [];
  const joinSamples: TimedSample[] = [];
  const answerSamples: TimedSample[] = [];
  const resolveSamples: TimedSample[] = [];
  const startSamples: TimedSample[] = [];
  const roundTransitionSamples: TimedSample[] = [];
  let fatalError: string | undefined;
  let answerWindowStart = 0;
  let answerWindowEnd = 0;
  const roundCommitSamples: TimedSample[] = [];

  try {
    const staticSamples = await measureStaticVercel();
    operator = await connectClient(-1, true);
    await callReducer(operator.connection.reducers.resetDemo({ sessionId }), "reset_demo");
    await waitFor(() => Array.from(operator!.connection.db.session.iter()).some((row) => row.sessionId === sessionId && row.status === "lobby"));
    await callReducer(
      operator.connection.reducers.requestQuestions({
        sessionId,
        topic: topicFor(0),
        questionCount: QUESTION_COUNT
      }),
      "request_questions"
    );
    await waitFor(() => Array.from(operator!.connection.db.question_public.iter()).filter((row) => row.sessionId === sessionId).length >= QUESTION_COUNT);

    const connected = await mapLimit(
      Array.from({ length: users }, (_, id) => id),
      connectConcurrency,
      async (id) => {
        const sample = await timed(async () => connectClient(id, subscribeAllTables));
        connectSamples.push(sample);
        if (!sample.ok || !sampleValue<LoadClient>(sample)) return undefined;
        return sampleValue<LoadClient>(sample);
      }
    );
    for (const client of connected) {
      if (client) clients.push(client);
    }

    await mapLimit(clients, joinConcurrency, async (client) => {
      const sample = await timed(async () => {
        await client.connection.reducers.joinSession({
          code,
          displayName: `Load ${client.id + 1}`,
          avatar: avatarChoices[client.id % avatarChoices.length] ?? "R"
        });
        await client.connection.reducers.submitPlayerIntent({
          sessionId,
          rawText: topicFor(client.id),
          transcriptSource: "typed"
        });
      });
      joinSamples.push(sample);
    });

    await waitFor(() => Array.from(operator!.connection.db.participant.iter()).filter((row) => row.sessionId === sessionId).length >= joinedCount(joinSamples), 15_000);
    startSamples.push(await timed(async () => operator!.connection.reducers.startMatch({ sessionId })));
    await waitFor(() => activeRoundFor(operator!.connection, 1) !== undefined, 10_000);

    answerWindowStart = performance.now();
    for (let roundIndex = 1; roundIndex <= QUESTION_COUNT; roundIndex += 1) {
      const roundSample = await timed(async () => waitForValue(() => activeRoundFor(operator!.connection, roundIndex), 10_000));
      roundTransitionSamples.push(roundSample);
      const round = sampleValue<NonNullable<ReturnType<typeof activeRoundFor>>>(roundSample);
      if (!round) {
        fatalError = roundSample.error ?? `Timed out waiting for round ${roundIndex}.`;
        break;
      }
      const startsAtMs = typeof round.startsAtMs === "bigint" ? Number(round.startsAtMs) : round.startsAtMs;
      const waitMs = startsAtMs - Date.now() + 25;
      if (waitMs > 0) await sleep(waitMs);
      const beforeRoundAnswers = roundAnswerCount(operator.connection, round.roundId);
      await mapLimit(clients, answerConcurrency, async (client) => {
        const selectedOption = (["A", "B", "C", "D"] as const)[(client.id + roundIndex) % 4] ?? "A";
        const sample = await timed(async () =>
          client.connection.reducers.submitAnswer({
            roundId: round.roundId,
            selectedOption,
            clientQuestionRenderedAtMs: BigInt(Math.max(0, Math.round(performance.now() - 250))),
            clientClickedAtMs: BigInt(Math.round(performance.now())),
            clientSentAtMs: BigInt(Date.now())
          })
        );
        answerSamples.push(sample);
      });
      roundCommitSamples.push(
        await timed(async () =>
          waitFor(
            () => roundAnswerCount(operator!.connection, round.roundId) >= Math.min(clients.length, beforeRoundAnswers + clients.length),
            4_000
          )
        )
      );
      resolveSamples.push(await timed(async () => operator!.connection.reducers.resolveRound({ roundId: round.roundId })));
      roundTransitionSamples.push(
        await timed(async () =>
          waitFor(
            () =>
              roundIndex >= QUESTION_COUNT
                ? currentSession(operator!.connection)?.status === "finished"
                : activeRoundFor(operator!.connection, roundIndex + 1) !== undefined,
            4_000
          )
        )
      );
    }
    answerWindowEnd = performance.now();

    await waitFor(() => currentSession(operator!.connection)?.status === "finished", 10_000).catch(() => undefined);
    const snapshot = snapshotCounts(operator.connection);
    const stats = Array.from(operator.connection.db.live_stats.iter()).find((row) => row.sessionId === sessionId);
    const topScore = Array.from(operator.connection.db.score.iter())
      .filter((row) => row.sessionId === sessionId)
      .sort((a, b) => a.currentRank - b.currentRank)[0]?.totalScore ?? 0;
    const answerSendOk = answerSamples.filter((sample) => sample.ok).length;
    const answerCommitted = snapshot.answers;
    const result: LoadResult = {
      runId,
      startedAt,
      config: {
        users,
        topics,
        host,
        module: moduleName,
        appUrl,
        subscribeAllTables,
        connectConcurrency,
        joinConcurrency,
        answerConcurrency
      },
      staticVercel: {
        attempted: staticSamples.length,
        ok: staticSamples.filter((sample) => sample.ok).length,
        failed: staticSamples.filter((sample) => !sample.ok).length,
        p50Ms: statsFor(staticSamples).p50Ms,
        p95Ms: statsFor(staticSamples).p95Ms
      },
      realtime: {
        connected: clients.length,
        joined: joinedCount(joinSamples),
        joinFailed: joinSamples.filter((sample) => !sample.ok).length,
        answerAttempts: answerSamples.length,
        answerSendOk,
        answerSendFailed: answerSamples.filter((sample) => !sample.ok).length,
        answerCommitted,
        duplicateRejected: answerSamples.filter((sample) => /duplicate/i.test(sample.error ?? "")).length,
        roundsResolved: resolveSamples.filter((sample) => sample.ok).length,
        finalStatus: currentSession(operator.connection)?.status ?? null,
        participantsAfterRun: snapshot.participants,
        answersAfterRun: snapshot.answers,
        scoresAfterRun: snapshot.scores
      },
      timings: {
        connect: statsFor(connectSamples),
        join: statsFor(joinSamples),
        answer: statsFor(answerSamples),
        roundResolve: statsFor([...resolveSamples, ...roundCommitSamples, ...roundTransitionSamples]),
        startMatch: statsFor(startSamples),
        staticFetch: statsFor(staticSamples)
      },
      throughput: {
        answerWindowMs: Math.round(answerWindowEnd - answerWindowStart),
        successfulAnswersPerSec: answerWindowEnd > answerWindowStart ? round(answerCommitted / ((answerWindowEnd - answerWindowStart) / 1000)) : 0
      },
      observed: {
        reducerCalls: stats?.reducerCalls ?? 0,
        liveStatsAnswersPerSec: stats?.answersPerSec ?? 0,
        duplicateAnswersRejected: stats?.duplicateAnswersRejected ?? 0,
        p95LatencyMs: stats?.p95LatencyMs ?? 0,
        topScore
      },
      errors: {
        fatal: fatalError,
        connect: sampleErrors(connectSamples),
        join: sampleErrors(joinSamples),
        answer: sampleErrors(answerSamples),
        roundResolve: sampleErrors([...resolveSamples, ...roundCommitSamples, ...roundTransitionSamples])
      },
      recommendation: recommendation({ joinSamples, answerSamples, clients, users, answerCommitted, fatalError })
    };

    await writeResult(result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (operator && resetAfter) {
      await operator.connection.reducers.resetDemo({ sessionId }).catch(() => undefined);
    }
    for (const client of clients) client.connection.disconnect();
    operator?.connection.disconnect();
  }
}

async function connectClient(id: number, subscribeAll: boolean): Promise<LoadClient> {
  return await new Promise<LoadClient>((resolvePromise, reject) => {
    let settled = false;
    let subscriptionStarted = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error(`connect ${id} timed out`));
    }, 15_000);
    const resolveClient = (connection: DbConnection) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ id, connection });
    };
    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(moduleName)
      .withConfirmedReads(false)
      .onConnect((connected) => {
        if (!subscribeAll) {
          resolveClient(connected);
          return;
        }
        if (subscriptionStarted) return;
        subscriptionStarted = true;
        connected
          .subscriptionBuilder()
          .onApplied(() => resolveClient(connected))
          .onError(() => reject(new Error(`subscription ${id} failed`)))
          .subscribeToAllTables();
      })
      .onConnectError((_ctx, error) => reject(error))
      .onDisconnect((_ctx, error) => {
        if (!settled && error) reject(error);
      })
      .build();
    return connection;
  });
}

async function measureStaticVercel(): Promise<TimedSample[]> {
  const urls = Array.from({ length: staticRequests }, (_, index) => `${appUrl.replace(/\/$/, "")}/join/${code}?load=${runId}-${index}`);
  return await mapLimit(urls, staticConcurrency, (url) =>
    timed(async () => {
      const response = await fetch(url, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.arrayBuffer();
    })
  );
}

async function timed<T>(fn: () => Promise<T>): Promise<TimedSample & { value?: T }> {
  const started = performance.now();
  try {
    const value = await fn();
    return { ok: true, ms: Math.round(performance.now() - started), value };
  } catch (error) {
    return {
      ok: false,
      ms: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function sampleValue<T>(sample: TimedSample): T | undefined {
  return (sample as TimedSample & { value?: T }).value;
}

async function callReducer(promise: Promise<void>, name: string): Promise<void> {
  const result = await timed(async () => promise);
  if (!result.ok) throw new Error(`${name} failed: ${result.error}`);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  await waitForValue(() => (predicate() ? true : undefined), timeoutMs);
}

async function waitForValue<T>(getter: () => T | undefined, timeoutMs = 10_000): Promise<T> {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const value = getter();
    if (value !== undefined) return value;
    await sleep(25);
  }
  throw new Error("Timed out waiting for condition.");
}

function activeRound(connection: DbConnection) {
  return Array.from(connection.db.round.iter()).find((row) => row.sessionId === sessionId && row.status === "active");
}

function activeRoundFor(connection: DbConnection, orderIndex: number) {
  return Array.from(connection.db.round.iter()).find(
    (row) => row.sessionId === sessionId && row.status === "active" && row.orderIndex === orderIndex
  );
}

function currentSession(connection: DbConnection) {
  return Array.from(connection.db.session.iter()).find((row) => row.sessionId === sessionId);
}

function snapshotCounts(connection: DbConnection) {
  return {
    participants: Array.from(connection.db.participant.iter()).filter((row) => row.sessionId === sessionId).length,
    answers: Array.from(connection.db.answer.iter()).filter((row) => row.sessionId === sessionId).length,
    scores: Array.from(connection.db.score.iter()).filter((row) => row.sessionId === sessionId).length
  };
}

function roundAnswerCount(connection: DbConnection, roundId: string): number {
  return Array.from(connection.db.answer.round_id.filter(roundId)).length;
}

function joinedCount(samples: TimedSample[]): number {
  return samples.filter((sample) => sample.ok).length;
}

function topicFor(index: number): string {
  const baseTopics = ["Andaman Islands", "Fruit Science", "US Visa System", "AI agents", "Formula 1 strategy", "Space technology"];
  return baseTopics[index % Math.max(1, Math.min(topics, baseTopics.length))] ?? "General Knowledge";
}

function statsFor(samples: TimedSample[]): Stats {
  const sorted = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  return {
    count: samples.length,
    ok: samples.filter((sample) => sample.ok).length,
    failed: samples.filter((sample) => !sample.ok).length,
    minMs: sorted[0] ?? 0,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1] ?? 0
  };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

function recommendation(input: {
  joinSamples: TimedSample[];
  answerSamples: TimedSample[];
  clients: LoadClient[];
  users: number;
  answerCommitted: number;
  fatalError?: string;
}): LoadResult["recommendation"] {
  const answerStats = statsFor(input.answerSamples);
  const joinStats = statsFor(input.joinSamples);
  const expectedAnswers = input.clients.length * QUESTION_COUNT;
  const notes: string[] = [];
  let status: LoadResult["recommendation"]["status"] = "pass";
  if (input.clients.length < input.users) {
    status = "fail";
    notes.push(`Only ${input.clients.length}/${input.users} clients connected.`);
  }
  if (input.fatalError) {
    status = "fail";
    notes.push(`Race flow stopped early: ${input.fatalError}`);
  }
  if (joinStats.failed > 0) {
    status = "fail";
    notes.push(`${joinStats.failed} join/intention writes failed.`);
  }
  if (answerStats.failed > 0) {
    status = "degraded";
    notes.push(`${answerStats.failed} answer writes failed or arrived late.`);
  }
  if (input.answerCommitted < expectedAnswers) {
    status = "fail";
    notes.push(`Only ${input.answerCommitted}/${expectedAnswers} expected answers were visible as committed Answer rows.`);
  }
  if (answerStats.p95Ms > 750) {
    status = status === "fail" ? "fail" : "degraded";
    notes.push(`Answer reducer p95 observed at ${answerStats.p95Ms}ms, above 750ms target.`);
  }
  if (!notes.length) notes.push("No connection, join, or answer failures at this load level.");
  return { status, notes };
}

function sampleErrors(samples: TimedSample[]): string[] {
  return Array.from(new Set(samples.filter((sample) => !sample.ok).map((sample) => sample.error ?? "unknown error"))).slice(0, 5);
}

async function writeResult(result: LoadResult): Promise<void> {
  const outputPath = resolve(repoRoot, "docs", "capacity-results", `${result.runId}.json`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(resolve(repoRoot, "docs", "capacity-results", "latest.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
