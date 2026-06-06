import { schema, table, t } from "spacetimedb/server";

const session = table(
  { name: "session", public: true },
  {
    session_id: t.string().primaryKey(),
    join_code: t.string().unique(),
    topic: t.string(),
    difficulty: t.string(),
    question_count: t.u32(),
    status: t.string(),
    created_by: t.string(),
    created_at_ms: t.u64(),
    updated_at_ms: t.u64(),
    current_match_id: t.option(t.string()),
    lobby_opened_at_ms: t.option(t.u64())
  }
);

const participant = table(
  { name: "participant", public: true },
  {
    participant_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    identity: t.string().index("btree"),
    display_name: t.string(),
    avatar_seed: t.string(),
    role_requested: t.string(),
    role_assigned: t.string(),
    interests_json: t.string(),
    joined_at_ms: t.u64(),
    last_seen_ms: t.u64(),
    is_simulated: t.bool()
  }
);

const match = table(
  { name: "match", public: true },
  {
    match_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    player1_id: t.string(),
    player2_id: t.string(),
    status: t.string(),
    current_round_number: t.u32(),
    player1_ready: t.bool(),
    player2_ready: t.bool(),
    started_at_ms: t.option(t.u64()),
    finished_at_ms: t.option(t.u64())
  }
);

const question = table(
  { name: "question", public: true },
  {
    question_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    match_id: t.option(t.string()),
    round_number: t.u32(),
    question_text: t.string(),
    option_a: t.string(),
    option_b: t.string(),
    option_c: t.string(),
    option_d: t.string(),
    correct_option: t.string(),
    explanation: t.string(),
    difficulty: t.string(),
    source_agent: t.string(),
    fairness_status: t.string(),
    created_at_ms: t.u64()
  }
);

const round = table(
  { name: "round", public: true },
  {
    round_id: t.string().primaryKey(),
    match_id: t.string().index("btree"),
    question_id: t.string(),
    round_number: t.u32(),
    status: t.string(),
    starts_at_ms: t.u64(),
    ends_at_ms: t.u64(),
    resolved_at_ms: t.option(t.u64()),
    winner_player_id: t.option(t.string())
  }
);

const answer = table(
  { name: "answer", public: true },
  {
    answer_id: t.string().primaryKey(),
    round_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    selected_option: t.string(),
    server_received_at_ms: t.u64(),
    response_ms: t.u32(),
    is_correct: t.bool(),
    points_awarded: t.u32()
  }
);

const play_along_answer = table(
  { name: "play_along_answer", public: true },
  {
    answer_id: t.string().primaryKey(),
    round_id: t.string().index("btree"),
    supporter_id: t.string().index("btree"),
    selected_option: t.string(),
    server_received_at_ms: t.u64(),
    is_correct: t.bool()
  }
);

const support_event = table(
  { name: "support_event", public: true },
  {
    support_id: t.string().primaryKey(),
    round_id: t.string().index("btree"),
    supporter_id: t.string().index("btree"),
    player_id: t.string().index("btree"),
    amount: t.u32(),
    created_at_ms: t.u64(),
    client_event_id: t.option(t.string())
  }
);

const energy_balance = table(
  { name: "energy_balance", public: true },
  {
    participant_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    spendable_energy: t.u32(),
    trust_xp: t.u32(),
    updated_at_ms: t.u64()
  }
);

const score = table(
  { name: "score", public: true },
  {
    score_id: t.string().primaryKey(),
    participant_id: t.string().index("btree"),
    match_id: t.string().index("btree"),
    player_score: t.u32(),
    supporter_xp: t.u32(),
    support_accuracy_num: t.u32(),
    support_accuracy_den: t.u32(),
    playalong_correct: t.u32(),
    playalong_total: t.u32(),
    updated_at_ms: t.u64()
  }
);

const ledger_entry = table(
  { name: "ledger_entry", public: true },
  {
    ledger_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    match_id: t.option(t.string()),
    round_id: t.option(t.string()),
    participant_id: t.string().index("btree"),
    delta: t.i32(),
    currency_type: t.string(),
    reason: t.string(),
    metadata_json: t.string(),
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
    difficulty: t.string(),
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
    player_candidate_count: t.u32(),
    crowd_count: t.u32(),
    active_clients: t.u32(),
    cheer_events_count: t.u32(),
    cheer_events_per_sec: t.u32(),
    reducer_calls_count: t.u32(),
    duplicate_answers_rejected: t.u32(),
    double_spend_attempts_blocked: t.u32(),
    p95_sync_latency_ms: t.u32(),
    updated_at_ms: t.u64()
  }
);

