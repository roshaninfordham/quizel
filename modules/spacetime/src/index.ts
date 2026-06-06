import { schema, table, t } from "spacetimedb/server";

const QUESTION_COUNT = 7;
const TOTAL_MATCH_MS = 25_000;
const QUESTION_TIME_LIMIT_MS = Math.floor(TOTAL_MATCH_MS / QUESTION_COUNT);
const SIMULATED_ANSWER_BURST_SIZE = 8;
const DEFAULT_TOPIC = "AI + Space + Startups";
const DEFAULT_CODE = "ARENA-42";

const session = table(
  { name: "session", public: true },
  {
    session_id: t.string().primaryKey(),
    code: t.string().unique(),
    status: t.string(),
    selected_topic: t.option(t.string()),
    question_count: t.u32(),
    current_round: t.u32(),
    match_started_at_ms: t.option(t.u64()),
    match_finished_at_ms: t.option(t.u64()),
    created_at_ms: t.u64(),
    updated_at_ms: t.u64()
  }
);

const participant = table(
  { name: "participant", public: true },
  {
    participant_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    identity: t.string().index("btree"),
    display_name: t.string(),
    avatar: t.string(),
    joined_at_ms: t.u64(),
    last_seen_ms: t.u64(),
    is_simulated: t.bool(),
    client_latency_ms: t.option(t.u32())
  }
);

const topic_vote = table(
  { name: "topic_vote", public: true },
  {
    vote_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    topic: t.string(),
    created_at_ms: t.u64()
  }
);

const question = table(
  { name: "question", public: true },
  {
    question_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    order_index: t.u32(),
    question_text: t.string(),
    option_a: t.string(),
    option_b: t.string(),
    option_c: t.string(),
    option_d: t.string(),
    correct_option: t.string(),
    explanation: t.string(),
    topic: t.string(),
    generated_by: t.string(),
    fairness_status: t.string(),
    created_at_ms: t.u64()
  }
);

const round = table(
  { name: "round", public: true },
  {
    round_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    question_id: t.string(),
    order_index: t.u32(),
    status: t.string(),
    starts_at_ms: t.u64(),
    ends_at_ms: t.u64(),
    resolved_at_ms: t.option(t.u64())
  }
);

const answer = table(
  { name: "answer", public: true },
  {
    answer_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    round_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    selected_option: t.string(),
    is_correct: t.bool(),
    response_ms: t.u32(),
    score_delta: t.u32(),
    server_received_at_ms: t.u64()
  }
);

const score = table(
  { name: "score", public: true },
  {
    score_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    total_score: t.u32(),
    correct_count: t.u32(),
    total_response_ms: t.u32(),
    fastest_response_ms: t.option(t.u32()),
    current_rank: t.u32(),
    previous_rank: t.u32(),
    last_answer_at_ms: t.option(t.u64()),
    updated_at_ms: t.u64()
  }
);

const match_event = table(
  { name: "match_event", public: true },
  {
    event_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    participant_id: t.option(t.string()),
    event_type: t.string(),
    round_index: t.option(t.u32()),
    score_after: t.option(t.u32()),
    rank_after: t.option(t.u32()),
    payload_json: t.string(),
    created_at_ms: t.u64()
  }
);

const agent_request = table(
  { name: "agent_request", public: true },
  {
    request_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    request_type: t.string(),
    topic: t.string(),
    question_count: t.u32(),
    status: t.string(),
    created_at_ms: t.u64(),
    updated_at_ms: t.u64(),
    error_message: t.option(t.string())
  }
);

const agent_event = table(
  { name: "agent_event", public: true },
  {
    event_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    agent_name: t.string(),
    event_type: t.string(),
    content: t.string(),
    confidence: t.f32(),
    status: t.string(),
    created_at_ms: t.u64()
  }
);

const live_stats = table(
  { name: "live_stats", public: true },
  {
    session_id: t.string().primaryKey(),
    joined_count: t.u32(),
    real_joined_count: t.u32(),
    simulated_joined_count: t.u32(),
    answers_count: t.u32(),
    answers_per_sec: t.u32(),
    reducer_calls: t.u32(),
    duplicate_answers_rejected: t.u32(),
    p95_latency_ms: t.u32(),
    active_clients: t.u32(),
    updated_at_ms: t.u64()
  }
);

const audit_event = table(
  { name: "audit_event", public: true },
  {
    audit_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    actor_identity: t.string(),
    event_type: t.string(),
    message: t.string(),
    created_at_ms: t.u64()
  }
);

const spacetimedb = schema({
  session,
  participant,
  topic_vote,
  question,
  round,
  answer,
  score,
  match_event,
  agent_request,
  agent_event,
  live_stats,
  audit_event
});

export default spacetimedb;

export const init = spacetimedb.init((ctx) => {
  if (!ctx.db.session.session_id.find("session-demo")) {
    createSessionRow(ctx, DEFAULT_CODE, QUESTION_COUNT);
  }
});

export const create_session = spacetimedb.reducer({ code: t.string(), question_count: t.u32() }, (ctx, { code, question_count }) => {
  resetSessionTables(ctx, "session-demo");
  createSessionRow(ctx, code || DEFAULT_CODE, question_count || QUESTION_COUNT);
  insertAudit(ctx, "session-demo", sender(ctx), "create_session", "QuizRush session created.");
  bumpStats(ctx, "session-demo");
});

