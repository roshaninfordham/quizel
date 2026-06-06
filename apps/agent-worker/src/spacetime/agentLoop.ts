import { Duration, Effect } from "effect";
import type { AgentRequest, Match, QuizDuelState, Round } from "@quizduel/shared";
import { generateHostCommentary, generateLearningRecap, generateQuizQuestions } from "../agents/quizAgents";
import { selectLlmProvider } from "../llm/service";
import type { LlmProvider } from "../llm/provider";
import type { WorkerConfig } from "../effects/config";
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
  const processedRounds = new Set<string>();
  const processedMatches = new Set<string>();
  const providerSelection = selectLlmProvider(config);

  return Effect.forever(
    client.waitForSnapshot().pipe(
      Effect.flatMap((state) =>
        Effect.gen(function* () {
          const pendingRequests = state.agentRequests.filter(
            (request) => request.status === "pending" && !processedRequests.has(request.requestId)
          );
          const resolvedRounds = findNewResolvedRounds(state, processedRounds);
          const finishedMatches = findNewFinishedMatches(state, processedMatches);

          if (pendingRequests.length || resolvedRounds.length || finishedMatches.length) {
            yield* Effect.logInfo("Agent worker snapshot work discovered", {
              pendingRequests: pendingRequests.length,
              resolvedRounds: resolvedRounds.length,
              finishedMatches: finishedMatches.length
            });
          }

          yield* Effect.all(
            [
              ...pendingRequests.map((request) =>
                processAgentRequest(client, provider, config, request, providerSelection.providerName).pipe(
                  Effect.tap(() => Effect.sync(() => processedRequests.add(request.requestId)))
                )
              ),
              ...resolvedRounds.map((round) =>
                processResolvedRound(client, provider, config, state, round).pipe(
                  Effect.tap(() => Effect.sync(() => processedRounds.add(round.roundId)))
                )
              ),
              ...finishedMatches.map((match) =>
                processFinishedMatch(client, provider, config, state, match).pipe(
                  Effect.tap(() => Effect.sync(() => processedMatches.add(match.matchId)))
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
  request: AgentRequest,
  providerName: string
): Effect.Effect<void, never> {
  if (request.requestType !== "quiz_generation") {
    return Effect.void;
  }

  return Effect.gen(function* () {
    yield* Effect.logInfo("Agent worker processing quiz request", {
      requestId: request.requestId,
      sessionId: request.sessionId,
      providerName
    });

    yield* client.callReducer("record_agent_event", {
      sessionId: request.sessionId,
      agentName: "Quiz Author Agent",
      eventType: "generation_started",
      content: `Using ${providerName} for ${request.topic}.`,
      confidence: 0.9,
      status: "running"
    }).pipe(Effect.flatMap(requireOk), Effect.catchAll(() => Effect.void));

    const result = yield* generateQuizQuestions(
      provider,
      {
        timeoutMs: config.llm.timeoutMs,
        maxRetries: config.llm.maxRetries,
        enableSafetyGuard: config.llm.safetyGuardEnabled
      },
      {
        topic: request.topic,
        difficulty: request.difficulty,
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

    yield* client.callReducer("submit_question_batch", {
      sessionId: request.sessionId,
      requestId: request.requestId,
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
  state: QuizDuelState,
  round: Round
): Effect.Effect<void, never> {
  const match = state.matches.find((candidate) => candidate.matchId === round.matchId);
  if (!match) return Effect.void;
  const session = state.sessions.find((candidate) => candidate.sessionId === match.sessionId);
  const question = state.questions.find((candidate) => candidate.questionId === round.questionId);
  const answers = state.answers.filter((answer) => answer.roundId === round.roundId);
  const supportEvents = state.supportEvents.filter((event) => event.roundId === round.roundId);

  return generateHostCommentary(
    provider,
    { timeoutMs: config.llm.timeoutMs, maxRetries: config.llm.maxRetries },
    { session, match, round, question, answers, supportEvents }
  ).pipe(
    Effect.flatMap((result) =>
      client.callReducer("record_agent_event", {
        sessionId: match.sessionId,
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

function processFinishedMatch(
  client: RealtimeClient,
  provider: LlmProvider,
  config: WorkerConfig,
  state: QuizDuelState,
  match: Match
): Effect.Effect<void, never> {
  const questions = state.questions.filter((question) => question.matchId === match.matchId);
  const answers = state.answers.filter((answer) => state.rounds.some((round) => round.matchId === match.matchId && round.roundId === answer.roundId));
  const playAlongAnswers = state.playAlongAnswers.filter((answer) =>
    state.rounds.some((round) => round.matchId === match.matchId && round.roundId === answer.roundId)
  );
  const scores = state.scores.filter((score) => score.matchId === match.matchId);

  return generateLearningRecap(
    provider,
    { timeoutMs: config.llm.timeoutMs, maxRetries: config.llm.maxRetries },
    { match, questions, answers, playAlongAnswers, scores }
  ).pipe(
    Effect.flatMap((result) =>
      client.callReducer("record_agent_event", {
        sessionId: match.sessionId,
        agentName: "Learning Recap Agent",
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

function findNewResolvedRounds(state: QuizDuelState, processedRounds: Set<string>): Round[] {
  return state.rounds.filter((round) => round.status === "resolved" && !processedRounds.has(round.roundId));
}

function findNewFinishedMatches(state: QuizDuelState, processedMatches: Set<string>): Match[] {
  return state.matches.filter((match) => match.status === "finished" && !processedMatches.has(match.matchId));
}
