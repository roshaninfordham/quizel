import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION_CODE, DEFAULT_SESSION_ID, QUESTION_COUNT } from "./constants";
import { SEEDED_DEMO_QUESTIONS } from "./demoQuestions";
import { QuizRushEngine } from "./engine";
import { computeAnswerScore, percentile } from "./scoring";

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

  it("round deadlines stay anchored to a 25-second match budget", () => {
    const engine = prepareReadyMatch();
    const first = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    const startedAt = engine.getSnapshot().sessions[0]?.matchStartedAt;
    engine.callReducer("resolve_round", { roundId: first.roundId }, "operator");
    const secondRound = engine.getSnapshot().rounds.find((round) => round.orderIndex === 2);

    expect(startedAt).toBeTypeOf("number");
    expect(secondRound?.startsAt).toBe((startedAt ?? 0) + 5_000);
    expect(secondRound?.endsAt).toBe((startedAt ?? 0) + 10_000);
  });

  it("submit_answer rejects duplicate answers and records the rejection", () => {
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    const first = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "B" }, "device-maya");
    const second = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "A" }, "device-maya");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(engine.getSnapshot().answers).toHaveLength(1);
    expect(engine.getSnapshot().liveStats[0]?.duplicateAnswersRejected).toBe(1);
  });

  it("scores correct fast answers and gives wrong answers no speed bonus", () => {
    expect(computeAnswerScore({ isCorrect: true, responseMs: 500 })).toBeGreaterThan(1000);
    expect(computeAnswerScore({ isCorrect: false, responseMs: 1 })).toBe(0);
  });

  it("formats top-room placement from rank", () => {
    expect(percentile(1, 100)).toBe(1);
    expect(percentile(7, 100)).toBe(7);
    expect(percentile(100, 100)).toBe(100);
  });

  it("updates rankings and writes replay events after answers", () => {
    const engine = prepareReadyMatch();
    const round = engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator").data as { roundId: string };
    engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "B" }, "device-maya");
    engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "A" }, "device-arjun");

    const state = engine.getSnapshot();
    const ranked = [...state.scores].sort((a, b) => a.currentRank - b.currentRank);
    expect(ranked[0]?.currentRank).toBe(1);
    expect(state.matchEvents.some((event) => event.eventType === "answer")).toBe(true);
    expect(state.matchEvents.some((event) => event.eventType === "score_delta")).toBe(true);
  });

  it("simulate_answer_burst commits simulated answers, score changes, and live stats", () => {
    const engine = prepareReadyMatch();
    engine.callReducer("add_simulated_players", { sessionId: DEFAULT_SESSION_ID, count: 12 }, "operator");
    engine.callReducer("start_match", { sessionId: DEFAULT_SESSION_ID }, "operator");
    const burst = engine.callReducer("simulate_answer_burst", { sessionId: DEFAULT_SESSION_ID, count: 8 }, "simulation-engine");
    const state = engine.getSnapshot();

    expect(burst.ok).toBe(true);
    expect(state.answers.filter((answer) => answer.roundId === state.rounds[0]?.roundId)).toHaveLength(8);
    expect(state.liveStats[0]?.answersCount).toBe(8);
    expect(state.matchEvents.some((event) => event.eventType === "score_delta")).toBe(true);
  });

  it("live_tick refreshes live stats through a reducer", () => {
    const engine = prepareReadyMatch();
    const before = engine.getSnapshot().liveStats[0]?.updatedAt ?? 0;
    const tick = engine.callReducer("live_tick", { sessionId: DEFAULT_SESSION_ID }, "projector");
    const after = engine.getSnapshot().liveStats[0]?.updatedAt ?? 0;

    expect(tick.ok).toBe(true);
    expect(after).toBeGreaterThanOrEqual(before);
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
});