export const join_session = spacetimedb.reducer({ code: t.string(), display_name: t.string(), avatar: t.string() }, (ctx, { code, display_name, avatar }) => {
  const current = requireSessionByCode(ctx, code);
  if (!["lobby", "topic_voting", "generating", "ready"].includes(current.status)) {
    throw new Error("This tournament is already in progress.");
  }
  const caller = sender(ctx);
  for (const existing of ctx.db.participant.session_id.filter(current.session_id)) {
    if (existing.identity === caller) {
      ctx.db.participant.participant_id.update({ ...existing, display_name: cleanName(display_name), avatar, last_seen_ms: nowMs() });
      return;
    }
  }

  const now = nowMs();
  const participant_id = id("participant");
  ctx.db.participant.insert({
    participant_id,
    session_id: current.session_id,
    identity: caller,
    display_name: cleanName(display_name),
    avatar: avatar || "🚀",
    joined_at_ms: now,
    last_seen_ms: now,
    is_simulated: false,
    client_latency_ms: undefined
  });
  ctx.db.score.insert(emptyScore(current.session_id, participant_id, now));
  ctx.db.session.session_id.update({ ...current, status: current.status === "lobby" ? "topic_voting" : current.status, updated_at_ms: now });
  insertMatchEvent(ctx, current.session_id, participant_id, "join", undefined, undefined, undefined, `{"displayName":${JSON.stringify(cleanName(display_name))}}`);
  recalcStats(ctx, current.session_id);
});

export const submit_topic_vote = spacetimedb.reducer({ session_id: t.string(), topics_json: t.string() }, (ctx, { session_id, topics_json }) => {
  const participantRow = requireParticipantForSender(ctx, session_id);
  ctx.db.topic_vote.participant_id.delete(participantRow.participant_id);
  const topics = parseTopics(topics_json);
  const now = nowMs();
  for (const topic of topics) {
    ctx.db.topic_vote.insert({
      vote_id: id("topic-vote"),
      session_id,
      participant_id: participantRow.participant_id,
      topic,
      created_at_ms: now
    });
  }
  const current = requireSession(ctx, session_id);
  ctx.db.session.session_id.update({ ...current, status: current.status === "lobby" ? "topic_voting" : current.status, selected_topic: topicFromVotes(ctx, session_id), updated_at_ms: now });
  insertMatchEvent(ctx, session_id, participantRow.participant_id, "topic_vote", undefined, undefined, undefined, JSON.stringify({ topics }));
  bumpStats(ctx, session_id);
});

export const request_questions = spacetimedb.reducer({ session_id: t.string(), topic: t.string(), question_count: t.u32() }, (ctx, { session_id, topic, question_count }) => {
  const current = requireSession(ctx, session_id);
  const now = nowMs();
  const selected_topic = topic || topicFromVotes(ctx, session_id);
  const requestedCount = question_count || QUESTION_COUNT;
  const pendingSame = Array.from(ctx.db.agent_request.session_id.filter(session_id)).find(
    (request) => request.status === "pending" && request.topic === selected_topic
  );
  if (pendingSame) {
    bumpStats(ctx, session_id);
    return;
  }
  for (const request of ctx.db.agent_request.session_id.filter(session_id)) {
    if (request.status === "pending") {
      ctx.db.agent_request.request_id.update({
        ...request,
        status: "failed",
        updated_at_ms: now,
        error_message: `Superseded by newer quiz request for ${selected_topic}.`
      });
    }
  }
  if (current.status !== "playing" && current.status !== "finished" && current.status !== "replay") {
    ctx.db.question.session_id.delete(session_id);
    ctx.db.round.session_id.delete(session_id);
  }
  ctx.db.session.session_id.update({
    ...current,
    status: "generating",
    selected_topic,
    question_count: requestedCount,
    updated_at_ms: now
  });
  ctx.db.agent_request.insert({
    request_id: id("agent-request"),
    session_id,
    request_type: "quiz_generation",
    topic: selected_topic,
    question_count: requestedCount,
    status: "pending",
    created_at_ms: now,
    updated_at_ms: now,
    error_message: undefined
  });
  insertAgentEvent(ctx, session_id, "Topic Router Agent", "topic_selected", `Selected ${selected_topic} from live topic votes.`, 0.88, "complete");
  insertMatchEvent(ctx, session_id, undefined, "questions_requested", undefined, undefined, undefined, JSON.stringify({ selected_topic }));
  submitQuestionPackInternal(ctx, session_id, selected_topic, JSON.stringify({ questions: fallbackQuestionsForTopic(selected_topic, requestedCount) }), undefined);
  bumpStats(ctx, session_id);
});

export const submit_question_pack = spacetimedb.reducer(
  { session_id: t.string(), selected_topic: t.string(), questions_json: t.string(), request_id: t.option(t.string()) },
  (ctx, input) => submitQuestionPackInternal(ctx, input.session_id, input.selected_topic, input.questions_json, input.request_id)
);