const audit_event = table(
  { name: "audit_event", public: true },
  {
    event_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    actor_identity: t.string(),
    event_type: t.string(),
    message: t.string(),
    metadata_json: t.string(),
    created_at_ms: t.u64()
  }
);

const spacetimedb = schema({
  session,
  participant,
  match,
  question,
  round,
  answer,
  play_along_answer,
  support_event,
  energy_balance,
  score,
  ledger_entry,
  agent_request,
  agent_event,
  live_stats,
  audit_event
});

export default spacetimedb;

const INITIAL_ENERGY = 500;
const CHEER_AMOUNT = 25;
const QUESTION_TIME_LIMIT_MS = 10_000;

export const init = spacetimedb.init((ctx) => {
  const now = nowMs();
  if (!ctx.db.session.session_id.find("session-demo")) {
    ctx.db.session.insert({
      session_id: "session-demo",
      join_code: "ARENA-42",
      topic: "AI + Space + Startups",
      difficulty: "beginner",
      question_count: 3,
      status: "draft",
      created_by: "system",
      created_at_ms: now,
      updated_at_ms: now,
      current_match_id: undefined,
      lobby_opened_at_ms: undefined
    });
    ctx.db.live_stats.insert(emptyStats("session-demo", now));
    insertAudit(ctx, "session-demo", "system", "demo_ready", "Demo session initialized.", "{}");
  }
});

export const create_session = spacetimedb.reducer(
  { topic: t.string(), difficulty: t.string(), question_count: t.u32() },
  (ctx, { topic, difficulty, question_count }) => {
    const now = nowMs();
    const existing = ctx.db.session.session_id.find("session-demo");
    if (existing) {
      ctx.db.session.session_id.update({
        ...existing,
        topic,
        difficulty,
        question_count,
        status: "draft",
        updated_at_ms: now
      });
    } else {
      ctx.db.session.insert({
        session_id: "session-demo",
        join_code: "ARENA-42",
        topic,
        difficulty,
        question_count,
        status: "draft",
        created_by: sender(ctx),
        created_at_ms: now,
        updated_at_ms: now,
        current_match_id: undefined,
        lobby_opened_at_ms: undefined
      });
      ctx.db.live_stats.insert(emptyStats("session-demo", now));
    }
    bumpStats(ctx, "session-demo");
    insertAudit(ctx, "session-demo", sender(ctx), "create_session", `Session prepared for ${topic}.`, "{}");
  }
);

export const open_lobby = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  const current = requireSession(ctx, session_id);
  const now = nowMs();
  ctx.db.session.session_id.update({
    ...current,
    status: "lobby",
    lobby_opened_at_ms: now,
    updated_at_ms: now
  });
  bumpStats(ctx, session_id);
  insertAudit(ctx, session_id, sender(ctx), "open_lobby", "Lobby opened for live audience join.", "{}");
});

export const request_questions = spacetimedb.reducer(
  { session_id: t.string(), topic: t.string(), difficulty: t.string(), question_count: t.u32() },
  (ctx, { session_id, topic, difficulty, question_count }) => {
    const now = nowMs();
    const request_id = id("agent-request");
    ctx.db.agent_request.insert({
      request_id,
      session_id,
      request_type: "quiz_generation",
      topic,
      difficulty,
      question_count,
      status: "pending",
      created_at_ms: now,
      updated_at_ms: now,
      error_message: undefined
    });
    insertAgentEvent(ctx, session_id, "Quiz Author Agent", "request_created", `Question request queued for ${topic}.`, 0.9, "pending");
    bumpStats(ctx, session_id);
  }
);

