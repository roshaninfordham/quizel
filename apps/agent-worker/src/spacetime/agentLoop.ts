import { Duration, Effect } from "effect";
import type { AgentRequest, QuizRushState, Round, Session, TopicVote } from "@quizrush/shared";
import { generateHostCommentary, generateLearningRecap, generateQuizQuestions, routeTopic } from "../agents/quizAgents";
import { selectLlmProvider } from "../llm/service";
import type { LlmProvider } from "../llm/provider";
import type { WorkerConfig } from "../effects/config";
import { selectInstantQuizPack } from "../quiz/InstantQuizEngine";
import { makeRealtimeClient, requireOk, type RealtimeClient } from "./realtimeClient";

export function runRealtimeAgentWorker(config: WorkerConfig, provider: LlmProvider): Effect.Effect<void, never> {
  return Effect.forever(
    makeRealtimeClient(config.realtime.url).pipe(
      Effect.flatMap((client) => runConnectedLoop(client, config, provider).pipe(Effect.ensuring(client.close()))),
      Effect.catchAll((error) =>
        Effect.logWarning("Agent worker reconnecting", { error: error.message }).pipe(
          Effect.zipRight(Effect.sleep(Duration.seconds(1)))
        )
      )
    )
  );
}

function runConnectedLoop(client: RealtimeClient, config: WorkerConfig, provider: LlmProvider): Effect.Effect<void, never> {
  const processedRequests = new Set<string>();
  const inFlightRequests = new Set<string>();
  const processedRounds = new Set<string>();
  const processedSessions = new Set<string>();
  const providerSelection = selectLlmProvider(config);

  return Effect.forever(
    client.waitForSnapshot().pipe(
      Effect.flatMap((state) =>
        Effect.gen(function* () {
          const pendingRequests = state.agentRequests.filter(
            (request) => request.status === "pending" && !processedRequests.has(request.requestId) && !inFlightRequests.has(request.requestId)
          );
          const resolvedRounds = state.rounds.filter((round) => round.status === "resolved" && !processedRounds.has(round.roundId));
          const finishedSessions = state.sessions.filter(
            (session) => session.status === "finished" && !processedSessions.has(session.sessionId)
          );

          if (pendingRequests.length || resolvedRounds.length || finishedSessions.length) {
            yield* Effect.logInfo("Agent worker snapshot work discovered", {
              pendingRequests: pendingRequests.length,
              resolvedRounds: resolvedRounds.length,
              finishedSessions: finishedSessions.length
            });
          }

          yield* Effect.all(
            [
              ...pendingRequests.map((request) =>
                Effect.sync(() => inFlightRequests.add(request.requestId)).pipe(
                  Effect.zipRight(processAgentRequest(client, provider, config, state, request, providerSelection.providerName)),
                  Effect.ensuring(
                    Effect.sync(() => {
                      inFlightRequests.delete(request.requestId);
                      processedRequests.add(request.requestId);
                    })
                  )
                )
              ),
              ...resolvedRounds.map((round) =>
                processResolvedRound(client, provider, config, state, round).pipe(
                  Effect.tap(() => Effect.sync(() => processedRounds.add(round.roundId)))
                )
              ),
              ...finishedSessions.map((session) =>
                processFinishedSession(client, provider, config, state, session).pipe(
                  Effect.tap(() => Effect.sync(() => processedSessions.add(session.sessionId)))
                )
              )
            ],
            { concurrency: 3, discard: true }
          );
        })
      ),
      Effect.catchAll((error) => Effect.logWarning("Agent loop snapshot processing failed", { error: error.message }))
    )
  );
}