export const submit_question_batch = spacetimedb.reducer(
  { session_id: t.string(), selected_topic: t.string(), questions_json: t.string(), request_id: t.option(t.string()) },
  (ctx, input) => submitQuestionPackInternal(ctx, input.session_id, input.selected_topic, input.questions_json, input.request_id)
);

export const start_match = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  const current = requireSession(ctx, session_id);
  if (Array.from(ctx.db.participant.session_id.filter(session_id)).length === 0) {
    throw new Error("At least one participant must join before the match starts.");
  }
  if (Array.from(ctx.db.question.session_id.filter(session_id)).length < current.question_count) {
    throw new Error("Question pack is not ready.");
  }
  ctx.db.round.session_id.delete(session_id);
  ctx.db.answer.session_id.delete(session_id);
  const now = nowMs();
  for (const item of ctx.db.score.session_id.filter(session_id)) {
    ctx.db.score.score_id.update({
      ...item,
      total_score: 0,
      correct_count: 0,
      total_response_ms: 0,
      fastest_response_ms: undefined,
      current_rank: 1,
      previous_rank: 1,
      last_answer_at_ms: undefined,
      updated_at_ms: now
    });
  }
  ctx.db.session.session_id.update({
    ...current,
    status: "playing",
    current_round: 1,
    match_started_at_ms: now,
    match_finished_at_ms: undefined,
    updated_at_ms: now
  });
  recomputeRanks(ctx, session_id);
  startRoundInternal(ctx, session_id, 1);
  bumpStats(ctx, session_id);
});

export const start_round = spacetimedb.reducer({ session_id: t.string(), question_order: t.u32() }, (ctx, { session_id, question_order }) => {
  startRoundInternal(ctx, session_id, question_order);
  bumpStats(ctx, session_id);
});

export const submit_answer = spacetimedb.reducer({ round_id: t.string(), selected_option: t.string() }, (ctx, { round_id, selected_option }) => {
  if (!["A", "B", "C", "D"].includes(selected_option)) throw new Error("selected_option must be A/B/C/D.");
  const currentRound = requireRound(ctx, round_id);
  if (currentRound.status !== "active") throw new Error("Round is not active.");
  const participantRow = requireParticipantForSender(ctx, currentRound.session_id);
  for (const existing of ctx.db.answer.round_id.filter(round_id)) {
    if (existing.participant_id === participantRow.participant_id) {
      const stats = requireStats(ctx, currentRound.session_id);
      ctx.db.live_stats.session_id.update({
        ...stats,
        duplicate_answers_rejected: stats.duplicate_answers_rejected + 1,
        updated_at_ms: nowMs()
      });
      throw new Error("Duplicate answer rejected.");
    }
  }
  const currentQuestion = requireQuestion(ctx, currentRound.question_id);
  const now = nowMs();
  if (now > currentRound.ends_at_ms) throw new Error("Round has ended.");
  const response_ms = Math.max(0, Math.min(Number(now - currentRound.starts_at_ms), QUESTION_TIME_LIMIT_MS));
  const is_correct = selected_option === currentQuestion.correct_option;
  const score_delta = computeAnswerScore(is_correct, response_ms);
  ctx.db.answer.insert({
    answer_id: id("answer"),
    session_id: currentRound.session_id,
    round_id,
    participant_id: participantRow.participant_id,
    selected_option,
    is_correct,
    response_ms,
    score_delta,
    server_received_at_ms: now
  });
  const currentScore = requireScore(ctx, currentRound.session_id, participantRow.participant_id);
  ctx.db.score.score_id.update({
    ...currentScore,
    total_score: currentScore.total_score + score_delta,
    correct_count: currentScore.correct_count + (is_correct ? 1 : 0),
    total_response_ms: currentScore.total_response_ms + response_ms,
    fastest_response_ms:
      currentScore.fastest_response_ms === undefined ? response_ms : Math.min(currentScore.fastest_response_ms, response_ms),
    last_answer_at_ms: now,
    updated_at_ms: now
  });
  recomputeRanks(ctx, currentRound.session_id);
  const updatedScore = requireScore(ctx, currentRound.session_id, participantRow.participant_id);
  insertMatchEvent(ctx, currentRound.session_id, participantRow.participant_id, "answer", currentRound.order_index, updatedScore.total_score, updatedScore.current_rank, JSON.stringify({ selected_option, is_correct, response_ms }));
  insertMatchEvent(ctx, currentRound.session_id, participantRow.participant_id, "score_delta", currentRound.order_index, updatedScore.total_score, updatedScore.current_rank, JSON.stringify({ score_delta }));
  recalcStats(ctx, currentRound.session_id);
});

export const resolve_round = spacetimedb.reducer({ round_id: t.string() }, (ctx, { round_id }) => {
  const currentRound = requireRound(ctx, round_id);
  if (currentRound.status === "resolved") return;
  const now = nowMs();
  ctx.db.round.round_id.update({ ...currentRound, status: "resolved", resolved_at_ms: now });
  insertMatchEvent(ctx, currentRound.session_id, undefined, "round_resolved", currentRound.order_index, undefined, undefined, "{}");
  const current = requireSession(ctx, currentRound.session_id);
  if (currentRound.order_index >= current.question_count) {
    finishMatchInternal(ctx, current.session_id);
  } else {
    startRoundInternal(ctx, current.session_id, currentRound.order_index + 1);
  }
  bumpStats(ctx, currentRound.session_id);
});