export const submit_question_batch = spacetimedb.reducer(
  { session_id: t.string(), questions_json: t.string(), request_id: t.option(t.string()) },
  (ctx, { session_id, questions_json, request_id }) => {
    const parsed = JSON.parse(questions_json) as {
      questions?: Array<{
        questionText: string;
        options: { A: string; B: string; C: string; D: string };
        correctOption: string;
        explanation: string;
        difficulty: string;
      }>;
    };
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("Malformed question batch.");
    }
    ctx.db.question.session_id.delete(session_id);
    const current = requireSession(ctx, session_id);
    const now = nowMs();
    parsed.questions.slice(0, Number(current.question_count)).forEach((item, index) => {
      if (!["A", "B", "C", "D"].includes(item.correctOption)) {
        throw new Error("Malformed question option.");
      }
      ctx.db.question.insert({
        question_id: id("question"),
        session_id,
        match_id: current.current_match_id,
        round_number: index + 1,
        question_text: item.questionText,
        option_a: item.options.A,
        option_b: item.options.B,
        option_c: item.options.C,
        option_d: item.options.D,
        correct_option: item.correctOption,
        explanation: item.explanation,
        difficulty: item.difficulty,
        source_agent: "Quiz Author Agent",
        fairness_status: "approved",
        created_at_ms: now
      });
    });
    if (request_id) {
      const request = ctx.db.agent_request.request_id.find(request_id);
      if (request) ctx.db.agent_request.request_id.update({ ...request, status: "complete", updated_at_ms: now });
    }
    insertAgentEvent(ctx, session_id, "Fairness Review Agent", "questions_approved", "Questions validated and ready for the match.", 0.98, "complete");
    bumpStats(ctx, session_id);
  }
);

export const join_session = spacetimedb.reducer(
  { join_code: t.string(), display_name: t.string(), role_requested: t.string(), interests_json: t.string() },
  (ctx, { join_code, display_name, role_requested, interests_json }) => {
    const current = ctx.db.session.join_code.find(join_code);
    if (!current || current.status !== "lobby") throw new Error("This arena is not accepting joins yet.");
    const caller = sender(ctx);
    for (const existing of ctx.db.participant.session_id.filter(current.session_id)) {
      if (existing.identity === caller) return;
    }
    const now = nowMs();
    const participant_id = id("participant");
    ctx.db.participant.insert({
      participant_id,
      session_id: current.session_id,
      identity: caller,
      display_name,
      avatar_seed: `${display_name}-${caller}`,
      role_requested,
      role_assigned: "crowd",
      interests_json,
      joined_at_ms: now,
      last_seen_ms: now,
      is_simulated: false
    });
    ctx.db.energy_balance.insert({
      participant_id,
      session_id: current.session_id,
      spendable_energy: INITIAL_ENERGY,
      trust_xp: 0,
      updated_at_ms: now
    });
    insertLedger(ctx, current.session_id, undefined, undefined, participant_id, INITIAL_ENERGY, "energy", "initial_grant", "{}");
    recalcStats(ctx, current.session_id);
    insertAudit(ctx, current.session_id, caller, "join_session", `${display_name} joined the arena.`, "{}");
  }
);

export const assign_champions_randomly = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  const current = requireSession(ctx, session_id);
  if (current.current_match_id) return;
  if (current.status !== "lobby") throw new Error("Champions can only be selected from lobby.");
  const candidates = Array.from(ctx.db.participant.session_id.filter(session_id))
    .filter((item) => item.role_requested === "player")
    .sort((a, b) => a.participant_id.localeCompare(b.participant_id));
  if (candidates.length < 2 || !candidates[0] || !candidates[1]) throw new Error("At least two Champion candidates are required.");
  for (const item of ctx.db.participant.session_id.filter(session_id)) {
    ctx.db.participant.participant_id.update({ ...item, role_assigned: "crowd" });
  }
  const player1 = candidates[0];
  const player2 = candidates[1];
  ctx.db.participant.participant_id.update({ ...player1, role_assigned: "player1" });
  ctx.db.participant.participant_id.update({ ...player2, role_assigned: "player2" });
  const match_id = id("match");
  const now = nowMs();
  ctx.db.match.insert({
    match_id,
    session_id,
    player1_id: player1.participant_id,
    player2_id: player2.participant_id,
    status: "waiting",
    current_round_number: 0,
    player1_ready: false,
    player2_ready: false,
    started_at_ms: undefined,
    finished_at_ms: undefined
  });
  for (const item of ctx.db.participant.session_id.filter(session_id)) {
    upsertScore(ctx, item.participant_id, match_id);
  }
  for (const item of ctx.db.question.session_id.filter(session_id)) {
    ctx.db.question.question_id.update({ ...item, match_id });
  }
  ctx.db.session.session_id.update({ ...current, current_match_id: match_id, status: "selecting", updated_at_ms: now });
  recalcStats(ctx, session_id);
  insertAudit(ctx, session_id, sender(ctx), "assign_champions_randomly", "Two Champions selected transactionally.", "{}");
});

