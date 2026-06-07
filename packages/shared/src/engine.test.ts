import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SESSION_CODE, DEFAULT_SESSION_ID, PLAYER_STALE_TIMEOUT_MS, QUESTION_COUNT, QUESTION_TIME_LIMIT_MS, TOTAL_MATCH_SECONDS } from "./constants";
import { SEEDED_DEMO_QUESTIONS } from "./demoQuestions";
import { QuizRushEngine } from "./engine";
import { computeAnswerScore, percentile } from "./scoring";
import { buildTopicFallbackQuestions } from "./topicFallbackQuestions";
import type { ShareCard } from "./types";

function prepareReadyMatch() {
  const engine = new QuizRushEngine();
  const joinA = engine.callReducer("join_session", {
    code: DEFAULT_SESSION_CODE,
    displayName: "Maya",
    avatar: "🚀"
  }, "device-maya");
  const joinB = engine.callReducer("join_session", {
    code: DEFAULT_SESSION_CODE,
    displayName: "Arjun",
    avatar: "🧠"
  }, "device-arjun");
  engine.callReducer("submit_topic_vote", { sessionId: DEFAULT_SESSION_ID, topics: ["AI", "Space"] }, "device-maya");
  engine.callReducer("submit_topic_vote", { sessionId: DEFAULT_SESSION_ID, topics: ["Startups"] }, "device-arjun");
  const pack = engine.callReducer("submit_question_pack", {
    sessionId: DEFAULT_SESSION_ID,
    selectedTopic: "AI + Space + Startups",
    questions: SEEDED_DEMO_QUESTIONS
  }, "agent-worker");

  expect(joinA.ok).toBe(true);
  expect(joinB.ok).toBe(true);
  expect(pack.ok).toBe(true);
  return engine;
}

function useStableClock(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
}

function moveClockToRoundStart(engine: QuizRushEngine, roundId: string, offsetMs = 500): void {
  const round = engine.getSnapshot().rounds.find((candidate) => candidate.roundId === roundId);
  if (!round) throw new Error(`Round not found in test: ${roundId}`);
  vi.setSystemTime(round.startsAt + offsetMs);
}