export const finish_match = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  finishMatchInternal(ctx, session_id);
  bumpStats(ctx, session_id);
});

export const heartbeat = spacetimedb.reducer({ session_id: t.string(), client_latency_ms: t.option(t.u32()) }, (ctx, { session_id, client_latency_ms }) => {
  const participantRow = participantForSender(ctx, session_id);
  if (participantRow) {
    ctx.db.participant.participant_id.update({ ...participantRow, last_seen_ms: nowMs(), client_latency_ms });
  }
  recalcStats(ctx, session_id);
});

export const live_tick = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  recalcStats(ctx, session_id);
  bumpStats(ctx, session_id);
});

export const reset_demo = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  resetSessionTables(ctx, session_id);
  const current = ctx.db.session.session_id.find(session_id);
  if (current) ctx.db.session.session_id.delete(session_id);
  createSessionRow(ctx, DEFAULT_CODE, QUESTION_COUNT);
  insertAudit(ctx, session_id, sender(ctx), "reset_demo", "QuizRush demo reset to a clean lobby.");
});

export const add_simulated_players = spacetimedb.reducer({ session_id: t.string(), count: t.u32() }, (ctx, { session_id, count }) => {
  const now = nowMs();
  const avatars = ["🚀", "🧠", "⚡", "✨", "🔥", "🐯"];
  const limit = Math.min(250, count);
  for (let i = 0; i < limit; i += 1) {
    const participant_id = id("sim");
    ctx.db.participant.insert({
      participant_id,
      session_id,
      identity: `sim-${participant_id}`,
      display_name: `Rusher ${i + 1}`,
      avatar: avatars[i % avatars.length] ?? "🚀",
      joined_at_ms: now,
      last_seen_ms: now,
      is_simulated: true,
      client_latency_ms: 35 + (i % 70)
    });
    ctx.db.score.insert(emptyScore(session_id, participant_id, now));
    insertMatchEvent(ctx, session_id, participant_id, "join", undefined, undefined, undefined, "{\"simulated\":true}");
  }
  const current = requireSession(ctx, session_id);
  if (current.status === "lobby") ctx.db.session.session_id.update({ ...current, status: "topic_voting", updated_at_ms: now });
  recomputeRanks(ctx, session_id);
  recalcStats(ctx, session_id);
});

export const simulate_answer_burst = spacetimedb.reducer({ session_id: t.string(), count: t.u32() }, (ctx, { session_id, count }) => {
  const current = requireSession(ctx, session_id);
  if (current.status !== "playing") return;
  const currentRound = Array.from(ctx.db.round.session_id.filter(session_id)).find((candidate) => candidate.status === "active");
  if (!currentRound) return;
  const now = nowMs();
  if (now < currentRound.starts_at_ms || now > currentRound.ends_at_ms + BigInt(200)) return;
  const currentQuestion = requireQuestion(ctx, currentRound.question_id);
  const answered = new Set(Array.from(ctx.db.answer.round_id.filter(currentRound.round_id)).map((item) => item.participant_id));
  const candidates = Array.from(ctx.db.participant.session_id.filter(session_id))
    .filter((item) => item.is_simulated && !answered.has(item.participant_id))
    .sort((a, b) => a.participant_id.localeCompare(b.participant_id))
    .slice(0, Math.min(Number(count || SIMULATED_ANSWER_BURST_SIZE), 32));
  const wrongOptions = ["A", "B", "C", "D"].filter((option) => option !== currentQuestion.correct_option);

  candidates.forEach((item, index) => {
    const response_ms = Math.max(0, Math.min(Number(now - currentRound.starts_at_ms) + (index % 5) * 9, QUESTION_TIME_LIMIT_MS));
    const is_correct = (index + currentRound.order_index + numericSuffix(item.participant_id)) % 5 !== 0;
    const selected_option = is_correct ? currentQuestion.correct_option : wrongOptions[index % wrongOptions.length] ?? "A";
    const score_delta = computeAnswerScore(is_correct, response_ms);
    ctx.db.answer.insert({
      answer_id: id("answer"),
      session_id,
      round_id: currentRound.round_id,
      participant_id: item.participant_id,
      selected_option,
      is_correct,
      response_ms,
      score_delta,
      server_received_at_ms: now + BigInt(index)
    });
    const currentScore = requireScore(ctx, session_id, item.participant_id);
    ctx.db.score.score_id.update({
      ...currentScore,
      total_score: currentScore.total_score + score_delta,
      correct_count: currentScore.correct_count + (is_correct ? 1 : 0),
      total_response_ms: currentScore.total_response_ms + response_ms,
      fastest_response_ms:
        currentScore.fastest_response_ms === undefined ? response_ms : Math.min(currentScore.fastest_response_ms, response_ms),
      last_answer_at_ms: now + BigInt(index),
      updated_at_ms: now + BigInt(index)
    });
    const updatedScore = requireScore(ctx, session_id, item.participant_id);
    insertMatchEvent(ctx, session_id, item.participant_id, "answer", currentRound.order_index, updatedScore.total_score, updatedScore.current_rank, JSON.stringify({ selected_option, is_correct, response_ms, simulated: true }));
    insertMatchEvent(ctx, session_id, item.participant_id, "score_delta", currentRound.order_index, updatedScore.total_score, updatedScore.current_rank, JSON.stringify({ score_delta, simulated: true }));
  });

  if (candidates.length) {
    recomputeRanks(ctx, session_id);
    recalcStats(ctx, session_id);
  }
  bumpStats(ctx, session_id);
});