function processAgentRequest(
  client: RealtimeClient,
  provider: LlmProvider,
  config: WorkerConfig,
  state: QuizRushState,
  request: AgentRequest,
  providerName: string
): Effect.Effect<void, never> {
  if (request.requestType !== "quiz_generation") return Effect.void;

  return Effect.gen(function* () {
    yield* Effect.logInfo("Agent worker processing QuizRush request", {
      requestId: request.requestId,
      sessionId: request.sessionId,
      providerName
    });

    yield* client.callReducer("record_agent_event", {
      sessionId: request.sessionId,
      agentName: "Quiz Builder Agent",
      eventType: "generation_started",
      content: `Using ${providerName} for ${request.topic}.`,
      confidence: 0.9,
      status: "running"
    }).pipe(Effect.flatMap(requireOk), Effect.catchAll(() => Effect.void));

    const routing = yield* routeTopic(
      provider,
      {
        timeoutMs: config.llm.timeoutMs,
        maxRetries: config.llm.maxRetries,
        enableSafetyGuard: config.llm.safetyGuardEnabled
      },
      {
        topicCounts: topicCountsForSession(state.topicVotes, request.sessionId),
        defaultTopic: request.topic
      }
    );

    yield* client.callReducer("record_agent_event", {
      sessionId: request.sessionId,
      agentName: routing.event.agentName,
      eventType: routing.event.eventType,
      content: routing.event.content,
      confidence: routing.event.confidence,
      status: routing.event.status
    }).pipe(Effect.flatMap(requireOk), Effect.catchAll(() => Effect.void));

    const instantPack = yield* selectInstantQuizPack(
      provider,
      {
        timeoutMs: Math.min(config.llm.timeoutMs, 1500),
        includeLlm: false
      },
      {
        topic: routing.selectedTopic,
        questionCount: request.questionCount
      }
    );

    yield* client.callReducer("record_agent_event", {
      sessionId: request.sessionId,
      agentName: "Instant Quiz Engine",
      eventType: "instant_pack_ready",
      content: `First valid pack ready from ${instantPack.sourceType.replace("_", " ")} in ${instantPack.latencyMs}ms.`,
      confidence: instantPack.confidence,
      status: instantPack.sourceType === "seed" ? "fallback" : "complete"
    }).pipe(Effect.flatMap(requireOk), Effect.catchAll(() => Effect.void));

    yield* client.callReducer("submit_question_pack", {
      sessionId: request.sessionId,
      selectedTopic: instantPack.arenaName,
      questions: instantPack.questions
    }, "instant-quiz-engine").pipe(Effect.flatMap(requireOk), Effect.catchAll(() => Effect.void));

    const result = yield* generateQuizQuestions(
      provider,
      {
        timeoutMs: config.llm.timeoutMs,
        maxRetries: config.llm.maxRetries,
        enableSafetyGuard: config.llm.safetyGuardEnabled
      },
      {
        topic: routing.selectedTopic,
        questionCount: request.questionCount
      }
    );

    for (const event of result.events) {
      yield* client.callReducer("record_agent_event", {
        sessionId: request.sessionId,
        agentName: event.agentName,
        eventType: event.eventType,
        content: event.content,
        confidence: event.confidence,
        status: event.status
      }).pipe(Effect.flatMap(requireOk), Effect.catchAll(() => Effect.void));
    }

    yield* client.callReducer("submit_question_pack", {
      sessionId: request.sessionId,
      requestId: request.requestId,
      selectedTopic: routing.selectedTopic,
      questions: result.questions
    }).pipe(Effect.flatMap(requireOk));
  }).pipe(
    Effect.catchAll((error) =>
      client.callReducer("record_agent_event", {
        sessionId: request.sessionId,
        agentName: "Agent Worker",
        eventType: "request_failed",
        content: error.message,
        confidence: 1,
        status: "failed"
      }).pipe(Effect.flatMap(requireOk), Effect.catchAll(() => Effect.void))
    )
  );
}

function processResolvedRound(
  client: RealtimeClient,
  provider: LlmProvider,
  config: WorkerConfig,
  state: QuizRushState,
  round: Round
): Effect.Effect<void, never> {
  const session = state.sessions.find((candidate) => candidate.sessionId === round.sessionId);
  const question = state.questions.find((candidate) => candidate.questionId === round.questionId);
  const answers = state.answers.filter((answer) => answer.roundId === round.roundId);
  const scores = state.scores.filter((score) => score.sessionId === round.sessionId).sort((a, b) => a.currentRank - b.currentRank);

  return generateHostCommentary(
    provider,
    { timeoutMs: config.llm.timeoutMs, maxRetries: config.llm.maxRetries },
    { session, round, question, answers, scores }
  ).pipe(
    Effect.flatMap((result) =>
      client.callReducer("record_agent_event", {
        sessionId: round.sessionId,
        agentName: "Host Commentator Agent",
        eventType: "round_commentary",
        content: result.commentary,
        confidence: result.confidence,
        status: result.status
      })
    ),
    Effect.flatMap(requireOk),
    Effect.asVoid,
    Effect.catchAll(() => Effect.void)
  );
}

function processFinishedSession(
  client: RealtimeClient,
  provider: LlmProvider,
  config: WorkerConfig,
  state: QuizRushState,
  session: Session
): Effect.Effect<void, never> {
  const questions = state.questions.filter((question) => question.sessionId === session.sessionId);
  const answers = state.answers.filter((answer) => answer.sessionId === session.sessionId);
  const scores = state.scores.filter((score) => score.sessionId === session.sessionId).sort((a, b) => a.currentRank - b.currentRank);
  const events = state.matchEvents.filter((event) => event.sessionId === session.sessionId);

  return generateLearningRecap(
    provider,
    { timeoutMs: config.llm.timeoutMs, maxRetries: config.llm.maxRetries },
    { session, questions, answers, scores, events }
  ).pipe(
    Effect.flatMap((result) =>
      client.callReducer("record_agent_event", {
        sessionId: session.sessionId,
        agentName: "Recap Agent",
        eventType: "learning_recap",
        content: result.summary,
        confidence: result.confidence,
        status: result.status
      })
    ),
    Effect.flatMap(requireOk),
    Effect.asVoid,
    Effect.catchAll(() => Effect.void)
  );
}

function topicCountsForSession(votes: TopicVote[], sessionId: string): Array<{ topic: string; count: number; percent: number }> {
  const counts = new Map<string, number>();
  for (const vote of votes.filter((candidate) => candidate.sessionId === sessionId)) {
    counts.set(vote.topic, (counts.get(vote.topic) ?? 0) + 1);
  }
  const total = Math.max(1, [...counts.values()].reduce((sum, count) => sum + count, 0));
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}