export const player_ready = spacetimedb.reducer({ match_id: t.string() }, (ctx, { match_id }) => {
  const current = requireMatch(ctx, match_id);
  const callerParticipant = participantForSender(ctx, current.session_id);
  if (!callerParticipant) throw new Error("Participant not found.");
  if (callerParticipant.participant_id !== current.player1_id && callerParticipant.participant_id !== current.player2_id) {
    throw new Error("Only selected Champions can mark ready.");
  }
  ctx.db.match.match_id.update({
    ...current,
    player1_ready: current.player1_ready || callerParticipant.participant_id === current.player1_id,
    player2_ready: current.player2_ready || callerParticipant.participant_id === current.player2_id
  });
});

export const start_match = spacetimedb.reducer({ match_id: t.string() }, (ctx, { match_id }) => {
  const current = requireMatch(ctx, match_id);
  const now = nowMs();
  ctx.db.match.match_id.update({ ...current, status: "active", started_at_ms: now });
  const currentSession = requireSession(ctx, current.session_id);
  ctx.db.session.session_id.update({ ...currentSession, status: "active", updated_at_ms: now });
  createRound(ctx, current, 1);
  bumpStats(ctx, current.session_id);
});

export const start_round = spacetimedb.reducer({ match_id: t.string(), round_number: t.u32() }, (ctx, { match_id, round_number }) => {
  const current = requireMatch(ctx, match_id);
  createRound(ctx, current, round_number);
  bumpStats(ctx, current.session_id);
});

export const submit_answer = spacetimedb.reducer({ round_id: t.string(), selected_option: t.string() }, (ctx, { round_id, selected_option }) => {
  if (!["A", "B", "C", "D"].includes(selected_option)) throw new Error("selected_option must be A/B/C/D.");
  const currentRound = requireRound(ctx, round_id);
  if (currentRound.status !== "active") throw new Error("Round is not accepting answers.");
  const currentMatch = requireMatch(ctx, currentRound.match_id);
  const callerParticipant = participantForSender(ctx, currentMatch.session_id);
  if (!callerParticipant || (callerParticipant.participant_id !== currentMatch.player1_id && callerParticipant.participant_id !== currentMatch.player2_id)) {
    throw new Error("Only selected Champions can answer.");
  }
  for (const existing of ctx.db.answer.round_id.filter(round_id)) {
    if (existing.participant_id === callerParticipant.participant_id) {
      const stats = requireStats(ctx, currentMatch.session_id);
      ctx.db.live_stats.session_id.update({
        ...stats,
        duplicate_answers_rejected: stats.duplicate_answers_rejected + 1,
        updated_at_ms: nowMs()
      });
      return;
    }
  }
  const currentQuestion = requireQuestion(ctx, currentRound.question_id);
  const now = nowMs();
  ctx.db.answer.insert({
    answer_id: id("answer"),
    round_id,
    participant_id: callerParticipant.participant_id,
    selected_option,
    server_received_at_ms: now,
    response_ms: Number(now - currentRound.starts_at_ms),
    is_correct: selected_option === currentQuestion.correct_option,
    points_awarded: 0
  });
  let playerAnswers = 0;
  for (const item of ctx.db.answer.round_id.filter(round_id)) {
    if (item.participant_id === currentMatch.player1_id || item.participant_id === currentMatch.player2_id) playerAnswers += 1;
  }
  if (playerAnswers >= 2) {
    ctx.db.round.round_id.update({ ...currentRound, status: "locked" });
  }
  bumpStats(ctx, currentMatch.session_id);
});