export const record_agent_event = spacetimedb.reducer(
  { session_id: t.string(), agent_name: t.string(), event_type: t.string(), content: t.string(), confidence: t.f32(), status: t.string() },
  (ctx, input) => {
    insertAgentEvent(ctx, input.session_id, input.agent_name, input.event_type, input.content, input.confidence, input.status);
    bumpStats(ctx, input.session_id);
  }
);

type ReducerCtx = Parameters<Parameters<typeof spacetimedb.reducer>[1]>[0];
type SessionRow = ReturnType<ReducerCtx["db"]["session"]["session_id"]["find"]> extends infer R ? NonNullable<R> : never;
type RoundRow = ReturnType<ReducerCtx["db"]["round"]["round_id"]["find"]> extends infer R ? NonNullable<R> : never;
type QuestionRow = ReturnType<ReducerCtx["db"]["question"]["question_id"]["find"]> extends infer R ? NonNullable<R> : never;
type ParticipantRow = ReturnType<ReducerCtx["db"]["participant"]["participant_id"]["find"]> extends infer R ? NonNullable<R> : never;
type ScoreRow = ReturnType<ReducerCtx["db"]["score"]["score_id"]["find"]> extends infer R ? NonNullable<R> : never;

function createSessionRow(ctx: ReducerCtx, code: string, question_count: number) {
  const now = nowMs();
  ctx.db.session.insert({
    session_id: "session-demo",
    code,
    status: "lobby",
    selected_topic: undefined,
    question_count,
    current_round: 0,
    match_started_at_ms: undefined,
    match_finished_at_ms: undefined,
    created_at_ms: now,
    updated_at_ms: now
  });
  ctx.db.live_stats.insert(emptyStats("session-demo", now));
  insertAgentEvent(ctx, "session-demo", "Seed Fallback Provider", "fallback_ready", "Topic-specific deterministic backup questions are ready if the LLM is unavailable.", 1, "complete");
}

function submitQuestionPackInternal(ctx: ReducerCtx, session_id: string, selected_topic: string, questions_json: string, request_id?: string) {
  const current = requireSession(ctx, session_id);
  if (request_id) {
    const request = ctx.db.agent_request.request_id.find(request_id);
    if (!request || request.session_id !== session_id || request.status !== "pending") {
      insertAgentEvent(ctx, session_id, "Match Engine", "stale_question_pack_ignored", "A question pack from an older generation request arrived after reset and was ignored.", 1, "complete");
      bumpStats(ctx, session_id);
      return;
    }
  }
  if ((current.status === "playing" || current.status === "finished" || current.status === "replay") && Array.from(ctx.db.question.session_id.filter(session_id)).length > 0) {
    if (request_id) {
      const request = ctx.db.agent_request.request_id.find(request_id);
      if (request) ctx.db.agent_request.request_id.update({ ...request, status: "complete", updated_at_ms: nowMs() });
    }
    insertAgentEvent(ctx, session_id, "Match Engine", "late_question_pack_ignored", "A late question pack arrived after the race started, so the locked question set stayed live.", 1, "complete");
    return;
  }
  const parsed = JSON.parse(questions_json) as {
    questions?: Array<{
      questionText: string;
      options: { A: string; B: string; C: string; D: string };
      correctOption: string;
      explanation: string;
      topic?: string;
    }>;
  };
  if (!Array.isArray(parsed.questions) || parsed.questions.length < current.question_count) {
    throw new Error("Malformed question pack.");
  }
  ctx.db.question.session_id.delete(session_id);
  ctx.db.round.session_id.delete(session_id);
  const now = nowMs();
  parsed.questions.slice(0, current.question_count).forEach((item, index) => {
    if (!item.options || !["A", "B", "C", "D"].includes(item.correctOption)) throw new Error("Malformed question option.");
    ctx.db.question.insert({
      question_id: id("question"),
      session_id,
      order_index: index + 1,
      question_text: item.questionText,
      option_a: item.options.A,
      option_b: item.options.B,
      option_c: item.options.C,
      option_d: item.options.D,
      correct_option: item.correctOption,
      explanation: item.explanation,
      topic: item.topic || selected_topic,
      generated_by: sender(ctx) === "agent-worker" ? "Quiz Builder Agent" : "Seed Fallback Provider",
      fairness_status: sender(ctx) === "agent-worker" ? "approved" : "fallback",
      created_at_ms: now
    });
  });
  ctx.db.session.session_id.update({ ...current, status: "ready", selected_topic, updated_at_ms: now });
  if (request_id) {
    const request = ctx.db.agent_request.request_id.find(request_id);
    if (request) ctx.db.agent_request.request_id.update({ ...request, status: "complete", updated_at_ms: now });
  }
  insertAgentEvent(ctx, session_id, "Match Engine", "questions_ready", `${current.question_count} questions are ready for a 25-second race.`, 1, "complete");
  bumpStats(ctx, session_id);
}