describe("QuizRush reducer invariants", () => {
  it("join_session creates one participant and one score row", () => {
    const engine = new QuizRushEngine();
    const receipt = engine.callReducer("join_session", {
      code: DEFAULT_SESSION_CODE,
      displayName: "Maya",
      avatar: "🚀"
    }, "device-maya");
    const state = engine.getSnapshot();

    expect(receipt.ok).toBe(true);
    expect(state.sessions[0]?.status).toBe("topic_voting");
    expect(state.participants).toHaveLength(1);
    expect(state.scores).toHaveLength(1);
    expect(state.liveStats[0]?.joinedCount).toBe(1);
  });

  it("submit_topic_vote stores a latest topic set per participant", () => {
    const engine = new QuizRushEngine();
    engine.callReducer("join_session", { code: DEFAULT_SESSION_CODE, displayName: "Maya", avatar: "🚀" }, "device-maya");
    engine.callReducer("submit_topic_vote", { sessionId: DEFAULT_SESSION_ID, topics: ["AI", "Space"] }, "device-maya");
    engine.callReducer("submit_topic_vote", { sessionId: DEFAULT_SESSION_ID, topics: ["Startups"] }, "device-maya");

    const votes = engine.getSnapshot().topicVotes;
    expect(votes).toHaveLength(1);
    expect(votes[0]?.topic).toBe("Startups");
  });

  it("builds topic-specific fallback questions for a voice intent like US visa system", () => {
    const questions = buildTopicFallbackQuestions("US visa system", QUESTION_COUNT);

    expect(questions).toHaveLength(QUESTION_COUNT);
    expect(questions[0]?.topic).toBe("US Visa System");
    expect(questions.map((question) => question.questionText).join(" ")).toContain("visa");
    expect(questions.map((question) => Object.values(question.options).join(" ")).join(" ")).not.toContain("SpacetimeDB");
  });

  it("builds factual Andaman Islands fallback questions and bans meta-learning prompts", () => {
    const questions = buildTopicFallbackQuestions("Andaman", QUESTION_COUNT);
    const joined = questions.map((question) => `${question.questionText} ${question.explanation}`).join(" ");

    expect(questions).toHaveLength(QUESTION_COUNT);
    expect(questions[0]?.topic).toBe("Andaman Islands");
    expect(joined).toContain("Bay of Bengal");
    expect(joined).toContain("Port Blair");
    expect(joined).not.toMatch(/best first step|good .* question should|before studying|valid quiz/i);
    expect(questions.every((question) => question.factIds?.length)).toBe(true);
  });

  it("submit_question_pack validates the LLM JSON shape and readies the match", () => {
    const engine = new QuizRushEngine();
    const bad = engine.callReducer("submit_question_pack", {
      sessionId: DEFAULT_SESSION_ID,
      questions: [{ questionText: "Bad", options: { A: "x" }, correctOption: "A" }]
    }, "agent-worker");
    const good = engine.callReducer("submit_question_pack", {
      sessionId: DEFAULT_SESSION_ID,
      selectedTopic: "AI + Space + Startups",
      questions: SEEDED_DEMO_QUESTIONS
    }, "agent-worker");

    expect(bad.ok).toBe(false);
    expect(good.ok).toBe(true);
    expect(engine.getSnapshot().questions).toHaveLength(QUESTION_COUNT);
    expect(engine.getSnapshot().sessions[0]?.status).toBe("ready");
  });

  it("start_match creates a server-authoritative active round", () => {
    const engine = prepareReadyMatch();
    const started = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator");
    const round = engine.getSnapshot().rounds[0];

    expect(started.ok).toBe(true);
    expect(round?.status).toBe("active");
    expect(round?.endsAt).toBeGreaterThan(round?.startsAt ?? 0);
    expect(engine.getSnapshot().sessions[0]?.currentRound).toBe(1);
  });

  it("start_match rejects a zero-player race", () => {
    const engine = new QuizRushEngine();
    engine.callReducer("submit_question_pack", {
      sessionId: DEFAULT_SESSION_ID,
      selectedTopic: "AI + Space + Startups",
      questions: SEEDED_DEMO_QUESTIONS
    }, "agent-worker");
    const started = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator");

    expect(started.ok).toBe(false);
    expect(started.error).toContain("At least one participant");
    expect(engine.getSnapshot().sessions[0]?.status).toBe("ready");
  });

  it("start_match emergency seed uses the selected live intent topic", () => {
    const engine = new QuizRushEngine();
    engine.callReducer("join_session", { code: DEFAULT_SESSION_CODE, displayName: "Maya", avatar: "🚀" }, "device-maya");
    engine.callReducer("submit_topic_vote", { sessionId: DEFAULT_SESSION_ID, topics: ["US Visa System"] }, "device-maya");
    engine.callReducer("request_questions", { sessionId: DEFAULT_SESSION_ID, topic: "US Visa System" }, "device-maya");

    const started = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator");
    const state = engine.getSnapshot();

    expect(started.ok).toBe(true);
    expect(state.sessions[0]?.selectedTopic).toBe("US Visa System");
    expect(state.questions[0]?.questionText.toLowerCase()).toContain("visa");
    expect(state.questions[0]?.generatedBy).toBe("Seed Fallback Provider");
  });

  it("request_questions immediately commits a topic-specific fallback pack", () => {
    const engine = new QuizRushEngine();
    engine.callReducer("join_session", { code: DEFAULT_SESSION_CODE, displayName: "Maya", avatar: "🚀" }, "device-maya");
    const request = engine.callReducer("request_questions", { sessionId: DEFAULT_SESSION_ID, topic: "US Visa System" }, "device-maya");
    const state = engine.getSnapshot();

    expect(request.ok).toBe(true);
    expect(state.agentRequests[0]?.status).toBe("pending");
    expect(state.sessions[0]?.status).toBe("ready");
    expect(state.questions).toHaveLength(QUESTION_COUNT);
    expect(state.questions[0]?.questionText.toLowerCase()).toContain("visa");
  });

  it("submit_player_intent records a parsed realtime intent row and ledger events", () => {
    const engine = new QuizRushEngine();
    engine.callReducer("join_session", { code: DEFAULT_SESSION_CODE, displayName: "Maya", avatar: "🚀" }, "device-maya");
    const intent = engine.callReducer("submit_player_intent", {
      sessionId: DEFAULT_SESSION_ID,
      rawText: "Fruit Fruits Fruits",
      transcriptSource: "speech"
    }, "device-maya");
    const state = engine.getSnapshot();

    expect(intent.ok).toBe(true);
    expect(state.playerIntents).toHaveLength(1);
    expect(state.playerIntents[0]?.arenaName).toBe("Fruit Science");
    expect(state.sessions[0]?.selectedTopic).toBe("Fruit Science");
    expect(state.matchEvents.some((event) => event.eventType === "intent_submitted")).toBe(true);
    expect(state.matchEvents.some((event) => event.eventType === "intent_parsed")).toBe(true);
  });

  it("multi_phone_join_enter_arena_20_users keeps every player scoped and visible", () => {
    useStableClock();
    const engine = new QuizRushEngine();
    const topics = ["Databases", "Argentina", "Space", "Andaman Islands", "Formula 1"];

    for (let index = 0; index < 20; index += 1) {
      const identity = `device-phone-${index + 1}`;
      const topic = topics[index % topics.length] ?? "General Knowledge";
      const joined = engine.callReducer("join_session", {
        code: DEFAULT_SESSION_CODE,
        displayName: `Phone ${index + 1}`,
        avatar: "⚡"
      }, identity);
      const intent = engine.callReducer("submit_player_intent", {
        sessionId: DEFAULT_SESSION_ID,
        rawText: topic,
        transcriptSource: "typed"
      }, identity);
      const vote = engine.callReducer("submit_topic_vote", { sessionId: DEFAULT_SESSION_ID, topics: [topic] }, identity);
      const pack = engine.callReducer("request_questions", { sessionId: DEFAULT_SESSION_ID, topic }, identity);

      expect(joined.ok).toBe(true);
      expect(intent.ok).toBe(true);
      expect(vote.ok).toBe(true);
      expect(pack.ok).toBe(true);
    }

    const ready = engine.getSnapshot();
    expect(ready.participants).toHaveLength(20);
    expect(ready.participants.filter((participant) => participant.admissionStatus === "admitted")).toHaveLength(20);
    expect(ready.scores).toHaveLength(20);
    expect(ready.playerIntents).toHaveLength(20);
    expect(ready.questionPacks.filter((pack) => pack.participantId)).toHaveLength(20);
    expect(ready.questions.filter((question) => question.participantId)).toHaveLength(20 * QUESTION_COUNT);
    expect(ready.liveStats[0]?.admittedRacers).toBe(20);

    const started = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator");
    const round = engine.getSnapshot().rounds[0];
    expect(started.ok).toBe(true);
    expect(round).toBeDefined();
    if (!round) throw new Error("round missing");
    moveClockToRoundStart(engine, round.roundId, 800);

    for (let index = 0; index < 20; index += 1) {
      const answered = engine.callReducer("submit_answer", {
        roundId: round.roundId,
        selectedOption: (["A", "B", "C", "D"] as const)[index % 4],
        clientEventId: `phone-${index + 1}-round-1`
      }, `device-phone-${index + 1}`);
      expect(answered.ok).toBe(true);
    }

    const answered = engine.getSnapshot();
    expect(answered.answers.filter((answer) => answer.roundId === round.roundId)).toHaveLength(20);
    expect(new Set(answered.answers.map((answer) => answer.participantId)).size).toBe(20);
    expect(answered.scores.filter((score) => score.answeredCount === 1)).toHaveLength(20);
    vi.useRealTimers();
  });

  it("rounds advance immediately while staying inside the 25-second match budget", () => {
    const engine = prepareReadyMatch();
    const first = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    const startedAt = engine.getSnapshot().sessions[0]?.matchStartedAt;
    engine.callReducer("resolve_round", { roundId: first.roundId }, "operator");
    const secondRound = engine.getSnapshot().rounds.find((round) => round.orderIndex === 2);

    expect(startedAt).toBeTypeOf("number");
    expect(secondRound?.startsAt).toBeGreaterThanOrEqual(startedAt ?? 0);
    expect(secondRound?.endsAt).toBeLessThanOrEqual((startedAt ?? 0) + TOTAL_MATCH_SECONDS * 1000);
    expect((secondRound?.endsAt ?? 0) - (secondRound?.startsAt ?? 0)).toBeLessThanOrEqual(QUESTION_TIME_LIMIT_MS);
  });

  it("submit_answer rejects duplicate answers and records the rejection", () => {
    useStableClock();
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    const activeRound = engine.getSnapshot().rounds.find((candidate) => candidate.roundId === round.roundId);
    if (!activeRound) throw new Error("round missing");
    vi.setSystemTime(activeRound.startsAt - 1200);
    const early = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "B" }, "device-maya");
    moveClockToRoundStart(engine, round.roundId);
    const first = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "B" }, "device-maya");
    const second = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "A" }, "device-maya");

    expect(early.ok).toBe(false);
    expect(early.error).toContain("not started");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(engine.getSnapshot().answers).toHaveLength(1);
    expect(engine.getSnapshot().liveStats[0]?.duplicateAnswersRejected).toBe(1);
    vi.useRealTimers();
  });

  it("accepts tiny first-round clock skew and clamps official response to zero", () => {
    useStableClock();
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    const activeRound = engine.getSnapshot().rounds.find((candidate) => candidate.roundId === round.roundId);
    if (!activeRound) throw new Error("round missing");
    vi.setSystemTime(activeRound.startsAt - 75);
    const accepted = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "B" }, "device-maya");
    const answer = engine.getSnapshot().answers[0];

    expect(accepted.ok).toBe(true);
    expect(answer?.officialResponseMs).toBe(0);
    vi.useRealTimers();
  });

  it("scores correct fast answers and gives wrong answers no speed bonus", () => {
    expect(computeAnswerScore({ isCorrect: true, responseMs: 500 })).toBeGreaterThan(1000);
    expect(computeAnswerScore({ isCorrect: false, responseMs: 1 })).toBe(0);
  });

  it("tracks total submitted-answer time separately from correct-answer timing", () => {
    useStableClock();
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    moveClockToRoundStart(engine, round.roundId, 1000);
    const wrong = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "A" }, "device-arjun");
    const state = engine.getSnapshot();
    const arjun = state.participants.find((participant) => participant.displayName === "Arjun");
    const score = state.scores.find((candidate) => candidate.participantId === arjun?.participantId);

    expect(wrong.ok).toBe(true);
    expect(score?.answeredCount).toBe(1);
    expect(score?.correctCount).toBe(0);
    expect(score?.totalAnswerResponseMs).toBe(1000);
    expect(score?.totalCorrectResponseMs).toBe(0);
    expect(score?.totalOfficialResponseMs).toBe(1000);
    expect(score?.fastestOfficialResponseMs).toBeNull();
    vi.useRealTimers();
  });

  it("formats top-room placement from rank", () => {
    expect(percentile(1, 100)).toBe(1);
    expect(percentile(7, 100)).toBe(7);
    expect(percentile(100, 100)).toBe(100);
  });

  it("updates rankings and writes replay events after answers", () => {
    useStableClock();
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    moveClockToRoundStart(engine, round.roundId);
    engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "B" }, "device-maya");
    engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "A" }, "device-arjun");

    const state = engine.getSnapshot();
    const ranked = [...state.scores].sort((a, b) => a.currentRank - b.currentRank);
    expect(ranked[0]?.currentRank).toBe(1);
    expect(state.matchEvents.some((event) => event.eventType === "answer")).toBe(true);
    expect(state.matchEvents.some((event) => event.eventType === "score_delta")).toBe(true);
    vi.useRealTimers();
  });

  it("simulate_answer_burst commits simulated answers, score changes, and live stats", () => {
    useStableClock();
    const engine = prepareReadyMatch();
    engine.callReducer("add_simulated_players", { sessionId: DEFAULT_SESSION_ID, count: 12 }, "operator");
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    moveClockToRoundStart(engine, round.roundId);
    const burst = engine.callReducer("simulate_answer_burst", { sessionId: DEFAULT_SESSION_ID, count: 8 }, "simulation-engine");
    const state = engine.getSnapshot();

    expect(burst.ok).toBe(true);
    expect(state.answers.filter((answer) => answer.roundId === state.rounds[0]?.roundId)).toHaveLength(8);
    expect(state.liveStats[0]?.answersCount).toBe(8);
    expect(state.matchEvents.some((event) => event.eventType === "score_delta")).toBe(true);
    vi.useRealTimers();
  });

  it("live_tick refreshes live stats through a reducer", () => {
    const engine = prepareReadyMatch();
    const before = engine.getSnapshot().liveStats[0]?.updatedAt ?? 0;
    const tick = engine.callReducer("live_tick", { sessionId: DEFAULT_SESSION_ID }, "projector");
    const after = engine.getSnapshot().liveStats[0]?.updatedAt ?? 0;

    expect(tick.ok).toBe(true);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("live_tick eliminates stale real racers without deleting their score history", () => {
    useStableClock();
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    const activeRound = engine.getSnapshot().rounds.find((candidate) => candidate.roundId === round.roundId);
    if (!activeRound) throw new Error("round missing");

    vi.setSystemTime(activeRound.startsAt + PLAYER_STALE_TIMEOUT_MS + 1);
    engine.callReducer("heartbeat", { sessionId: DEFAULT_SESSION_ID, clientLatencyMs: 42 }, "device-arjun");
    const tick = engine.callReducer("live_tick", { sessionId: DEFAULT_SESSION_ID }, "projector");
    const state = engine.getSnapshot();
    const maya = state.participants.find((participant) => participant.displayName === "Maya");
    const arjun = state.participants.find((participant) => participant.displayName === "Arjun");
    const mayaScore = state.scores.find((score) => score.participantId === maya?.participantId);

    expect(tick.ok).toBe(true);
    expect(maya?.championStatus).toBe("eliminated");
    expect(arjun?.championStatus).toBe("active");
    expect(mayaScore?.championStatus).toBe("eliminated");
    expect(state.matchEvents.some((event) => event.eventType === "participant_inactive")).toBe(true);

    engine.callReducer("finish_match", { sessionId: DEFAULT_SESSION_ID }, "operator");
    const finished = engine.getSnapshot();
    expect(finished.participants.find((participant) => participant.displayName === "Arjun")?.championStatus).toBe("champion");
    expect(finished.finalResults.find((result) => result.participantId === maya?.participantId)?.championStatus).toBe("eliminated");
    vi.useRealTimers();
  });

  it("records client recovery errors without crashing the race state", () => {
    const engine = prepareReadyMatch();
    const participantId = engine.getSnapshot().participants[0]?.participantId;
    const logged = engine.callReducer(
      "record_client_error",
      {
        sessionId: DEFAULT_SESSION_ID,
        participantId,
        screen: "phone",
        errorCode: "react_error_boundary",
        message: "Detected Arena render failed",
        stackHash: "err_test",
        metadataJson: JSON.stringify({ path: "/join/ARENA-42" }),
        userAgent: "vitest"
      },
      "device-maya"
    );
    const state = engine.getSnapshot();

    expect(logged.ok).toBe(true);
    expect(state.clientErrors).toHaveLength(1);
    expect(state.clientErrors[0]?.message).toBe("Detected Arena render failed");
    expect(state.matchEvents.some((event) => event.eventType === "client_error")).toBe(true);
    expect(state.sessions[0]?.status).toBe("ready");
  });

  it("resolve_round is idempotent and starts the next question once", () => {
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    const first = engine.callReducer("resolve_round", { roundId: round.roundId }, "operator");
    const second = engine.callReducer("resolve_round", { roundId: round.roundId }, "operator");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(engine.getSnapshot().rounds.filter((candidate) => candidate.orderIndex === 2)).toHaveLength(1);
  });

  it("reset_demo returns to a clean lobby state", () => {
    const engine = prepareReadyMatch();
    engine.callReducer("add_simulated_players", { sessionId: DEFAULT_SESSION_ID, count: 12 }, "operator");
    const reset = engine.callReducer("reset_demo", { sessionId: DEFAULT_SESSION_ID }, "operator");
    const state = engine.getSnapshot();

    expect(reset.ok).toBe(true);
    expect(state.sessions[0]?.status).toBe("lobby");
    expect(state.participants).toHaveLength(0);
    expect(state.questions).toHaveLength(0);
    expect(state.liveStats[0]?.joinedCount).toBe(0);
  });

  it("creates idempotent durable share cards from final database results", () => {
    useStableClock();
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    moveClockToRoundStart(engine, round.roundId, 1200);
    engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "B" }, "device-maya");
    engine.callReducer("finish_match", { sessionId: DEFAULT_SESSION_ID }, "operator");

    expect(engine.getSnapshot().finalResults).toHaveLength(2);
    expect(engine.getSnapshot().shareCards).toHaveLength(2);

    const first = engine.callReducer<ShareCard>("create_share_card", { sessionId: DEFAULT_SESSION_ID }, "device-maya");
    const second = engine.callReducer<ShareCard>("create_share_card", { sessionId: DEFAULT_SESSION_ID }, "device-maya");
    const share = first.data;

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(share?.slug).toMatch(/^qra_[A-Za-z0-9_-]{12}$/);
    expect(second.data?.slug).toBe(share?.slug);
    expect(engine.getSnapshot().shareCards).toHaveLength(2);
    expect(share?.totalAnswerResponseMs).toBe(1200);
    expect(share?.totalResponseMsOfficial).toBe(1200);

    engine.callReducer("reset_demo", { sessionId: DEFAULT_SESSION_ID }, "operator");
    expect(engine.getSnapshot().shareCards.some((candidate) => candidate.slug === share?.slug)).toBe(true);
    vi.useRealTimers();
  });

  it("ignores stale LLM question packs that return after reset", () => {
    const engine = new QuizRushEngine();
    const request = engine.callReducer<{ requestId: string }>("request_questions", {
      sessionId: DEFAULT_SESSION_ID,
      topic: "AI + Space"
    }, "operator");
    engine.callReducer("reset_demo", { sessionId: DEFAULT_SESSION_ID }, "operator");
    const latePack = engine.callReducer("submit_question_pack", {
      sessionId: DEFAULT_SESSION_ID,
      requestId: request.data?.requestId,
      selectedTopic: "AI + Space",
      questions: SEEDED_DEMO_QUESTIONS
    }, "agent-worker");
    const state = engine.getSnapshot();

    expect(request.ok).toBe(true);
    expect(latePack.ok).toBe(true);
    expect(state.sessions[0]?.status).toBe("lobby");
    expect(state.questions).toHaveLength(0);
    expect(state.agentEvents.some((event) => event.eventType === "stale_question_pack_ignored")).toBe(true);
  });
});