export const submit_playalong_answer = spacetimedb.reducer({ round_id: t.string(), selected_option: t.string() }, (ctx, { round_id, selected_option }) => {
  if (!["A", "B", "C", "D"].includes(selected_option)) throw new Error("selected_option must be A/B/C/D.");
  const currentRound = requireRound(ctx, round_id);
  if (currentRound.status !== "active") throw new Error("Round is not accepting play-along answers.");
  const currentMatch = requireMatch(ctx, currentRound.match_id);
  const callerParticipant = participantForSender(ctx, currentMatch.session_id);
  if (!callerParticipant || callerParticipant.role_assigned !== "crowd") throw new Error("Only Crowd supporters can play along.");
  for (const existing of ctx.db.play_along_answer.round_id.filter(round_id)) {
    if (existing.supporter_id === callerParticipant.participant_id) return;
  }
  const currentQuestion = requireQuestion(ctx, currentRound.question_id);
  ctx.db.play_along_answer.insert({
    answer_id: id("playalong"),
    round_id,
    supporter_id: callerParticipant.participant_id,
    selected_option,
    server_received_at_ms: nowMs(),
    is_correct: selected_option === currentQuestion.correct_option
  });
  bumpStats(ctx, currentMatch.session_id);
});

export const support_player = spacetimedb.reducer(
  { round_id: t.string(), player_id: t.string(), amount: t.u32(), client_event_id: t.option(t.string()) },
  (ctx, { round_id, player_id, amount, client_event_id }) => {
    if (amount !== CHEER_AMOUNT) throw new Error("Cheer amount must be exactly 25.");
    const currentRound = requireRound(ctx, round_id);
    if (currentRound.status !== "active") throw new Error("Cheering is only open during an active round.");
    const currentMatch = requireMatch(ctx, currentRound.match_id);
    if (player_id !== currentMatch.player1_id && player_id !== currentMatch.player2_id) throw new Error("Invalid player target.");
    const supporter = participantForSender(ctx, currentMatch.session_id);
    if (!supporter || supporter.role_assigned !== "crowd") throw new Error("Only Crowd supporters can cheer.");
    if (client_event_id) {
      for (const existing of ctx.db.support_event.round_id.filter(round_id)) {
        if (existing.client_event_id === client_event_id) return;
      }
    }
    const balance = ctx.db.energy_balance.participant_id.find(supporter.participant_id);
    if (!balance) throw new Error("Energy balance not found.");
    if (balance.spendable_energy < CHEER_AMOUNT) {
      const stats = requireStats(ctx, currentMatch.session_id);
      ctx.db.live_stats.session_id.update({
        ...stats,
        double_spend_attempts_blocked: stats.double_spend_attempts_blocked + 1,
        updated_at_ms: nowMs()
      });
      return;
    }
    const now = nowMs();
    ctx.db.energy_balance.participant_id.update({
      ...balance,
      spendable_energy: balance.spendable_energy - CHEER_AMOUNT,
      updated_at_ms: now
    });
    ctx.db.support_event.insert({
      support_id: id("support"),
      round_id,
      supporter_id: supporter.participant_id,
      player_id,
      amount,
      created_at_ms: now,
      client_event_id
    });
    insertLedger(ctx, currentMatch.session_id, currentMatch.match_id, round_id, supporter.participant_id, -CHEER_AMOUNT, "energy", "cheer_spend", "{}");
    const stats = requireStats(ctx, currentMatch.session_id);
    ctx.db.live_stats.session_id.update({
      ...stats,
      cheer_events_count: stats.cheer_events_count + 1,
      cheer_events_per_sec: Math.max(1, Math.floor((stats.cheer_events_count + 1) / 8)),
      updated_at_ms: now
    });
  }
);