function startRoundInternal(ctx: ReducerCtx, session_id: string, question_order: number) {
  const current = requireSession(ctx, session_id);
  const questionRow = Array.from(ctx.db.question.session_id.filter(session_id)).find((candidate) => candidate.order_index === question_order);
  if (!questionRow) throw new Error(`Question ${question_order} is not ready.`);
  const now = nowMs();
  const matchStartedAt = current.match_started_at_ms ?? now;
  const matchDeadline = matchStartedAt + BigInt(TOTAL_MATCH_MS);
  const startsAt = now < matchStartedAt ? matchStartedAt : now > matchDeadline ? matchDeadline : now;
  const candidateEndsAt = startsAt + BigInt(QUESTION_TIME_LIMIT_MS);
  const endsAt = candidateEndsAt > matchDeadline ? matchDeadline : candidateEndsAt;
  for (const active of ctx.db.round.session_id.filter(session_id)) {
    if (active.status === "active") ctx.db.round.round_id.update({ ...active, status: "resolved", resolved_at_ms: now });
  }
  const existing = Array.from(ctx.db.round.session_id.filter(session_id)).find((candidate) => candidate.order_index === question_order);
  if (existing) {
    ctx.db.round.round_id.update({
      ...existing,
      status: "active",
      starts_at_ms: startsAt,
      ends_at_ms: endsAt,
      resolved_at_ms: undefined
    });
  } else {
    ctx.db.round.insert({
      round_id: id("round"),
      session_id,
      question_id: questionRow.question_id,
      order_index: question_order,
      status: "active",
      starts_at_ms: startsAt,
      ends_at_ms: endsAt,
      resolved_at_ms: undefined
    });
  }
  ctx.db.session.session_id.update({ ...current, status: "playing", current_round: question_order, updated_at_ms: now });
  insertMatchEvent(ctx, session_id, undefined, "question_start", question_order, undefined, undefined, JSON.stringify({ question_id: questionRow.question_id }));
}

function recomputeRanks(ctx: ReducerCtx, session_id: string) {
  const scores = Array.from(ctx.db.score.session_id.filter(session_id)).sort(compareScores);
  const now = nowMs();
  scores.forEach((item, index) => {
    const nextRank = index + 1;
    const previousRank = item.current_rank;
    ctx.db.score.score_id.update({
      ...item,
      previous_rank: previousRank,
      current_rank: nextRank,
      updated_at_ms: now
    });
    if (previousRank !== nextRank) {
      insertMatchEvent(ctx, session_id, item.participant_id, "rank_change", undefined, item.total_score, nextRank, JSON.stringify({ previousRank, currentRank: nextRank }));
    }
  });
}

function compareScores(a: ScoreRow, b: ScoreRow): number {
  if (b.total_score !== a.total_score) return b.total_score - a.total_score;
  if (b.correct_count !== a.correct_count) return b.correct_count - a.correct_count;
  if (a.total_response_ms !== b.total_response_ms) return a.total_response_ms - b.total_response_ms;
  const aFast = a.fastest_response_ms ?? Number.MAX_SAFE_INTEGER;
  const bFast = b.fastest_response_ms ?? Number.MAX_SAFE_INTEGER;
  if (aFast !== bFast) return aFast - bFast;
  const aLast = a.last_answer_at_ms ?? BigInt(Number.MAX_SAFE_INTEGER);
  const bLast = b.last_answer_at_ms ?? BigInt(Number.MAX_SAFE_INTEGER);
  if (aLast !== bLast) return aLast < bLast ? -1 : 1;
  return a.participant_id.localeCompare(b.participant_id);
}

function finishMatchInternal(ctx: ReducerCtx, session_id: string) {
  const current = requireSession(ctx, session_id);
  if (current.status === "finished") return;
  const now = nowMs();
  for (const active of ctx.db.round.session_id.filter(session_id)) {
    if (active.status === "active") ctx.db.round.round_id.update({ ...active, status: "resolved", resolved_at_ms: now });
  }
  ctx.db.session.session_id.update({ ...current, status: "finished", match_finished_at_ms: now, updated_at_ms: now });
  const winner = Array.from(ctx.db.score.session_id.filter(session_id)).sort(compareScores)[0];
  insertMatchEvent(ctx, session_id, winner?.participant_id, "match_finished", undefined, winner?.total_score, winner?.current_rank, "{}");
}

function computeAnswerScore(is_correct: boolean, response_ms: number): number {
  if (!is_correct) return 0;
  const speed = Math.floor(1000 * Math.max(0, Math.min(1, 1 - response_ms / QUESTION_TIME_LIMIT_MS)));
  return 1000 + speed;
}

function emptyScore(session_id: string, participant_id: string, now: bigint) {
  return {
    score_id: `${session_id}:${participant_id}`,
    session_id,
    participant_id,
    total_score: 0,
    correct_count: 0,
    total_response_ms: 0,
    fastest_response_ms: undefined,
    current_rank: 1,
    previous_rank: 1,
    last_answer_at_ms: undefined,
    updated_at_ms: now
  };
}

