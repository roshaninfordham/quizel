import { describe, expect, it } from "vitest";
import { CHEER_AMOUNT, DEFAULT_JOIN_CODE, INITIAL_ENERGY, MAX_CROWD_BOOST } from "./constants";
import { QuizDuelEngine } from "./engine";
import { computePlayerRoundScore } from "./scoring";

function setupActiveRound() {
  const engine = new QuizDuelEngine();
  engine.callReducer("create_session", {
    topic: "AI + Space + Startups",
    difficulty: "beginner",
    questionCount: 3
  });
  engine.callReducer("open_lobby", { sessionId: "session-demo" });
  const playerA = engine.callReducer("join_session", {
    joinCode: DEFAULT_JOIN_CODE,
    displayName: "Maya",
    roleRequested: "player",
    interests: ["AI"]
  }, "device-maya");
  const playerB = engine.callReducer("join_session", {
    joinCode: DEFAULT_JOIN_CODE,
    displayName: "Arjun",
    roleRequested: "player",
    interests: ["Space"]
  }, "device-arjun");
  const crowd = engine.callReducer("join_session", {
    joinCode: DEFAULT_JOIN_CODE,
    displayName: "Sarah",
    roleRequested: "crowd",
    interests: ["Startups"]
  }, "device-sarah");
  engine.callReducer("request_questions", {
    sessionId: "session-demo",
    topic: "AI + Space + Startups",
    difficulty: "beginner",
    questionCount: 3
  });
  engine.callReducer("assign_champions_randomly", { sessionId: "session-demo" });
  const match = engine.getSnapshot().matches[0];
  if (!match) throw new Error("Expected match");
  engine.callReducer("start_match", { matchId: match.matchId });
  const round = engine.getSnapshot().rounds[0];
  if (!round) throw new Error("Expected round");
  return { engine, playerA, playerB, crowd, match, round };
}

describe("QuizDuel reducer invariants", () => {
  it("join_session grants exactly 500 Energy", () => {
    const engine = new QuizDuelEngine();
    engine.callReducer("open_lobby", { sessionId: "session-demo" });
    const receipt = engine.callReducer("join_session", {
      joinCode: DEFAULT_JOIN_CODE,
      displayName: "Maya",
      roleRequested: "player",
      interests: ["AI"]
    }, "device-maya");

    expect(receipt.ok).toBe(true);
    expect(engine.getSnapshot().energyBalances[0]?.spendableEnergy).toBe(INITIAL_ENERGY);
  });

  it("assign_champions_randomly selects exactly 2 players", () => {
    const { engine } = setupActiveRound();
    const assigned = engine
      .getSnapshot()
      .participants.filter((participant) => participant.roleAssigned === "player1" || participant.roleAssigned === "player2");
    expect(assigned).toHaveLength(2);
  });

  it("duplicate answer is rejected without adding a second answer", () => {
    const { engine, round } = setupActiveRound();
    const first = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "A" }, "device-maya");
    const second = engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "B" }, "device-maya");
    const playerAnswers = engine.getSnapshot().answers.filter((answer) => answer.roundId === round.roundId);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.data).toMatchObject({ accepted: false, reason: "duplicate_answer" });
    expect(playerAnswers).toHaveLength(1);
    expect(engine.getSnapshot().liveStats[0]?.duplicateAnswersRejected).toBe(1);
  });

  it("support_player deducts exactly 25 Energy and rejects invalid amount", () => {
    const { engine, round, match } = setupActiveRound();
    const supporter = engine.getSnapshot().participants.find((participant) => participant.identity === "device-sarah");
    expect(supporter).toBeTruthy();

    const accepted = engine.callReducer("support_player", {
      roundId: round.roundId,
      playerId: match.player1Id,
      amount: CHEER_AMOUNT,
      clientEventId: "cheer-1"
    }, "device-sarah");
    const invalid = engine.callReducer("support_player", {
      roundId: round.roundId,
      playerId: match.player1Id,
      amount: 50,
      clientEventId: "cheer-2"
    }, "device-sarah");

    const balance = engine.getSnapshot().energyBalances.find((candidate) => candidate.participantId === supporter?.participantId);
    expect(accepted.ok).toBe(true);
    expect(invalid.ok).toBe(false);
    expect(balance?.spendableEnergy).toBe(INITIAL_ENERGY - CHEER_AMOUNT);
  });

  it("support_player cannot make Energy negative", () => {
    const { engine, round, match } = setupActiveRound();
    for (let index = 0; index < 25; index += 1) {
      engine.callReducer("support_player", {
        roundId: round.roundId,
        playerId: match.player1Id,
        amount: CHEER_AMOUNT,
        clientEventId: `cheer-${index}`
      }, "device-sarah");
    }

    const supporter = engine.getSnapshot().participants.find((participant) => participant.identity === "device-sarah");
    const balance = engine.getSnapshot().energyBalances.find((candidate) => candidate.participantId === supporter?.participantId);
    expect(balance?.spendableEnergy).toBe(0);
    expect(engine.getSnapshot().liveStats[0]?.doubleSpendAttemptsBlocked).toBeGreaterThan(0);
  });

  it("resolve_round is idempotent and supporter XP is awarded once", () => {
    const { engine, round, match } = setupActiveRound();
    engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "A" }, "device-maya");
    engine.callReducer("submit_answer", { roundId: round.roundId, selectedOption: "A" }, "device-arjun");
    engine.callReducer("support_player", {
      roundId: round.roundId,
      playerId: match.player1Id,
      amount: CHEER_AMOUNT,
      clientEventId: "cheer-1"
    }, "device-sarah");

    engine.callReducer("resolve_round", { roundId: round.roundId });
    const firstXp = engine.getSnapshot().scores.find((score) => score.participantId !== match.player1Id && score.participantId !== match.player2Id)?.supporterXp;
    engine.callReducer("resolve_round", { roundId: round.roundId });
    const secondXp = engine.getSnapshot().scores.find((score) => score.participantId !== match.player1Id && score.participantId !== match.player2Id)?.supporterXp;

    expect(secondXp).toBe(firstXp);
  });

  it("support bonus is capped and wrong answers get no speed bonus", () => {
    const capped = computePlayerRoundScore({
      isCorrect: true,
      responseMs: 100,
      totalSupportForPlayer: 10_000
    });
    const wrong = computePlayerRoundScore({
      isCorrect: false,
      responseMs: 1,
      totalSupportForPlayer: 0
    });

    expect(capped.crowdBoost).toBe(MAX_CROWD_BOOST);
    expect(wrong.speedBonus).toBe(0);
  });

  it("malformed LLM JSON shape is rejected by submit_question_batch", () => {
    const engine = new QuizDuelEngine();
    const receipt = engine.callReducer("submit_question_batch", {
      sessionId: "session-demo",
      questions: [{ questionText: "Bad", options: { A: "x" }, correctOption: "A" }]
    }, "agent-worker");

    expect(receipt.ok).toBe(false);
    expect(engine.getSnapshot().questions).toHaveLength(0);
  });
});