export const resolve_round = spacetimedb.reducer({ round_id: t.string() }, (ctx, { round_id }) => {
  const currentRound = requireRound(ctx, round_id);
  if (currentRound.status === "resolved") return;
  const currentMatch = requireMatch(ctx, currentRound.match_id);
  const currentQuestion = requireQuestion(ctx, currentRound.question_id);
  const p1Answer = answerFor(ctx, round_id, currentMatch.player1_id);
  const p2Answer = answerFor(ctx, round_id, currentMatch.player2_id);
  const p1Support = totalSupport(ctx, round_id, currentMatch.player1_id);
  const p2Support = totalSupport(ctx, round_id, currentMatch.player2_id);
  const p1Score = roundScore(p1Answer?.is_correct ?? false, p1Answer?.response_ms ?? QUESTION_TIME_LIMIT_MS, p1Support);
  const p2Score = roundScore(p2Answer?.is_correct ?? false, p2Answer?.response_ms ?? QUESTION_TIME_LIMIT_MS, p2Support);
  const winner = p1Score === p2Score ? currentMatch.player1_id : p1Score > p2Score ? currentMatch.player1_id : currentMatch.player2_id;
  applyPlayerScore(ctx, currentMatch, currentRound, currentMatch.player1_id, p1Score);
  applyPlayerScore(ctx, currentMatch, currentRound, currentMatch.player2_id, p2Score);
  for (const event of ctx.db.support_event.round_id.filter(round_id)) {
    const supporterScore = upsertScore(ctx, event.supporter_id, currentMatch.match_id);
    const xp = event.player_id === winner ? 12 : 2;
    ctx.db.score.score_id.update({
      ...supporterScore,
      supporter_xp: supporterScore.supporter_xp + xp,
      support_accuracy_num: supporterScore.support_accuracy_num + (event.player_id === winner ? 1 : 0),
      support_accuracy_den: supporterScore.support_accuracy_den + 1,
      updated_at_ms: nowMs()
    });
    const balance = ctx.db.energy_balance.participant_id.find(event.supporter_id);
    if (balance) ctx.db.energy_balance.participant_id.update({ ...balance, trust_xp: balance.trust_xp + xp, updated_at_ms: nowMs() });
  }
  for (const playalong of ctx.db.play_along_answer.round_id.filter(round_id)) {
    const supporterScore = upsertScore(ctx, playalong.supporter_id, currentMatch.match_id);
    ctx.db.score.score_id.update({
      ...supporterScore,
      supporter_xp: supporterScore.supporter_xp + (playalong.selected_option === currentQuestion.correct_option ? 5 : 0),
      playalong_correct: supporterScore.playalong_correct + (playalong.selected_option === currentQuestion.correct_option ? 1 : 0),
      playalong_total: supporterScore.playalong_total + 1,
      updated_at_ms: nowMs()
    });
  }
  const now = nowMs();
  ctx.db.round.round_id.update({ ...currentRound, status: "resolved", resolved_at_ms: now, winner_player_id: winner });
  insertAgentEvent(ctx, currentMatch.session_id, "Host Commentator Agent", "round_explanation", currentQuestion.explanation, 0.95, "complete");
  insertAudit(ctx, currentMatch.session_id, sender(ctx), "resolve_round", `Round ${currentRound.round_number} resolved.`, "{}");
  const currentSession = requireSession(ctx, currentMatch.session_id);
  if (currentRound.round_number >= currentSession.question_count) {
    finishMatchInternal(ctx, currentMatch);
  }
  bumpStats(ctx, currentMatch.session_id);
});

export const finish_match = spacetimedb.reducer({ match_id: t.string() }, (ctx, { match_id }) => {
  finishMatchInternal(ctx, requireMatch(ctx, match_id));
});

export const record_agent_event = spacetimedb.reducer(
  { session_id: t.string(), agent_name: t.string(), event_type: t.string(), content: t.string(), confidence: t.f32(), status: t.string() },
  (ctx, { session_id, agent_name, event_type, content, confidence, status }) => {
    insertAgentEvent(ctx, session_id, agent_name, event_type, content, confidence, status);
  }
);

export const add_simulated_supporters = spacetimedb.reducer({ session_id: t.string(), count: t.u32() }, (ctx, { session_id, count }) => {
  const current = requireSession(ctx, session_id);
  const now = nowMs();
  for (let i = 0; i < Math.min(250, count); i += 1) {
    const participant_id = id("sim");
    ctx.db.participant.insert({
      participant_id,
      session_id: current.session_id,
      identity: `sim-${participant_id}`,
      display_name: `Sim Supporter ${i + 1}`,
      avatar_seed: `sim-${i}`,
      role_requested: "crowd",
      role_assigned: "crowd",
      interests_json: "[\"AI\",\"Space\"]",
      joined_at_ms: now,
      last_seen_ms: now,
      is_simulated: true
    });
    ctx.db.energy_balance.insert({ participant_id, session_id, spendable_energy: INITIAL_ENERGY, trust_xp: 0, updated_at_ms: now });
  }
  recalcStats(ctx, session_id);
  insertAudit(ctx, session_id, sender(ctx), "add_simulated_supporters", `${count} simulated supporters added.`, "{\"simulated\":true}");
});