function resetSessionTables(ctx: ReducerCtx, session_id: string) {
  ctx.db.participant.session_id.delete(session_id);
  ctx.db.topic_vote.session_id.delete(session_id);
  ctx.db.question.session_id.delete(session_id);
  ctx.db.round.session_id.delete(session_id);
  ctx.db.answer.session_id.delete(session_id);
  ctx.db.score.session_id.delete(session_id);
  ctx.db.match_event.session_id.delete(session_id);
  ctx.db.agent_request.session_id.delete(session_id);
  ctx.db.agent_event.session_id.delete(session_id);
  ctx.db.audit_event.session_id.delete(session_id);
  ctx.db.live_stats.session_id.delete(session_id);
}

function requireSession(ctx: ReducerCtx, session_id: string): SessionRow {
  const row = ctx.db.session.session_id.find(session_id);
  if (!row) throw new Error(`Session not found: ${session_id}`);
  return row;
}

function requireSessionByCode(ctx: ReducerCtx, code: string): SessionRow {
  const row = ctx.db.session.code.find(code);
  if (!row) throw new Error(`Session not found: ${code}`);
  return row;
}

function requireRound(ctx: ReducerCtx, round_id: string): RoundRow {
  const row = ctx.db.round.round_id.find(round_id);
  if (!row) throw new Error(`Round not found: ${round_id}`);
  return row;
}

function requireQuestion(ctx: ReducerCtx, question_id: string): QuestionRow {
  const row = ctx.db.question.question_id.find(question_id);
  if (!row) throw new Error(`Question not found: ${question_id}`);
  return row;
}

function requireParticipantForSender(ctx: ReducerCtx, session_id: string): ParticipantRow {
  const participantRow = participantForSender(ctx, session_id);
  if (!participantRow) throw new Error("Join the tournament before acting.");
  return participantRow;
}

function participantForSender(ctx: ReducerCtx, session_id: string): ParticipantRow | undefined {
  const caller = sender(ctx);
  for (const row of ctx.db.participant.session_id.filter(session_id)) {
    if (row.identity === caller) return row;
  }
  return undefined;
}

function requireScore(ctx: ReducerCtx, session_id: string, participant_id: string): ScoreRow {
  const row = ctx.db.score.score_id.find(`${session_id}:${participant_id}`);
  if (!row) throw new Error(`Score not found: ${participant_id}`);
  return row;
}

function requireStats(ctx: ReducerCtx, session_id: string) {
  const row = ctx.db.live_stats.session_id.find(session_id);
  if (!row) throw new Error(`LiveStats not found: ${session_id}`);
  return row;
}

function recalcStats(ctx: ReducerCtx, session_id: string) {
  const stats = requireStats(ctx, session_id);
  const now = nowMs();
  const participants = Array.from(ctx.db.participant.session_id.filter(session_id));
  const answers = Array.from(ctx.db.answer.session_id.filter(session_id));
  const latencies = participants
    .map((item) => item.client_latency_ms)
    .filter((item): item is number => typeof item === "number")
    .sort((a, b) => a - b);
  ctx.db.live_stats.session_id.update({
    ...stats,
    joined_count: participants.length,
    real_joined_count: participants.filter((item) => !item.is_simulated).length,
    simulated_joined_count: participants.filter((item) => item.is_simulated).length,
    answers_count: answers.length,
    answers_per_sec: answers.filter((item) => now - item.server_received_at_ms <= BigInt(1000)).length,
    active_clients: participants.filter((item) => now - item.last_seen_ms <= BigInt(15_000)).length,
    p95_latency_ms: latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 48 : 48,
    updated_at_ms: now
  });
}

function bumpStats(ctx: ReducerCtx, session_id: string) {
  const stats = requireStats(ctx, session_id);
  ctx.db.live_stats.session_id.update({ ...stats, reducer_calls: stats.reducer_calls + 1, updated_at_ms: nowMs() });
}

function emptyStats(session_id: string, now: bigint) {
  return {
    session_id,
    joined_count: 0,
    real_joined_count: 0,
    simulated_joined_count: 0,
    answers_count: 0,
    answers_per_sec: 0,
    reducer_calls: 0,
    duplicate_answers_rejected: 0,
    p95_latency_ms: 48,
    active_clients: 0,
    updated_at_ms: now
  };
}

function insertMatchEvent(
  ctx: ReducerCtx,
  session_id: string,
  participant_id: string | undefined,
  event_type: string,
  round_index: number | undefined,
  score_after: number | undefined,
  rank_after: number | undefined,
  payload_json: string
) {
  ctx.db.match_event.insert({
    event_id: id("event"),
    session_id,
    participant_id,
    event_type,
    round_index,
    score_after,
    rank_after,
    payload_json,
    created_at_ms: nowMs()
  });
}

function insertAgentEvent(ctx: ReducerCtx, session_id: string, agent_name: string, event_type: string, content: string, confidence: number, status: string) {
  ctx.db.agent_event.insert({
    event_id: id("agent-event"),
    session_id,
    agent_name,
    event_type,
    content,
    confidence,
    status,
    created_at_ms: nowMs()
  });
}

function insertAudit(ctx: ReducerCtx, session_id: string, actor_identity: string, event_type: string, message: string) {
  ctx.db.audit_event.insert({
    audit_id: id("audit"),
    session_id,
    actor_identity,
    event_type,
    message,
    created_at_ms: nowMs()
  });
}

function topicFromVotes(ctx: ReducerCtx, session_id: string): string {
  const counts = new Map<string, number>();
  for (const vote of ctx.db.topic_vote.session_id.filter(session_id)) {
    counts.set(vote.topic, (counts.get(vote.topic) ?? 0) + 1);
  }
  if (!counts.size) return DEFAULT_TOPIC;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([topic]) => topic)
    .join(" + ");
}

function fallbackQuestionsForTopic(topic: string, count: number) {
  const normalized = normalizeTopic(topic);
  const lower = normalized.toLowerCase();
  const pack = lower.includes("visa") || lower.includes("immigration")
    ? [
        fq("In the {topic}, what is a visa generally used for?", ["Requesting entry", "Owning property", "Paying taxes", "Voting"], "A", "A visa is generally used to request permission to travel to a country for a stated purpose.", normalized),
        fq("Which document is a visa usually linked with?", ["Passport", "School ID", "Receipt", "Boarding pass"], "A", "Visas are usually placed in or electronically linked to a passport.", normalized),
        fq("What does a visa category usually describe?", ["Travel purpose", "Favorite city", "Phone model", "Hotel rating"], "A", "A visa category usually describes the purpose of travel.", normalized),
        fq("Who commonly reviews visa applications abroad?", ["Consular officer", "Airline pilot", "Hotel manager", "Bank teller"], "A", "Consular officers review many visa applications at embassies or consulates.", normalized),
        fq("What does overstaying usually mean?", ["Staying too long", "Booking early", "Flying direct", "Packing light"], "A", "Overstaying means remaining beyond the authorized period of stay.", normalized),
        fq("At a US port of entry, who decides admission?", ["Border officer", "Taxi driver", "Tour guide", "Travel blogger"], "A", "A border officer makes the final admission decision at the port of entry.", normalized),
        fq("Why do forms ask for travel purpose?", ["Match the visa", "Pick an airline", "Choose a meal", "Rate a hotel"], "A", "Travel purpose helps match a person to the correct visa category.", normalized)
      ]
    : [
        fq("In {topic}, what helps make answers reliable?", ["Clear definitions", "Random guesses", "Hidden rules", "Long delays"], "A", "Clear definitions make a fast quiz on {topic} fair and answerable.", normalized),
        fq("What is the best first step when learning {topic}?", ["Know key terms", "Skip basics", "Ignore context", "Avoid examples"], "A", "Key terms give players a shared starting point for {topic}.", normalized),
        fq("A good {topic} question should be...", ["Unambiguous", "Tricky only", "Personal", "Unverifiable"], "A", "Unambiguous questions keep a rapid tournament fair.", normalized),
        fq("Which signal should shape this arena?", ["Player intent", "Screen size", "Join order", "Button color"], "A", "QuizRush uses submitted expertise intent to shape the arena topic.", normalized),
        fq("For a fair {topic} sprint, scoring should reward...", ["Accuracy and speed", "Random taps", "Slow loading", "Duplicate answers"], "A", "The race rewards correct answers and fast server-received response time.", normalized),
        fq("What should an AI quiz avoid in {topic}?", ["Unsafe claims", "Clear options", "Short text", "One answer"], "A", "Agent guardrails avoid unsafe claims and ambiguous answer choices.", normalized),
        fq("Why keep {topic} questions short?", ["Fast reading", "More scrolling", "Harder tapping", "Less fairness"], "A", "Short questions fit phone screens and keep the 25-second sprint moving.", normalized)
      ];
  const questions = [];
  for (let index = 0; index < count; index += 1) questions.push(pack[index % pack.length]);
  return questions;
}

function fq(questionText: string, options: [string, string, string, string], correctOption: string, explanation: string, topic: string) {
  return {
    questionText: questionText.replace(/\{topic\}/g, topic),
    options: { A: options[0], B: options[1], C: options[2], D: options[3] },
    correctOption,
    explanation: explanation.replace(/\{topic\}/g, topic),
    topic
  };
}

function normalizeTopic(topic: string): string {
  const cleaned = topic.trim().replace(/\s+/g, " ");
  if (!cleaned) return DEFAULT_TOPIC;
  return cleaned
    .split(" + ")
    .map((part) =>
      part
        .trim()
        .split(/\s+/)
        .map((word) => {
          const lower = word.toLowerCase();
          return ["us", "usa", "uk", "ai", "llm", "db", "sql", "api"].includes(lower)
            ? lower.toUpperCase()
            : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(" ")
    )
    .slice(0, 3)
    .join(" + ")
    .slice(0, 80);
}

function parseTopics(topics_json: string): string[] {
  const parsed = JSON.parse(topics_json) as unknown;
  if (!Array.isArray(parsed)) throw new Error("topics_json must be a JSON array.");
  return Array.from(new Set(parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))).slice(0, 3);
}

function cleanName(name: string): string {
  return name.trim().slice(0, 24) || "Player";
}

function numericSuffix(value: string): number {
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function sender(ctx: ReducerCtx): string {
  return String(ctx.sender);
}

function nowMs(): bigint {
  return BigInt(Date.now());
}

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}