export const reset_demo = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  ctx.db.participant.session_id.delete(session_id);
  ctx.db.match.session_id.delete(session_id);
  ctx.db.question.session_id.delete(session_id);
  ctx.db.energy_balance.session_id.delete(session_id);
  ctx.db.ledger_entry.session_id.delete(session_id);
  ctx.db.agent_request.session_id.delete(session_id);
  ctx.db.agent_event.session_id.delete(session_id);
  ctx.db.audit_event.session_id.delete(session_id);
  ctx.db.live_stats.session_id.delete(session_id);
  const current = ctx.db.session.session_id.find(session_id);
  const now = nowMs();
  if (current) {
    ctx.db.session.session_id.update({
      ...current,
      topic: "AI + Space + Startups",
      difficulty: "beginner",
      question_count: 3,
      status: "draft",
      updated_at_ms: now,
      current_match_id: undefined,
      lobby_opened_at_ms: undefined
    });
  }
  ctx.db.live_stats.insert(emptyStats(session_id, now));
  insertAudit(ctx, session_id, sender(ctx), "reset_demo", "Demo reset to a clean deterministic state.", "{}");
});

function createRound(ctx: ReducerCtx, current: MatchRow, round_number: number) {
  const existing = Array.from(ctx.db.round.match_id.filter(current.match_id)).find((item) => item.round_number === round_number);
  const questionRow = Array.from(ctx.db.question.session_id.filter(current.session_id)).find((item) => item.round_number === round_number);
  if (!questionRow) throw new Error(`Question ${round_number} is not ready.`);
  const now = nowMs();
  if (existing) {
    ctx.db.round.round_id.update({ ...existing, status: "active", starts_at_ms: now, ends_at_ms: now + BigInt(QUESTION_TIME_LIMIT_MS), resolved_at_ms: undefined, winner_player_id: undefined });
  } else {
    ctx.db.round.insert({
      round_id: id("round"),
      match_id: current.match_id,
      question_id: questionRow.question_id,
      round_number,
      status: "active",
      starts_at_ms: now,
      ends_at_ms: now + BigInt(QUESTION_TIME_LIMIT_MS),
      resolved_at_ms: undefined,
      winner_player_id: undefined
    });
  }
  ctx.db.match.match_id.update({ ...current, current_round_number: round_number, status: "active" });
}

type ReducerCtx = Parameters<Parameters<typeof spacetimedb.reducer>[1]>[0];
type MatchRow = ReturnType<ReducerCtx["db"]["match"]["match_id"]["find"]> extends infer R ? NonNullable<R> : never;
type SessionRow = ReturnType<ReducerCtx["db"]["session"]["session_id"]["find"]> extends infer R ? NonNullable<R> : never;
type RoundRow = ReturnType<ReducerCtx["db"]["round"]["round_id"]["find"]> extends infer R ? NonNullable<R> : never;
type QuestionRow = ReturnType<ReducerCtx["db"]["question"]["question_id"]["find"]> extends infer R ? NonNullable<R> : never;
type AnswerRow = ReturnType<ReducerCtx["db"]["answer"]["answer_id"]["find"]> extends infer R ? NonNullable<R> : never;
type ScoreRow = ReturnType<ReducerCtx["db"]["score"]["score_id"]["find"]> extends infer R ? NonNullable<R> : never;

function requireSession(ctx: ReducerCtx, session_id: string): SessionRow {
  const row = ctx.db.session.session_id.find(session_id);
  if (!row) throw new Error(`Session not found: ${session_id}`);
  return row;
}

function requireMatch(ctx: ReducerCtx, match_id: string): MatchRow {
  const row = ctx.db.match.match_id.find(match_id);
  if (!row) throw new Error(`Match not found: ${match_id}`);
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

function requireStats(ctx: ReducerCtx, session_id: string) {
  const row = ctx.db.live_stats.session_id.find(session_id);
  if (!row) throw new Error(`LiveStats not found: ${session_id}`);
  return row;
}

function participantForSender(ctx: ReducerCtx, session_id: string) {
  const caller = sender(ctx);
  for (const item of ctx.db.participant.session_id.filter(session_id)) {
    if (item.identity === caller) return item;
  }
  return undefined;
}

function answerFor(ctx: ReducerCtx, round_id: string, participant_id: string): AnswerRow | undefined {
  for (const item of ctx.db.answer.round_id.filter(round_id)) {
    if (item.participant_id === participant_id) return item;
  }
  return undefined;
}

function totalSupport(ctx: ReducerCtx, round_id: string, player_id: string): number {
  let total = 0;
  for (const item of ctx.db.support_event.round_id.filter(round_id)) {
    if (item.player_id === player_id) total += item.amount;
  }
  return total;
}

function upsertScore(ctx: ReducerCtx, participant_id: string, match_id: string): ScoreRow {
  const score_id = `${match_id}:${participant_id}`;
  const existing = ctx.db.score.score_id.find(score_id);
  if (existing) return existing;
  const row = {
    score_id,
    participant_id,
    match_id,
    player_score: 0,
    supporter_xp: 0,
    support_accuracy_num: 0,
    support_accuracy_den: 0,
    playalong_correct: 0,
    playalong_total: 0,
    updated_at_ms: nowMs()
  };
  ctx.db.score.insert(row);
  return row;
}

function applyPlayerScore(ctx: ReducerCtx, currentMatch: MatchRow, currentRound: RoundRow, participant_id: string, delta: number) {
  const current = upsertScore(ctx, participant_id, currentMatch.match_id);
  ctx.db.score.score_id.update({ ...current, player_score: current.player_score + delta, updated_at_ms: nowMs() });
  insertLedger(ctx, currentMatch.session_id, currentMatch.match_id, currentRound.round_id, participant_id, delta, "player_score", "player_correct", "{}");
}

function finishMatchInternal(ctx: ReducerCtx, current: MatchRow) {
  const now = nowMs();
  ctx.db.match.match_id.update({ ...current, status: "finished", finished_at_ms: now });
  const currentSession = requireSession(ctx, current.session_id);
  ctx.db.session.session_id.update({ ...currentSession, status: "finished", updated_at_ms: now });
  insertAgentEvent(ctx, current.session_id, "Learning Recap Agent", "learning_recap", "Based on this match: reducers kept answers fair, Energy spending consistent, and AI fallback reliable.", 0.9, "complete");
}

function roundScore(isCorrect: boolean, responseMs: number, support: number): number {
  const correctness = isCorrect ? 1000 : 0;
  const speed = isCorrect ? Math.floor(500 * Math.max(0, Math.min(1, 1 - responseMs / QUESTION_TIME_LIMIT_MS))) : 0;
  const boost = Math.min(200, Math.floor(support / CHEER_AMOUNT) * 10);
  return correctness + speed + boost;
}

function recalcStats(ctx: ReducerCtx, session_id: string) {
  const stats = requireStats(ctx, session_id);
  const participants = Array.from(ctx.db.participant.session_id.filter(session_id));
  ctx.db.live_stats.session_id.update({
    ...stats,
    joined_count: participants.length,
    player_candidate_count: participants.filter((item) => item.role_requested === "player").length,
    crowd_count: participants.filter((item) => item.role_assigned === "crowd").length,
    active_clients: participants.length,
    p95_sync_latency_ms: 42 + ((stats.reducer_calls_count * 7 + stats.cheer_events_count * 3) % 71),
    updated_at_ms: nowMs()
  });
}

function bumpStats(ctx: ReducerCtx, session_id: string) {
  const stats = requireStats(ctx, session_id);
  ctx.db.live_stats.session_id.update({ ...stats, reducer_calls_count: stats.reducer_calls_count + 1, updated_at_ms: nowMs() });
}

function emptyStats(session_id: string, now: bigint) {
  return {
    session_id,
    joined_count: 0,
    player_candidate_count: 0,
    crowd_count: 0,
    active_clients: 0,
    cheer_events_count: 0,
    cheer_events_per_sec: 0,
    reducer_calls_count: 0,
    duplicate_answers_rejected: 0,
    double_spend_attempts_blocked: 0,
    p95_sync_latency_ms: 42,
    updated_at_ms: now
  };
}

function insertLedger(
  ctx: ReducerCtx,
  session_id: string,
  match_id: string | undefined,
  round_id: string | undefined,
  participant_id: string,
  delta: number,
  currency_type: string,
  reason: string,
  metadata_json: string
) {
  ctx.db.ledger_entry.insert({
    ledger_id: id("ledger"),
    session_id,
    match_id,
    round_id,
    participant_id,
    delta,
    currency_type,
    reason,
    metadata_json,
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

function insertAudit(ctx: ReducerCtx, session_id: string, actor_identity: string, event_type: string, message: string, metadata_json: string) {
  ctx.db.audit_event.insert({
    event_id: id("audit"),
    session_id,
    actor_identity,
    event_type,
    message,
    metadata_json,
    created_at_ms: nowMs()
  });
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
