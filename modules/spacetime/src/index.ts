import { schema, table, t } from "spacetimedb/server";

const QUESTION_COUNT = 10;
const TOTAL_MATCH_MS = 25_000;
const QUESTION_TIME_LIMIT_MS = Math.floor(TOTAL_MATCH_MS / QUESTION_COUNT);
const ROUND_LEAD_TIME_MS = 1_000;
const ANSWER_GRACE_MS = 150;
const EARLY_ANSWER_TOLERANCE_MS = ROUND_LEAD_TIME_MS + 100;
const PLAYER_STALE_TIMEOUT_MS = 12_000;
const CORRECTNESS_POINTS = 1000;
const MAX_SPEED_BONUS = 1000;
const STREAK_BONUS = 100;
const MAX_PLAYERS_SOFT = 10;
const MAX_PLAYERS_HARD = 12;
const EAGER_SHARECARD_LIMIT = 500;
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
    max_racers: t.u32().default(MAX_PLAYERS_HARD),
    admitted_count: t.u32().default(0),
    capacity_status: t.string().default("open"),
    capacity_reason: t.option(t.string()).default(undefined),
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
    admission_status: t.string().default("admitted"),
    champion_status: t.string().default("active"),
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

const player_intent = table(
  { name: "player_intent", public: true },
  {
    intent_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    raw_text: t.string(),
    transcript_source: t.string(),
    cleaned_text: t.string(),
    canonical_topics_json: t.string(),
    topic_key: t.string(),
    arena_name: t.string(),
    difficulty_hint: t.string(),
    confidence: t.f32(),
    status: t.string(),
    created_at_ms: t.u64(),
    updated_at_ms: t.u64()
  }
);

const question_pack = table(
  { name: "question_pack", public: true },
  {
    pack_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    participant_id: t.option(t.string()).default(undefined),
    topic_key: t.string(),
    display_topic: t.string(),
    source_type: t.string(),
    quality_score: t.u32(),
    status: t.string(),
    created_at_ms: t.u64()
  }
);

const question_public = table(
  { name: "question_public", public: true },
  {
    question_id: t.string().primaryKey(),
    pack_id: t.option(t.string()).default(undefined),
    session_id: t.string().index("btree"),
    participant_id: t.option(t.string()).default(undefined),
    topic_key: t.string().default("general_knowledge::intermediate"),
    order_index: t.u32(),
    question_text: t.string(),
    option_a: t.string(),
    option_b: t.string(),
    option_c: t.string(),
    option_d: t.string(),
    display_topic: t.string().default("General Knowledge"),
    topic: t.string(),
    generated_by: t.string(),
    fairness_status: t.string(),
    created_at_ms: t.u64(),
    source_title: t.string().default(""),
    source_url: t.string().default("")
  }
);

const question_secret = table(
  { name: "question_secret", public: false },
  {
    question_id: t.string().primaryKey(),
    pack_id: t.option(t.string()).default(undefined),
    session_id: t.string().index("btree"),
    participant_id: t.option(t.string()).default(undefined),
    correct_option: t.string(),
    explanation: t.string(),
    fact_ids_json: t.string().default("[]"),
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
    question_id: t.string().default(""),
    participant_id: t.string().index("btree"),
    selected_option: t.string(),
    is_correct: t.bool(),
    response_ms: t.u32(),
    response_ms_server: t.u32().default(0),
    official_response_ms: t.u32().default(0),
    observed_response_ms: t.option(t.u32()).default(undefined),
    client_question_rendered_at_ms: t.option(t.u64()).default(undefined),
    client_clicked_at_ms: t.option(t.u64()).default(undefined),
    client_sent_at_ms: t.option(t.u64()).default(undefined),
    client_event_id: t.string().default(""),
    correctness_points: t.u32().default(0),
    speed_bonus: t.u32().default(0),
    streak_bonus: t.u32().default(0),
    score_delta: t.u32(),
    server_received_at_ms: t.u64(),
    server_committed_at_ms: t.u64().default(BigInt(0)),
    participant_latency_ms_snapshot: t.option(t.u32()).default(undefined),
    timing_suspicious: t.bool().default(false),
    created_at_ms: t.u64().default(BigInt(0))
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
    wrong_count: t.u32().default(0),
    answered_count: t.u32().default(0),
    total_answer_response_ms: t.u32().default(0),
    total_correct_response_ms: t.u32().default(0),
    total_response_ms: t.u32(),
    total_official_response_ms: t.u32().default(0),
    total_observed_response_ms: t.option(t.u32()).default(undefined),
    fastest_response_ms: t.option(t.u32()),
    fastest_official_response_ms: t.option(t.u32()).default(undefined),
    fastest_observed_response_ms: t.option(t.u32()).default(undefined),
    average_response_ms: t.option(t.u32()).default(undefined),
    average_official_response_ms: t.option(t.u32()).default(undefined),
    normalized_score: t.f32().default(0),
    streak_count: t.u32().default(0),
    last_answer_correct: t.option(t.bool()).default(undefined),
    champion_status: t.string().default("active"),
    current_rank: t.u32(),
    previous_rank: t.u32(),
    last_answer_at_ms: t.option(t.u64()),
    updated_at_ms: t.u64()
  }
);

const final_result = table(
  { name: "final_result", public: true },
  {
    final_result_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    final_rank: t.u32(),
    total_participants: t.u32(),
    champion_status: t.string(),
    total_score: t.u32(),
    correct_count: t.u32(),
    question_count: t.u32(),
    answered_count: t.u32().default(0),
    total_answer_response_ms: t.u32().default(0),
    total_correct_response_ms: t.u32().default(0),
    total_response_ms: t.u32(),
    total_official_response_ms: t.u32().default(0),
    fastest_response_ms: t.option(t.u32()),
    fastest_official_response_ms: t.option(t.u32()).default(undefined),
    average_official_response_ms: t.option(t.u32()).default(undefined),
    normalized_score: t.f32().default(0),
    percentile: t.u32(),
    created_at_ms: t.u64()
  }
);

const share_card = table(
  { name: "share_card", public: true },
  {
    share_id: t.string().primaryKey(),
    slug: t.string().unique(),
    session_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    display_name: t.string(),
    avatar: t.string(),
    avatar_type: t.string().default("emoji"),
    avatar_emoji: t.option(t.string()).default(undefined),
    avatar_color: t.option(t.string()).default(undefined),
    avatar_url: t.option(t.string()).default(undefined),
    display_topic: t.string().default("QuizRush Arena"),
    final_rank: t.u32(),
    total_participants: t.u32(),
    champion_status: t.string(),
    total_score: t.u32(),
    correct_count: t.u32(),
    question_count: t.u32(),
    answered_count: t.u32().default(0),
    total_answer_response_ms: t.u32().default(0),
    total_correct_response_ms: t.u32().default(0),
    total_response_ms_official: t.u32().default(0),
    total_response_ms_observed: t.option(t.u32()).default(undefined),
    fastest_response_ms: t.option(t.u32()),
    fastest_response_ms_official: t.option(t.u32()).default(undefined),
    fastest_response_ms_observed: t.option(t.u32()).default(undefined),
    percentile: t.u32().default(100),
    share_text: t.string().default(""),
    created_at_ms: t.u64(),
    expires_at_ms: t.option(t.u64()).default(undefined),
    view_count: t.u32()
  }
);

const session_capacity = table(
  { name: "session_capacity", public: true },
  {
    session_id: t.string().primaryKey(),
    max_racers_soft: t.u32(),
    max_racers_hard: t.u32(),
    admitted_count: t.u32(),
    waitlisted_count: t.u32(),
    spectator_count: t.u32(),
    status: t.string(),
    reason: t.option(t.string()),
    updated_at_ms: t.u64()
  }
);

const admission_ticket = table(
  { name: "admission_ticket", public: true },
  {
    ticket_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    status: t.string(),
    queue_position: t.option(t.u32()),
    issued_at_ms: t.u64()
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
    p95_answer_commit_ms: t.u32().default(48),
    p95_subscription_render_ms: t.u32().default(120),
    active_clients: t.u32(),
    admitted_racers: t.u32().default(0),
    waitlisted_users: t.u32().default(0),
    capacity_status: t.string().default("open"),
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

const operation_trace = table(
  { name: "operation_trace", public: true },
  {
    trace_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    reducer: t.string(),
    identity: t.string(),
    ok: t.bool(),
    duration_ms: t.u32(),
    state_version: t.u32(),
    error_message: t.option(t.string()),
    created_at_ms: t.u64()
  }
);

const client_error = table(
  { name: "client_error", public: true },
  {
    error_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    participant_id: t.string().index("btree"),
    screen: t.string(),
    error_code: t.string(),
    message: t.string(),
    stack_hash: t.option(t.string()).default(undefined),
    metadata_json: t.string(),
    user_agent: t.string(),
    created_at_ms: t.u64()
  }
);

const topic_fact = table(
  { name: "topic_fact", public: true },
  {
    fact_id: t.string().primaryKey(),
    session_id: t.string().index("btree"),
    topic_key: t.string().index("btree"),
    display_name: t.string(),
    source_title: t.string(),
    source_url: t.string(),
    source_type: t.string(),
    fact_text: t.string(),
    confidence: t.f32(),
    created_at_ms: t.u64()
  }
);

const spacetimedb = schema({
  session,
  participant,
  topic_vote,
  player_intent,
  question_pack,
  question_public,
  question_secret,
  round,
  answer,
  score,
  final_result,
  share_card,
  session_capacity,
  admission_ticket,
  match_event,
  agent_request,
  agent_event,
  live_stats,
  audit_event,
  operation_trace,
  client_error,
  topic_fact
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
  traceOperation(ctx, "session-demo", "create_session", true, 1, undefined);
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
      recalcStats(ctx, current.session_id);
      return;
    }
  }

  const now = nowMs();
  const capacity = updateCapacity(ctx, current.session_id, now);
  const admission_status = capacity.admitted_count < capacity.max_racers_hard ? "admitted" : "waitlisted";
  const champion_status = admission_status === "admitted" ? "active" : "spectator";
  const participant_id = id(ctx, "participant");
  ctx.db.participant.insert({
    participant_id,
    session_id: current.session_id,
    identity: caller,
    display_name: cleanName(display_name),
    avatar: avatar || "🚀",
    admission_status,
    champion_status,
    joined_at_ms: now,
    last_seen_ms: now,
    is_simulated: false,
    client_latency_ms: undefined
  });
  ctx.db.score.insert(emptyScore(current.session_id, participant_id, now, champion_status));
  issueAdmissionTicket(ctx, current.session_id, participant_id, admission_status, now);
  ctx.db.session.session_id.update({ ...current, status: current.status === "lobby" ? "topic_voting" : current.status, updated_at_ms: now });
  insertMatchEvent(ctx, current.session_id, participant_id, admission_status === "admitted" ? "join" : "waitlisted", undefined, undefined, undefined, JSON.stringify({ displayName: cleanName(display_name), admission_status }));
  recalcStats(ctx, current.session_id);
  traceOperation(ctx, current.session_id, "join_session", true, 1, undefined);
});

export const submit_topic_vote = spacetimedb.reducer({ session_id: t.string(), topics_json: t.string() }, (ctx, { session_id, topics_json }) => {
  const participantRow = requireParticipantForSender(ctx, session_id);
  ctx.db.topic_vote.participant_id.delete(participantRow.participant_id);
  const topics = parseTopics(topics_json);
  const now = nowMs();
  for (const topic of topics) {
    ctx.db.topic_vote.insert({
      vote_id: id(ctx, "topic-vote"),
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
  traceOperation(ctx, session_id, "submit_topic_vote", true, 1, undefined);
});

export const submit_player_intent = spacetimedb.reducer(
  { session_id: t.string(), raw_text: t.string(), transcript_source: t.string() },
  (ctx, { session_id, raw_text, transcript_source }) => {
    const participantRow = requireParticipantForSender(ctx, session_id);
    const parsed = normalizeIntentForModule(raw_text);
    const now = nowMs();
    ctx.db.player_intent.participant_id.delete(participantRow.participant_id);
    ctx.db.player_intent.insert({
      intent_id: id(ctx, "player-intent"),
      session_id,
      participant_id: participantRow.participant_id,
      raw_text: raw_text.trim().slice(0, 300),
      transcript_source: transcript_source || "typed",
      cleaned_text: parsed.cleaned_text,
      canonical_topics_json: JSON.stringify(parsed.canonical_topics),
      topic_key: parsed.topic_key,
      arena_name: parsed.arena_name,
      difficulty_hint: parsed.difficulty_hint,
      confidence: parsed.confidence,
      status: "parsed",
      created_at_ms: now,
      updated_at_ms: now
    });
    const current = requireSession(ctx, session_id);
    ctx.db.session.session_id.update({
      ...current,
      status: current.status === "lobby" ? "topic_voting" : current.status,
      selected_topic: parsed.arena_name,
      updated_at_ms: now
    });
    insertMatchEvent(ctx, session_id, participantRow.participant_id, "intent_submitted", undefined, undefined, undefined, JSON.stringify({ transcript_source }));
    insertMatchEvent(ctx, session_id, participantRow.participant_id, "intent_parsed", undefined, undefined, undefined, JSON.stringify({ arena_name: parsed.arena_name, topics: parsed.canonical_topics, topic_key: parsed.topic_key }));
    bumpStats(ctx, session_id);
    traceOperation(ctx, session_id, "submit_player_intent", true, 1, undefined);
  }
);

export const submit_parsed_intent = spacetimedb.reducer({ intent_id: t.string(), parsed_json: t.string() }, (ctx, { intent_id, parsed_json }) => {
  const existing = ctx.db.player_intent.intent_id.find(intent_id);
  if (!existing) throw new Error(`PlayerIntent not found: ${intent_id}`);
  const parsed = normalizeIntentForModule(parsed_json);
  const now = nowMs();
  ctx.db.player_intent.intent_id.update({
    ...existing,
    cleaned_text: parsed.cleaned_text,
    canonical_topics_json: JSON.stringify(parsed.canonical_topics),
    topic_key: parsed.topic_key,
    arena_name: parsed.arena_name,
    difficulty_hint: parsed.difficulty_hint,
    confidence: parsed.confidence,
    status: "parsed",
    updated_at_ms: now
  });
  const current = requireSession(ctx, existing.session_id);
  ctx.db.session.session_id.update({ ...current, selected_topic: parsed.arena_name, updated_at_ms: now });
  insertMatchEvent(ctx, existing.session_id, existing.participant_id, "intent_parsed", undefined, undefined, undefined, JSON.stringify({ arena_name: parsed.arena_name, topics: parsed.canonical_topics, topic_key: parsed.topic_key }));
  bumpStats(ctx, existing.session_id);
  traceOperation(ctx, existing.session_id, "submit_parsed_intent", true, 1, undefined);
});

export const request_questions = spacetimedb.reducer({ session_id: t.string(), topic: t.string(), question_count: t.u32() }, (ctx, { session_id, topic, question_count }) => {
  const current = requireSession(ctx, session_id);
  const now = nowMs();
  const selected_topic = normalizeIntentForModule(topic || topicFromVotes(ctx, session_id)).arena_name;
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
    ctx.db.question_pack.session_id.delete(session_id);
    ctx.db.question_public.session_id.delete(session_id);
    ctx.db.question_secret.session_id.delete(session_id);
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
    request_id: id(ctx, "agent-request"),
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
  traceOperation(ctx, session_id, "request_questions", true, 1, undefined);
});

export const submit_question_pack = spacetimedb.reducer(
  { session_id: t.string(), selected_topic: t.string(), questions_json: t.string(), request_id: t.option(t.string()) },
  (ctx, input) => submitQuestionPackInternal(ctx, input.session_id, input.selected_topic, input.questions_json, input.request_id)
);

export const submit_question_batch = spacetimedb.reducer(
  { session_id: t.string(), selected_topic: t.string(), questions_json: t.string(), request_id: t.option(t.string()) },
  (ctx, input) => submitQuestionPackInternal(ctx, input.session_id, input.selected_topic, input.questions_json, input.request_id)
);

export const submit_topic_facts = spacetimedb.reducer(
  { session_id: t.string(), topic_key: t.string(), facts_json: t.string() },
  (ctx, { session_id, topic_key, facts_json }) => {
    requireSession(ctx, session_id);
    const parsed = JSON.parse(facts_json) as {
      facts?: Array<{
        factId?: string;
        fact_id?: string;
        topicKey?: string;
        topic_key?: string;
        displayName?: string;
        display_name?: string;
        sourceTitle?: string;
        source_title?: string;
        sourceUrl?: string;
        source_url?: string;
        sourceType?: string;
        source_type?: string;
        factText?: string;
        fact_text?: string;
        confidence?: number;
      }>;
    };
    if (!Array.isArray(parsed.facts)) throw new Error("facts_json must include facts array.");
    const now = nowMs();
    for (const item of parsed.facts.slice(0, 12)) {
      const fact_text = cleanText(item.factText ?? item.fact_text ?? "", 360);
      if (fact_text.length < 12) continue;
      const fact_id = cleanText(item.factId ?? item.fact_id ?? `${topic_key}-fact-${ctx.random.integerInRange(0, 1_000_000)}`, 80);
      const existing = ctx.db.topic_fact.fact_id.find(fact_id);
      const row = {
        fact_id,
        session_id,
        topic_key: cleanText(item.topicKey ?? item.topic_key ?? topic_key, 96),
        display_name: cleanText(item.displayName ?? item.display_name ?? topic_key, 120),
        source_title: cleanText(item.sourceTitle ?? item.source_title ?? "Firecrawl result", 160),
        source_url: cleanText(item.sourceUrl ?? item.source_url ?? "https://firecrawl.dev", 260),
        source_type: cleanText(item.sourceType ?? item.source_type ?? "firecrawl", 32),
        fact_text,
        confidence: clamp01(item.confidence ?? 0.78),
        created_at_ms: now
      };
      if (existing) ctx.db.topic_fact.fact_id.update(row);
      else ctx.db.topic_fact.insert(row);
    }
    insertAgentEvent(ctx, session_id, "Firecrawl Grounding Agent", "facts_committed", `Compact facts stored for ${topic_key}.`, 0.86, "complete");
    bumpStats(ctx, session_id);
    traceOperation(ctx, session_id, "submit_topic_facts", true, 1, undefined);
  }
);

export const start_match = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  const current = requireSession(ctx, session_id);
  if (Array.from(ctx.db.participant.session_id.filter(session_id)).filter((participant) => participant.admission_status === "admitted").length === 0) {
    throw new Error("At least one participant must join before the match starts.");
  }
  if (Array.from(ctx.db.question_public.session_id.filter(session_id)).length < current.question_count) {
    throw new Error("Question pack is not ready.");
  }
  ctx.db.round.session_id.delete(session_id);
  ctx.db.answer.session_id.delete(session_id);
  ctx.db.final_result.session_id.delete(session_id);
  const now = nowMs();
  const raceStartsAt = now + BigInt(ROUND_LEAD_TIME_MS);
  for (const participant of ctx.db.participant.session_id.filter(session_id)) {
    ctx.db.participant.participant_id.update({
      ...participant,
      champion_status: participant.admission_status === "admitted" ? "active" : "spectator"
    });
  }
  for (const item of ctx.db.score.session_id.filter(session_id)) {
    const participantRow = ctx.db.participant.participant_id.find(item.participant_id);
    ctx.db.score.score_id.update({
      ...item,
      total_score: 0,
      correct_count: 0,
      wrong_count: 0,
      answered_count: 0,
      total_answer_response_ms: 0,
      total_correct_response_ms: 0,
      total_response_ms: 0,
      total_official_response_ms: 0,
      total_observed_response_ms: undefined,
      fastest_response_ms: undefined,
      fastest_official_response_ms: undefined,
      fastest_observed_response_ms: undefined,
      average_response_ms: undefined,
      average_official_response_ms: undefined,
      normalized_score: 0,
      streak_count: 0,
      last_answer_correct: undefined,
      champion_status: participantRow?.admission_status === "admitted" ? "active" : "spectator",
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
    match_started_at_ms: raceStartsAt,
    match_finished_at_ms: undefined,
    updated_at_ms: now
  });
  recomputeRanks(ctx, session_id);
  startRoundInternal(ctx, session_id, 1);
  bumpStats(ctx, session_id);
  traceOperation(ctx, session_id, "start_match", true, 1, undefined);
});

export const start_round = spacetimedb.reducer({ session_id: t.string(), question_order: t.u32() }, (ctx, { session_id, question_order }) => {
  startRoundInternal(ctx, session_id, question_order);
  bumpStats(ctx, session_id);
  traceOperation(ctx, session_id, "start_round", true, 1, undefined);
});

export const submit_answer = spacetimedb.reducer(
  {
    round_id: t.string(),
    selected_option: t.string(),
    client_event_id: t.option(t.string()),
    client_sent_at_ms: t.option(t.u64()),
    client_question_rendered_at_ms: t.option(t.u64()),
    client_clicked_at_ms: t.option(t.u64())
  },
  (ctx, { round_id, selected_option, client_event_id, client_sent_at_ms, client_question_rendered_at_ms, client_clicked_at_ms }) => {
  if (!["A", "B", "C", "D"].includes(selected_option)) throw new Error("selected_option must be A/B/C/D.");
  const currentRound = requireRound(ctx, round_id);
  if (currentRound.status !== "active") throw new Error("Round is not active.");
  const participantRow = requireParticipantForSender(ctx, currentRound.session_id);
  if (participantRow.admission_status !== "admitted") throw new Error("Only admitted racers can submit answers.");
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
  if (client_event_id) {
    for (const existing of ctx.db.answer.participant_id.filter(participantRow.participant_id)) {
      if (existing.client_event_id === client_event_id) throw new Error("Duplicate answer event rejected.");
    }
  }
  const currentSecret = requireQuestionSecret(ctx, currentRound.question_id);
  const now = nowMs();
  if (now + BigInt(EARLY_ANSWER_TOLERANCE_MS) < currentRound.starts_at_ms) throw new Error("Round has not started.");
  if (now > currentRound.ends_at_ms + BigInt(ANSWER_GRACE_MS)) throw new Error("Round has ended.");
  if (participantRow.champion_status === "eliminated") throw new Error("Participant is no longer on the active champion path.");
  ctx.db.participant.participant_id.update({
    ...participantRow,
    last_seen_ms: now,
    client_latency_ms: client_sent_at_ms !== undefined ? Math.min(Number(now > client_sent_at_ms ? now - client_sent_at_ms : BigInt(0)), 60_000) : participantRow.client_latency_ms
  });
  const response_ms = Math.max(0, Math.min(Number(now - currentRound.starts_at_ms), QUESTION_TIME_LIMIT_MS));
  const observed_response_ms =
    client_question_rendered_at_ms !== undefined && client_clicked_at_ms !== undefined && client_clicked_at_ms >= client_question_rendered_at_ms
      ? Math.min(Number(client_clicked_at_ms - client_question_rendered_at_ms), 60_000)
      : undefined;
  const timing_suspicious =
    observed_response_ms !== undefined &&
    (observed_response_ms < 80 || Math.abs(observed_response_ms - response_ms) > Math.max(600, Math.floor(response_ms * 0.75)));
  const is_correct = selected_option === currentSecret.correct_option;
  const currentScore = requireScore(ctx, currentRound.session_id, participantRow.participant_id);
  const scoreParts = computeAnswerScoreParts(is_correct, response_ms, currentScore.last_answer_correct === true);
  ctx.db.answer.insert({
    answer_id: id(ctx, "answer"),
    session_id: currentRound.session_id,
    round_id,
    question_id: currentRound.question_id,
    participant_id: participantRow.participant_id,
    selected_option,
    is_correct,
    response_ms,
    response_ms_server: response_ms,
    official_response_ms: response_ms,
    observed_response_ms,
    client_question_rendered_at_ms,
    client_clicked_at_ms,
    client_sent_at_ms,
    client_event_id: client_event_id ?? "",
    correctness_points: scoreParts.correctness_points,
    speed_bonus: scoreParts.speed_bonus,
    streak_bonus: scoreParts.streak_bonus,
    score_delta: scoreParts.score_delta,
    server_received_at_ms: now,
    server_committed_at_ms: now,
    participant_latency_ms_snapshot: participantRow.client_latency_ms,
    timing_suspicious,
    created_at_ms: now
  });
  const nextCorrect = currentScore.correct_count + (is_correct ? 1 : 0);
  const nextAnswered = currentScore.answered_count + 1;
  const nextAnswerResponseTotal = currentScore.total_answer_response_ms + response_ms;
  const nextCorrectResponseTotal = currentScore.total_correct_response_ms + (is_correct ? response_ms : 0);
  const nextObservedTotal =
    observed_response_ms !== undefined
      ? (currentScore.total_observed_response_ms ?? 0) + observed_response_ms
      : currentScore.total_observed_response_ms;
  const nextFastest = is_correct ? (currentScore.fastest_response_ms === undefined ? response_ms : Math.min(currentScore.fastest_response_ms, response_ms)) : currentScore.fastest_response_ms;
  const nextFastestObserved =
    is_correct && observed_response_ms !== undefined
      ? currentScore.fastest_observed_response_ms === undefined
        ? observed_response_ms
        : Math.min(currentScore.fastest_observed_response_ms, observed_response_ms)
      : currentScore.fastest_observed_response_ms;
  const nextStreak = is_correct ? currentScore.streak_count + 1 : 0;
  ctx.db.score.score_id.update({
    ...currentScore,
    total_score: currentScore.total_score + scoreParts.score_delta,
    correct_count: nextCorrect,
    wrong_count: currentScore.wrong_count + (is_correct ? 0 : 1),
    answered_count: nextAnswered,
    total_answer_response_ms: nextAnswerResponseTotal,
    total_correct_response_ms: nextCorrectResponseTotal,
    total_response_ms: nextAnswerResponseTotal,
    total_official_response_ms: nextAnswerResponseTotal,
    total_observed_response_ms: nextObservedTotal,
    fastest_response_ms: nextFastest,
    fastest_official_response_ms: nextFastest,
    fastest_observed_response_ms: nextFastestObserved,
    average_response_ms: Math.round(nextCorrectResponseTotal / Math.max(1, nextCorrect)),
    average_official_response_ms: Math.round(nextCorrectResponseTotal / Math.max(1, nextCorrect)),
    normalized_score: normalizedScore(nextCorrect, nextCorrectResponseTotal, nextStreak, requireSession(ctx, currentRound.session_id).question_count),
    streak_count: nextStreak,
    last_answer_correct: is_correct,
    last_answer_at_ms: now,
    updated_at_ms: now
  });
  recomputeRanks(ctx, currentRound.session_id);
  const updatedScore = requireScore(ctx, currentRound.session_id, participantRow.participant_id);
  insertMatchEvent(ctx, currentRound.session_id, participantRow.participant_id, "answer", currentRound.order_index, updatedScore.total_score, updatedScore.current_rank, JSON.stringify({ selected_option, is_correct, officialResponseMs: response_ms, observedResponseMs: observed_response_ms, timingSuspicious: timing_suspicious }));
  insertMatchEvent(ctx, currentRound.session_id, participantRow.participant_id, "score_delta", currentRound.order_index, updatedScore.total_score, updatedScore.current_rank, JSON.stringify(scoreParts));
  recalcStats(ctx, currentRound.session_id);
  traceOperation(ctx, currentRound.session_id, "submit_answer", true, 1, undefined);
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
  traceOperation(ctx, currentRound.session_id, "resolve_round", true, 1, undefined);
});

export const finish_match = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  finishMatchInternal(ctx, session_id);
  bumpStats(ctx, session_id);
  traceOperation(ctx, session_id, "finish_match", true, 1, undefined);
});

export const create_share_card = spacetimedb.reducer({ session_id: t.string(), participant_id: t.option(t.string()) }, (ctx, { session_id, participant_id }) => {
  const participantRow = participant_id ? ctx.db.participant.participant_id.find(participant_id) : participantForSender(ctx, session_id);
  if (!participantRow || participantRow.session_id !== session_id) throw new Error("Participant not found for share card.");
  const result = ctx.db.final_result.final_result_id.find(`${session_id}:${participantRow.participant_id}`);
  if (!result) throw new Error("Final result is not ready.");
  const existing = Array.from(ctx.db.share_card.participant_id.filter(participantRow.participant_id)).find((card) => card.session_id === session_id);
  if (existing) return;
  const now = nowMs();
  ensureShareCard(ctx, requireSession(ctx, session_id), participantRow, result, now);
  bumpStats(ctx, session_id);
  traceOperation(ctx, session_id, "create_share_card", true, 1, undefined);
});

export const increment_share_view = spacetimedb.reducer({ slug: t.string() }, (ctx, { slug }) => {
  const existing = ctx.db.share_card.slug.find(slug);
  if (!existing) throw new Error("Share card not found or expired.");
  ctx.db.share_card.share_id.update({ ...existing, view_count: existing.view_count + 1 });
  traceOperation(ctx, existing.session_id, "increment_share_view", true, 1, undefined);
});

export const heartbeat = spacetimedb.reducer({ session_id: t.string(), client_latency_ms: t.option(t.u32()) }, (ctx, { session_id, client_latency_ms }) => {
  const participantRow = participantForSender(ctx, session_id);
  if (participantRow) {
    ctx.db.participant.participant_id.update({ ...participantRow, last_seen_ms: nowMs(), client_latency_ms });
  }
  recalcStats(ctx, session_id);
  traceOperation(ctx, session_id, "heartbeat", true, 1, undefined);
});

export const live_tick = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  markStaleParticipants(ctx, session_id, nowMs());
  recalcStats(ctx, session_id);
  bumpStats(ctx, session_id);
  traceOperation(ctx, session_id, "live_tick", true, 1, undefined);
});

export const reset_demo = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  resetSessionTables(ctx, session_id);
  const current = ctx.db.session.session_id.find(session_id);
  if (current) ctx.db.session.session_id.delete(session_id);
  createSessionRow(ctx, DEFAULT_CODE, QUESTION_COUNT);
  insertAudit(ctx, session_id, sender(ctx), "reset_demo", "QuizRush demo reset to a clean lobby.");
  traceOperation(ctx, session_id, "reset_demo", true, 1, undefined);
});

export const hard_reset_demo = spacetimedb.reducer({ session_id: t.string() }, (ctx, { session_id }) => {
  resetSessionTables(ctx, session_id);
  ctx.db.share_card.session_id.delete(session_id);
  const current = ctx.db.session.session_id.find(session_id);
  if (current) ctx.db.session.session_id.delete(session_id);
  createSessionRow(ctx, DEFAULT_CODE, QUESTION_COUNT);
  insertAudit(ctx, session_id, sender(ctx), "hard_reset_demo", "QuizRush demo hard reset, including share cards.");
  traceOperation(ctx, session_id, "hard_reset_demo", true, 1, undefined);
});

export const add_simulated_players = spacetimedb.reducer({ session_id: t.string(), count: t.u32() }, (ctx, { session_id, count }) => {
  const now = nowMs();
  const avatars = ["🚀", "🧠", "⚡", "✨", "🔥", "🐯"];
  const limit = Math.min(250, count);
  const existingSimulatedCount = Array.from(ctx.db.participant.session_id.filter(session_id)).filter((participant) => participant.is_simulated).length;
  for (let i = 0; i < limit; i += 1) {
    const displayIndex = existingSimulatedCount + i + 1;
    const participant_id = id(ctx, "sim");
    ctx.db.participant.insert({
      participant_id,
      session_id,
      identity: `sim-${participant_id}`,
      display_name: `Rusher ${displayIndex}`,
      avatar: avatars[i % avatars.length] ?? "🚀",
      admission_status: "admitted",
      champion_status: "active",
      joined_at_ms: now,
      last_seen_ms: now,
      is_simulated: true,
      client_latency_ms: 35 + (i % 70)
    });
    ctx.db.score.insert(emptyScore(session_id, participant_id, now, "active"));
    issueAdmissionTicket(ctx, session_id, participant_id, "admitted", now);
    insertMatchEvent(ctx, session_id, participant_id, "join", undefined, undefined, undefined, "{\"simulated\":true}");
  }
  const current = requireSession(ctx, session_id);
  if (current.status === "lobby") ctx.db.session.session_id.update({ ...current, status: "topic_voting", updated_at_ms: now });
  recomputeRanks(ctx, session_id);
  recalcStats(ctx, session_id);
  traceOperation(ctx, session_id, "add_simulated_players", true, 1, undefined);
});

export const simulate_answer_burst = spacetimedb.reducer({ session_id: t.string(), count: t.u32() }, (ctx, { session_id, count }) => {
  const current = requireSession(ctx, session_id);
  if (current.status !== "playing") return;
  const currentRound = Array.from(ctx.db.round.session_id.filter(session_id)).find((candidate) => candidate.status === "active");
  if (!currentRound) return;
  const now = nowMs();
  if (now < currentRound.starts_at_ms || now > currentRound.ends_at_ms + BigInt(200)) return;
  const currentSecret = requireQuestionSecret(ctx, currentRound.question_id);
  const answered = new Set(Array.from(ctx.db.answer.round_id.filter(currentRound.round_id)).map((item) => item.participant_id));
  const candidates = Array.from(ctx.db.participant.session_id.filter(session_id))
    .filter((item) => item.is_simulated && !answered.has(item.participant_id))
    .sort((a, b) => a.participant_id.localeCompare(b.participant_id))
    .slice(0, Math.min(Number(count || SIMULATED_ANSWER_BURST_SIZE), 32));
  const wrongOptions = ["A", "B", "C", "D"].filter((option) => option !== currentSecret.correct_option);

  candidates.forEach((item, index) => {
    const response_ms = Math.max(0, Math.min(Number(now - currentRound.starts_at_ms) + (index % 5) * 9, QUESTION_TIME_LIMIT_MS));
    const is_correct = (index + currentRound.order_index + numericSuffix(item.participant_id)) % 5 !== 0;
    const selected_option = is_correct ? currentSecret.correct_option : wrongOptions[index % wrongOptions.length] ?? "A";
    const currentScore = requireScore(ctx, session_id, item.participant_id);
    const scoreParts = computeAnswerScoreParts(is_correct, response_ms, currentScore.last_answer_correct === true);
    ctx.db.answer.insert({
      answer_id: id(ctx, "answer"),
      session_id,
      round_id: currentRound.round_id,
      question_id: currentRound.question_id,
      participant_id: item.participant_id,
      selected_option,
      is_correct,
      response_ms,
      response_ms_server: response_ms,
      official_response_ms: response_ms,
      observed_response_ms: undefined,
      client_question_rendered_at_ms: undefined,
      client_clicked_at_ms: undefined,
      client_sent_at_ms: undefined,
      client_event_id: `sim-${item.participant_id}-${currentRound.round_id}`,
      correctness_points: scoreParts.correctness_points,
      speed_bonus: scoreParts.speed_bonus,
      streak_bonus: scoreParts.streak_bonus,
      score_delta: scoreParts.score_delta,
      server_received_at_ms: now + BigInt(index),
      server_committed_at_ms: now + BigInt(index),
      participant_latency_ms_snapshot: item.client_latency_ms,
      timing_suspicious: false,
      created_at_ms: now + BigInt(index)
    });
    const nextCorrect = currentScore.correct_count + (is_correct ? 1 : 0);
    const nextAnswerResponseTotal = currentScore.total_answer_response_ms + response_ms;
    const nextCorrectResponseTotal = currentScore.total_correct_response_ms + (is_correct ? response_ms : 0);
    const nextFastest = is_correct ? (currentScore.fastest_response_ms === undefined ? response_ms : Math.min(currentScore.fastest_response_ms, response_ms)) : currentScore.fastest_response_ms;
    const nextStreak = is_correct ? currentScore.streak_count + 1 : 0;
    ctx.db.score.score_id.update({
      ...currentScore,
      total_score: currentScore.total_score + scoreParts.score_delta,
      correct_count: nextCorrect,
      wrong_count: currentScore.wrong_count + (is_correct ? 0 : 1),
      answered_count: currentScore.answered_count + 1,
      total_answer_response_ms: nextAnswerResponseTotal,
      total_correct_response_ms: nextCorrectResponseTotal,
      total_response_ms: nextAnswerResponseTotal,
      total_official_response_ms: nextAnswerResponseTotal,
      fastest_response_ms: nextFastest,
      fastest_official_response_ms: nextFastest,
      average_response_ms: Math.round(nextCorrectResponseTotal / Math.max(1, nextCorrect)),
      average_official_response_ms: Math.round(nextCorrectResponseTotal / Math.max(1, nextCorrect)),
      normalized_score: normalizedScore(nextCorrect, nextCorrectResponseTotal, nextStreak, requireSession(ctx, session_id).question_count),
      streak_count: nextStreak,
      last_answer_correct: is_correct,
      last_answer_at_ms: now + BigInt(index),
      updated_at_ms: now + BigInt(index)
    });
    const updatedScore = requireScore(ctx, session_id, item.participant_id);
    insertMatchEvent(ctx, session_id, item.participant_id, "answer", currentRound.order_index, updatedScore.total_score, updatedScore.current_rank, JSON.stringify({ selected_option, is_correct, response_ms, simulated: true }));
    insertMatchEvent(ctx, session_id, item.participant_id, "score_delta", currentRound.order_index, updatedScore.total_score, updatedScore.current_rank, JSON.stringify({ ...scoreParts, simulated: true }));
  });

  if (candidates.length) {
    recomputeRanks(ctx, session_id);
    recalcStats(ctx, session_id);
  }
  bumpStats(ctx, session_id);
  traceOperation(ctx, session_id, "simulate_answer_burst", true, 1, undefined);
});

export const record_agent_event = spacetimedb.reducer(
  { session_id: t.string(), agent_name: t.string(), event_type: t.string(), content: t.string(), confidence: t.f32(), status: t.string() },
  (ctx, input) => {
    insertAgentEvent(ctx, input.session_id, input.agent_name, input.event_type, input.content, input.confidence, input.status);
    bumpStats(ctx, input.session_id);
    traceOperation(ctx, input.session_id, "record_agent_event", true, 1, undefined);
  }
);

export const record_client_error = spacetimedb.reducer(
  {
    session_id: t.option(t.string()),
    participant_id: t.option(t.string()),
    screen: t.string(),
    error_code: t.string(),
    message: t.string(),
    stack_hash: t.option(t.string()),
    metadata_json: t.string(),
    user_agent: t.string()
  },
  (ctx, input) => {
    const now = nowMs();
    const session_id = input.session_id ?? "session-demo";
    const participant_id = input.participant_id ?? "";
    const row = {
      error_id: id(ctx, "client-error"),
      session_id,
      participant_id,
      screen: cleanText(input.screen || "unknown", 80),
      error_code: cleanText(input.error_code || "client_error", 80),
      message: cleanText(input.message || "Unknown client error", 600),
      stack_hash: input.stack_hash ? cleanText(input.stack_hash, 80) : undefined,
      metadata_json: cleanJsonText(input.metadata_json || "{}", 4000),
      user_agent: cleanText(input.user_agent || "", 300),
      created_at_ms: now
    };
    ctx.db.client_error.insert(row);
    if (ctx.db.session.session_id.find(session_id)) {
      insertMatchEvent(
        ctx,
        session_id,
        participant_id || undefined,
        "client_error",
        undefined,
        undefined,
        undefined,
        JSON.stringify({ screen: row.screen, errorCode: row.error_code, message: row.message, stackHash: row.stack_hash })
      );
      traceOperation(ctx, session_id, "record_client_error", true, 1, undefined);
    }
  }
);

type ReducerCtx = Parameters<Parameters<typeof spacetimedb.reducer>[1]>[0];
type SessionRow = ReturnType<ReducerCtx["db"]["session"]["session_id"]["find"]> extends infer R ? NonNullable<R> : never;
type RoundRow = ReturnType<ReducerCtx["db"]["round"]["round_id"]["find"]> extends infer R ? NonNullable<R> : never;
type QuestionRow = ReturnType<ReducerCtx["db"]["question_public"]["question_id"]["find"]> extends infer R ? NonNullable<R> : never;
type QuestionSecretRow = ReturnType<ReducerCtx["db"]["question_secret"]["question_id"]["find"]> extends infer R ? NonNullable<R> : never;
type ParticipantRow = ReturnType<ReducerCtx["db"]["participant"]["participant_id"]["find"]> extends infer R ? NonNullable<R> : never;
type ScoreRow = ReturnType<ReducerCtx["db"]["score"]["score_id"]["find"]> extends infer R ? NonNullable<R> : never;
type FinalResultRow = ReturnType<ReducerCtx["db"]["final_result"]["final_result_id"]["find"]> extends infer R ? NonNullable<R> : never;

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
    max_racers: MAX_PLAYERS_HARD,
    admitted_count: 0,
    capacity_status: "open",
    capacity_reason: undefined,
    created_at_ms: now,
    updated_at_ms: now
  });
  ctx.db.live_stats.insert(emptyStats("session-demo", now));
  ctx.db.session_capacity.insert(emptyCapacity("session-demo", now));
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
  if ((current.status === "playing" || current.status === "finished" || current.status === "replay") && Array.from(ctx.db.question_public.session_id.filter(session_id)).length > 0) {
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
      factIds?: string[];
      fact_ids?: string[];
      sourceTitle?: string;
      source_title?: string;
      sourceUrl?: string;
      source_url?: string;
    }>;
  };
  if (!Array.isArray(parsed.questions) || parsed.questions.length < current.question_count) {
    throw new Error("Malformed question pack.");
  }
  ctx.db.question_pack.session_id.delete(session_id);
  ctx.db.question_public.session_id.delete(session_id);
  ctx.db.question_secret.session_id.delete(session_id);
  ctx.db.round.session_id.delete(session_id);
  const now = nowMs();
  const isAgentPack = Boolean(request_id) || sender(ctx) === "agent-worker";
  const normalizedTopic = normalizeIntentForModule(selected_topic);
  const topic_key = `${packTopicKey(normalizedTopic.arena_name, normalizedTopic.topic_key)}::${normalizedTopic.difficulty_hint}`;
  const pack_id = id(ctx, "pack");
  ctx.db.question_pack.insert({
    pack_id,
    session_id,
    participant_id: undefined,
    topic_key,
    display_topic: normalizedTopic.arena_name,
    source_type: isAgentPack ? "grounded_llm" : "seed_fallback",
    quality_score: isAgentPack ? 90 : 82,
    status: isAgentPack ? "final" : "provisional",
    created_at_ms: now
  });
  parsed.questions.slice(0, current.question_count).forEach((item, index) => {
    if (!item.options || !["A", "B", "C", "D"].includes(item.correctOption)) throw new Error("Malformed question option.");
    const question_id = id(ctx, "question");
    ctx.db.question_public.insert({
      question_id,
      pack_id,
      session_id,
      participant_id: undefined,
      topic_key,
      order_index: index + 1,
      question_text: item.questionText,
      option_a: item.options.A,
      option_b: item.options.B,
      option_c: item.options.C,
      option_d: item.options.D,
      display_topic: normalizedTopic.arena_name,
      topic: item.topic || selected_topic,
      source_title: item.sourceTitle ?? item.source_title ?? "",
      source_url: item.sourceUrl ?? item.source_url ?? "",
      generated_by: isAgentPack ? "Quiz Builder Agent" : "Seed Fallback Provider",
      fairness_status: isAgentPack ? "approved" : "fallback",
      created_at_ms: now
    });
    ctx.db.question_secret.insert({
      question_id,
      pack_id,
      session_id,
      participant_id: undefined,
      correct_option: item.correctOption,
      explanation: item.explanation,
      fact_ids_json: JSON.stringify(Array.isArray(item.factIds) ? item.factIds : Array.isArray(item.fact_ids) ? item.fact_ids : []),
      created_at_ms: now
    });
  });
  ctx.db.session.session_id.update({ ...current, status: "ready", selected_topic, updated_at_ms: now });
  for (const intent of ctx.db.player_intent.session_id.filter(session_id)) {
    ctx.db.player_intent.intent_id.update({ ...intent, status: "pack_ready", updated_at_ms: now });
  }
  if (request_id) {
    const request = ctx.db.agent_request.request_id.find(request_id);
    if (request) ctx.db.agent_request.request_id.update({ ...request, status: "complete", updated_at_ms: now });
  }
  insertAgentEvent(ctx, session_id, "Match Engine", "questions_ready", `${current.question_count} questions are ready for a 25-second race.`, 1, "complete");
  bumpStats(ctx, session_id);
}

function startRoundInternal(ctx: ReducerCtx, session_id: string, question_order: number) {
  const current = requireSession(ctx, session_id);
  const questionRow = Array.from(ctx.db.question_public.session_id.filter(session_id)).find((candidate) => candidate.order_index === question_order);
  if (!questionRow) throw new Error(`Question ${question_order} is not ready.`);
  const now = nowMs();
  const matchStartedAt = current.match_started_at_ms ?? now;
  const matchDeadline = matchStartedAt + BigInt(TOTAL_MATCH_MS);
  const scheduledStart = question_order === 1 ? matchStartedAt : now + BigInt(ROUND_LEAD_TIME_MS);
  const startsAt = scheduledStart < matchStartedAt ? matchStartedAt : scheduledStart > matchDeadline ? matchDeadline : scheduledStart;
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
      round_id: id(ctx, "round"),
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
  const aCorrectMs = a.total_correct_response_ms ?? a.total_official_response_ms;
  const bCorrectMs = b.total_correct_response_ms ?? b.total_official_response_ms;
  if (aCorrectMs !== bCorrectMs) return aCorrectMs - bCorrectMs;
  const aFast = a.fastest_official_response_ms ?? a.fastest_response_ms ?? Number.MAX_SAFE_INTEGER;
  const bFast = b.fastest_official_response_ms ?? b.fastest_response_ms ?? Number.MAX_SAFE_INTEGER;
  if (aFast !== bFast) return aFast - bFast;
  const aLast = a.last_answer_at_ms ?? BigInt(Number.MAX_SAFE_INTEGER);
  const bLast = b.last_answer_at_ms ?? BigInt(Number.MAX_SAFE_INTEGER);
  if (aLast !== bLast) return aLast < bLast ? -1 : 1;
  return a.participant_id.localeCompare(b.participant_id);
}

function snapshotFinalResults(ctx: ReducerCtx, session_id: string, now: bigint) {
  const current = requireSession(ctx, session_id);
  ctx.db.final_result.session_id.delete(session_id);
  const scores = Array.from(ctx.db.score.session_id.filter(session_id)).sort(compareScores);
  const total = scores.length;
  scores.forEach((score, index) => {
    ctx.db.final_result.insert({
      final_result_id: `${session_id}:${score.participant_id}`,
      session_id,
      participant_id: score.participant_id,
      final_rank: index + 1,
      total_participants: total,
      champion_status: score.champion_status === "spectator" ? "spectator" : score.champion_status === "eliminated" ? "eliminated" : "finished",
      total_score: score.total_score,
      correct_count: score.correct_count,
      question_count: current.question_count,
      answered_count: score.answered_count,
      total_answer_response_ms: score.total_answer_response_ms,
      total_correct_response_ms: score.total_correct_response_ms,
      total_response_ms: score.total_response_ms,
      total_official_response_ms: score.total_official_response_ms,
      fastest_response_ms: score.fastest_response_ms,
      fastest_official_response_ms: score.fastest_official_response_ms,
      average_official_response_ms: score.average_official_response_ms,
      normalized_score: score.normalized_score,
      percentile: percentileRank(index + 1, total),
      created_at_ms: now
    });
  });
}

function finishMatchInternal(ctx: ReducerCtx, session_id: string) {
  const current = requireSession(ctx, session_id);
  if (current.status === "finished") return;
  const now = nowMs();
  for (const active of ctx.db.round.session_id.filter(session_id)) {
    if (active.status === "active") ctx.db.round.round_id.update({ ...active, status: "resolved", resolved_at_ms: now });
  }
  snapshotFinalResults(ctx, session_id, now);
  ctx.db.session.session_id.update({ ...current, status: "finished", match_finished_at_ms: now, updated_at_ms: now });
  const sortedScores = Array.from(ctx.db.score.session_id.filter(session_id)).sort(compareScores);
  const winner =
    sortedScores.find((score) => {
      const participantRow = ctx.db.participant.participant_id.find(score.participant_id);
      return participantRow?.admission_status === "admitted" && score.champion_status !== "eliminated" && participantRow.champion_status !== "eliminated";
    }) ?? sortedScores[0];
  if (winner) {
    ctx.db.score.score_id.update({ ...winner, champion_status: "champion", updated_at_ms: now });
    const participantRow = ctx.db.participant.participant_id.find(winner.participant_id);
    if (participantRow) ctx.db.participant.participant_id.update({ ...participantRow, champion_status: "champion" });
    const final = ctx.db.final_result.final_result_id.find(`${session_id}:${winner.participant_id}`);
    if (final) ctx.db.final_result.final_result_id.update({ ...final, champion_status: "champion" });
  }
  ensureShareCardsForFinalResults(ctx, session_id, now);
  insertMatchEvent(ctx, session_id, winner?.participant_id, "match_finished", undefined, winner?.total_score, winner?.current_rank, "{}");
}

function markStaleParticipants(ctx: ReducerCtx, session_id: string, now: bigint) {
  const current = requireSession(ctx, session_id);
  if (current.status !== "playing") return 0;
  let changed = 0;
  for (const item of ctx.db.participant.session_id.filter(session_id)) {
    if (
      item.admission_status !== "admitted" ||
      item.is_simulated ||
      item.champion_status !== "active" ||
      now <= item.last_seen_ms + BigInt(PLAYER_STALE_TIMEOUT_MS)
    ) {
      continue;
    }
    ctx.db.participant.participant_id.update({ ...item, champion_status: "eliminated", last_seen_ms: now });
    const currentScore = Array.from(ctx.db.score.participant_id.filter(item.participant_id)).find((scoreRow) => scoreRow.session_id === session_id);
    if (currentScore) {
      ctx.db.score.score_id.update({ ...currentScore, champion_status: "eliminated", updated_at_ms: now });
    }
    insertMatchEvent(
      ctx,
      session_id,
      item.participant_id,
      "participant_inactive",
      current.current_round,
      currentScore?.total_score,
      currentScore?.current_rank,
      JSON.stringify({ reason: "heartbeat_timeout", staleAfterMs: PLAYER_STALE_TIMEOUT_MS })
    );
    changed += 1;
  }
  if (changed) recomputeRanks(ctx, session_id);
  return changed;
}

function ensureShareCard(ctx: ReducerCtx, sessionRow: SessionRow, participantRow: ParticipantRow, result: FinalResultRow, now: bigint) {
  const existing = Array.from(ctx.db.share_card.participant_id.filter(participantRow.participant_id)).find((card) => card.session_id === sessionRow.session_id);
  if (existing) return existing;
  const slug = uniqueShareSlug(ctx);
  const share_text = `${participantRow.display_name} placed #${result.final_rank} with ${result.total_score.toLocaleString()} points in QuizRush Arena.`;
  ctx.db.share_card.insert({
    share_id: id(ctx, "share"),
    slug,
    session_id: sessionRow.session_id,
    participant_id: participantRow.participant_id,
    display_name: participantRow.display_name,
    avatar: participantRow.avatar,
    avatar_type: "emoji",
    avatar_emoji: participantRow.avatar,
    avatar_color: undefined,
    avatar_url: undefined,
    display_topic: sessionRow.selected_topic ?? "QuizRush Arena",
    final_rank: result.final_rank,
    total_participants: result.total_participants,
    champion_status: result.champion_status,
    total_score: result.total_score,
    correct_count: result.correct_count,
    question_count: result.question_count,
    answered_count: result.answered_count,
    total_answer_response_ms: result.total_answer_response_ms,
    total_correct_response_ms: result.total_correct_response_ms,
    total_response_ms_official: result.total_answer_response_ms,
    total_response_ms_observed: undefined,
    fastest_response_ms: result.fastest_response_ms,
    fastest_response_ms_official: result.fastest_official_response_ms,
    fastest_response_ms_observed: undefined,
    percentile: result.percentile,
    share_text,
    created_at_ms: now,
    expires_at_ms: undefined,
    view_count: 0
  });
  insertMatchEvent(ctx, sessionRow.session_id, participantRow.participant_id, "share_created", undefined, result.total_score, result.final_rank, JSON.stringify({ slug }));
  return ctx.db.share_card.slug.find(slug);
}

function ensureShareCardsForFinalResults(ctx: ReducerCtx, session_id: string, now: bigint) {
  const sessionRow = requireSession(ctx, session_id);
  const finalResults = Array.from(ctx.db.final_result.session_id.filter(session_id));
  if (finalResults.length > EAGER_SHARECARD_LIMIT) return;
  for (const result of finalResults) {
    const participantRow = ctx.db.participant.participant_id.find(result.participant_id);
    if (participantRow) ensureShareCard(ctx, sessionRow, participantRow, result, now);
  }
}

function updateCapacity(ctx: ReducerCtx, session_id: string, now: bigint) {
  let capacity = ctx.db.session_capacity.session_id.find(session_id);
  if (!capacity) {
    capacity = emptyCapacity(session_id, now);
    ctx.db.session_capacity.insert(capacity);
  }
  const participants = Array.from(ctx.db.participant.session_id.filter(session_id));
  const admitted_count = participants.filter((participant) => participant.admission_status === "admitted").length;
  const waitlisted_count = participants.filter((participant) => participant.admission_status === "waitlisted").length;
  const spectator_count = participants.filter((participant) => participant.admission_status === "spectator").length;
  const status = admitted_count >= capacity.max_racers_hard ? "full" : admitted_count >= capacity.max_racers_soft ? "soft_full" : "open";
  const reason =
    status === "full"
      ? "Measured hard cap reached for current deployment."
      : status === "soft_full"
        ? "Soft cap reached; admission is conservative until the next load test."
        : undefined;
  const next = {
    ...capacity,
    admitted_count,
    waitlisted_count,
    spectator_count,
    status,
    reason,
    updated_at_ms: now
  };
  ctx.db.session_capacity.session_id.update(next);
  const current = ctx.db.session.session_id.find(session_id);
  if (current) {
    ctx.db.session.session_id.update({
      ...current,
      max_racers: next.max_racers_hard,
      admitted_count,
      capacity_status: status,
      capacity_reason: reason,
      updated_at_ms: now
    });
  }
  return next;
}

function issueAdmissionTicket(ctx: ReducerCtx, session_id: string, participant_id: string, status: string, now: bigint) {
  const existing = Array.from(ctx.db.admission_ticket.participant_id.filter(participant_id)).find((ticket) => ticket.session_id === session_id);
  if (existing) return existing;
  const queue_position =
    status === "waitlisted"
      ? Array.from(ctx.db.admission_ticket.session_id.filter(session_id)).filter((ticket) => ticket.status === "waitlisted").length + 1
      : undefined;
  const ticket = {
    ticket_id: id(ctx, "admission"),
    session_id,
    participant_id,
    status,
    queue_position,
    issued_at_ms: now
  };
  ctx.db.admission_ticket.insert(ticket);
  return ticket;
}

function normalizedScore(correct_count: number, total_response_ms: number, streak_count: number, question_count: number): number {
  const accuracy = question_count > 0 ? correct_count / question_count : 0;
  const average = Math.round(total_response_ms / Math.max(1, correct_count));
  const speed = 1 - Math.max(0, Math.min(1, average / QUESTION_TIME_LIMIT_MS));
  const streak = Math.max(0, Math.min(1, streak_count / Math.max(1, question_count)));
  return Math.round((0.7 * accuracy + 0.25 * speed + 0.05 * streak) * 100_000) / 1000;
}

function percentileRank(rank: number, total: number): number {
  if (total <= 0) return 100;
  return Math.max(1, Math.min(100, Math.ceil((rank * 100) / total)));
}

function uniqueShareSlug(ctx: ReducerCtx): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let slug = "qra_";
    for (let index = 0; index < 12; index += 1) {
      slug += alphabet[Number(ctx.random.integerInRange(0, alphabet.length - 1))] ?? "x";
    }
    if (!ctx.db.share_card.slug.find(slug)) return slug;
  }
  return `qra_${Number(nowMs() % BigInt(1_000_000_000)).toString(36)}_${ctx.random.integerInRange(100000, 999999)}`;
}

function computeAnswerScoreParts(is_correct: boolean, response_ms: number, previous_correct: boolean) {
  if (!is_correct) {
    return { correctness_points: 0, speed_bonus: 0, streak_bonus: 0, score_delta: 0 };
  }
  const speed_bonus = Math.floor(MAX_SPEED_BONUS * Math.max(0, Math.min(1, 1 - response_ms / QUESTION_TIME_LIMIT_MS)));
  const streak_bonus = previous_correct ? STREAK_BONUS : 0;
  return {
    correctness_points: CORRECTNESS_POINTS,
    speed_bonus,
    streak_bonus,
    score_delta: CORRECTNESS_POINTS + speed_bonus + streak_bonus
  };
}

function emptyScore(session_id: string, participant_id: string, now: bigint, champion_status = "active") {
  return {
    score_id: `${session_id}:${participant_id}`,
    session_id,
    participant_id,
    total_score: 0,
    correct_count: 0,
    wrong_count: 0,
    answered_count: 0,
    total_answer_response_ms: 0,
    total_correct_response_ms: 0,
    total_response_ms: 0,
    total_official_response_ms: 0,
    total_observed_response_ms: undefined,
    fastest_response_ms: undefined,
    fastest_official_response_ms: undefined,
    fastest_observed_response_ms: undefined,
    average_response_ms: undefined,
    average_official_response_ms: undefined,
    normalized_score: 0,
    streak_count: 0,
    last_answer_correct: undefined,
    champion_status,
    current_rank: 1,
    previous_rank: 1,
    last_answer_at_ms: undefined,
    updated_at_ms: now
  };
}

function resetSessionTables(ctx: ReducerCtx, session_id: string) {
  ctx.db.participant.session_id.delete(session_id);
  ctx.db.topic_vote.session_id.delete(session_id);
  ctx.db.player_intent.session_id.delete(session_id);
  ctx.db.question_pack.session_id.delete(session_id);
  ctx.db.question_public.session_id.delete(session_id);
  ctx.db.question_secret.session_id.delete(session_id);
  ctx.db.topic_fact.session_id.delete(session_id);
  ctx.db.round.session_id.delete(session_id);
  ctx.db.answer.session_id.delete(session_id);
  ctx.db.score.session_id.delete(session_id);
  ctx.db.final_result.session_id.delete(session_id);
  ctx.db.session_capacity.session_id.delete(session_id);
  ctx.db.admission_ticket.session_id.delete(session_id);
  ctx.db.match_event.session_id.delete(session_id);
  ctx.db.agent_request.session_id.delete(session_id);
  ctx.db.agent_event.session_id.delete(session_id);
  ctx.db.audit_event.session_id.delete(session_id);
  ctx.db.operation_trace.session_id.delete(session_id);
  ctx.db.client_error.session_id.delete(session_id);
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
  const row = ctx.db.question_public.question_id.find(question_id);
  if (!row) throw new Error(`Question not found: ${question_id}`);
  return row;
}

function requireQuestionSecret(ctx: ReducerCtx, question_id: string): QuestionSecretRow {
  const row = ctx.db.question_secret.question_id.find(question_id);
  if (!row) throw new Error(`Question secret not found: ${question_id}`);
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
  const capacity = updateCapacity(ctx, session_id, now);
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
    p95_answer_commit_ms: stats.p95_answer_commit_ms,
    p95_subscription_render_ms: stats.p95_subscription_render_ms,
    admitted_racers: capacity.admitted_count,
    waitlisted_users: capacity.waitlisted_count,
    capacity_status: capacity.status,
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
    p95_answer_commit_ms: 48,
    p95_subscription_render_ms: 120,
    active_clients: 0,
    admitted_racers: 0,
    waitlisted_users: 0,
    capacity_status: "open",
    updated_at_ms: now
  };
}

function emptyCapacity(session_id: string, now: bigint) {
  return {
    session_id,
    max_racers_soft: MAX_PLAYERS_SOFT,
    max_racers_hard: MAX_PLAYERS_HARD,
    admitted_count: 0,
    waitlisted_count: 0,
    spectator_count: 0,
    status: "open",
    reason: undefined,
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
    event_id: id(ctx, "event"),
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
    event_id: id(ctx, "agent-event"),
    session_id,
    agent_name,
    event_type,
    content,
    confidence,
    status,
    created_at_ms: nowMs()
  });
}

function traceOperation(ctx: ReducerCtx, session_id: string, reducer: string, ok: boolean, duration_ms: number, error_message: string | undefined) {
  ctx.db.operation_trace.insert({
    trace_id: id(ctx, "trace"),
    session_id,
    reducer,
    identity: sender(ctx),
    ok,
    duration_ms,
    state_version: 0,
    error_message,
    created_at_ms: nowMs()
  });
}

function insertAudit(ctx: ReducerCtx, session_id: string, actor_identity: string, event_type: string, message: string) {
  ctx.db.audit_event.insert({
    audit_id: id(ctx, "audit"),
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
  const pack = lower.includes("andaman")
    ? [
        fq("The {topic} are in which body of water?", ["Bay of Bengal", "Arabian Sea", "Red Sea", "Baltic Sea"], "A", "The Andaman Islands lie in the Bay of Bengal.", normalized),
        fq("Which Indian union territory includes the {topic}?", ["Andaman and Nicobar Islands", "Lakshadweep", "Delhi", "Puducherry"], "A", "The Andaman Islands are part of the Andaman and Nicobar Islands union territory.", normalized),
        fq("What is the capital city of Andaman and Nicobar Islands?", ["Port Blair", "Kavaratti", "Panaji", "Kohima"], "A", "Port Blair is the capital of the Andaman and Nicobar Islands.", normalized),
        fq("Which colonial prison is a major Port Blair landmark?", ["Cellular Jail", "Tihar Jail", "Aga Khan Palace", "Red Fort"], "A", "Cellular Jail in Port Blair is a major historic landmark.", normalized),
        fq("Which island is also known as Swaraj Dweep?", ["Havelock Island", "Ross Island", "Neil Island", "Barren Island"], "A", "Havelock Island was renamed Swaraj Dweep.", normalized),
        fq("What natural feature is Barren Island known for?", ["Active volcano", "Hot desert", "Salt glacier", "Coral atoll only"], "A", "Barren Island is known for India's only confirmed active volcano.", normalized),
        fq("The Jarawa people are associated with which region?", ["Andaman Islands", "Sundarbans", "Thar Desert", "Nilgiri Hills"], "A", "The Jarawa are an Indigenous people of the Andaman Islands.", normalized)
      ]
    : lower.includes("visa") || lower.includes("immigration")
    ? [
        fq("In the {topic}, what is a visa generally used for?", ["Requesting entry", "Owning property", "Paying taxes", "Voting"], "A", "A visa is generally used to request permission to travel to a country for a stated purpose.", normalized),
        fq("Which document is a visa usually linked with?", ["Passport", "School ID", "Receipt", "Boarding pass"], "A", "Visas are usually placed in or electronically linked to a passport.", normalized),
        fq("What does a visa category usually describe?", ["Travel purpose", "Favorite city", "Phone model", "Hotel rating"], "A", "A visa category usually describes the purpose of travel.", normalized),
        fq("Who commonly reviews visa applications abroad?", ["Consular officer", "Airline pilot", "Hotel manager", "Bank teller"], "A", "Consular officers review many visa applications at embassies or consulates.", normalized),
        fq("What does overstaying usually mean?", ["Staying too long", "Booking early", "Flying direct", "Packing light"], "A", "Overstaying means remaining beyond the authorized period of stay.", normalized),
        fq("At a US port of entry, who decides admission?", ["Border officer", "Taxi driver", "Tour guide", "Travel blogger"], "A", "A border officer makes the final admission decision at the port of entry.", normalized),
        fq("Why do forms ask for travel purpose?", ["Match the visa", "Pick an airline", "Choose a meal", "Rate a hotel"], "A", "Travel purpose helps match a person to the correct visa category.", normalized)
      ]
    : lower.includes("space") || lower.includes("rocket") || lower.includes("astronomy")
      ? [
          fq("Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Mercury"], "A", "Mars is commonly called the Red Planet because of its reddish appearance.", "Space"),
          fq("What force keeps planets in orbit around the Sun?", ["Gravity", "Magnetism", "Friction", "Photosynthesis"], "A", "Gravity keeps planets orbiting the Sun.", "Space"),
          fq("Which agency led the Apollo Moon landing missions?", ["NASA", "ESA", "ISRO", "JAXA"], "A", "NASA led the Apollo missions that landed astronauts on the Moon.", "Space"),
          fq("What is a galaxy?", ["A huge system of stars", "A single asteroid", "A weather layer", "A rocket fuel"], "A", "A galaxy is a vast system containing stars, gas, dust, and dark matter.", "Space"),
          fq("What does an artificial satellite usually orbit?", ["A planet or moon", "A cave", "A tree", "A river"], "A", "Artificial satellites are placed in orbit around planets or moons.", "Space"),
          fq("What do rockets expel to produce thrust?", ["Fast-moving gas", "Liquid water only", "Sand", "Solar panels"], "A", "Rockets generate thrust by expelling gas at high speed.", "Space"),
          fq("What kind of object is the Sun?", ["A star", "A planet", "A comet", "A moon"], "A", "The Sun is the star at the center of the Solar System.", "Space"),
          fq("Which telescope became famous for deep-space images after launching in 1990?", ["Hubble Space Telescope", "Voyager 1", "Apollo 11", "Sputnik 1"], "A", "The Hubble Space Telescope has produced famous deep-space images since 1990.", "Space"),
          fq("What is an exoplanet?", ["A planet outside our Solar System", "A small moon crater", "A rocket engine", "A type of space suit"], "A", "An exoplanet is a planet orbiting a star beyond our Solar System.", "Space"),
          fq("Which spacecraft family explored the outer planets and beyond?", ["Voyager", "Apollo", "Mercury", "Gemini"], "A", "The Voyager probes explored the outer planets and continued into interstellar space.", "Space")
        ]
    : lower.includes("fruit") || lower.includes("nutrition")
      ? [
          fq("In {topic}, which part usually protects seeds?", ["Fruit", "Root", "Stem", "Leaf"], "A", "A fruit develops around seeds and often helps protect or spread them.", normalized),
          fq("Which nutrient is citrus fruit famous for?", ["Vitamin C", "Iron", "Caffeine", "Salt"], "A", "Citrus fruits are widely known for vitamin C.", normalized),
          fq("What process helps fruit plants make sugars?", ["Photosynthesis", "Evaporation", "Rusting", "Freezing"], "A", "Plants use photosynthesis to make sugars.", normalized),
          fq("Which fruit is botanically a berry?", ["Banana", "Carrot", "Potato", "Onion"], "A", "Botanically, bananas are classified as berries.", normalized),
          fq("Why do many fruits taste sweet?", ["Natural sugars", "Metal salts", "Chalk", "Air pressure"], "A", "Many ripe fruits contain natural sugars.", normalized),
          fq("What can fruit fiber support?", ["Digestion", "Jet engines", "Magnetism", "Screen brightness"], "A", "Dietary fiber from fruit can support normal digestion.", normalized),
          fq("Why do fruits ripen?", ["Seed dispersal", "Battery charging", "Rock melting", "Cloud forming"], "A", "Ripening can help seeds spread.", normalized)
        ]
    : [
        fq("Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Mercury"], "A", "Mars is commonly called the Red Planet because of its reddish appearance.", "General Knowledge"),
        fq("What gas do plants absorb during photosynthesis?", ["Carbon dioxide", "Oxygen", "Helium", "Nitrogen"], "A", "Plants absorb carbon dioxide during photosynthesis.", "General Knowledge"),
        fq("Which ocean is the largest on Earth?", ["Pacific Ocean", "Indian Ocean", "Atlantic Ocean", "Arctic Ocean"], "A", "The Pacific Ocean is Earth's largest ocean.", "General Knowledge"),
        fq("Who wrote the play Romeo and Juliet?", ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], "A", "Romeo and Juliet is a play by William Shakespeare.", "General Knowledge"),
        fq("What is the boiling point of water at sea level?", ["100°C", "50°C", "0°C", "200°C"], "A", "At standard sea-level pressure, water boils at 100°C.", "General Knowledge"),
        fq("Which organ pumps blood through the human body?", ["Heart", "Liver", "Lung", "Kidney"], "A", "The heart pumps blood through the circulatory system.", "General Knowledge"),
        fq("Which continent is the Sahara Desert in?", ["Africa", "Asia", "Europe", "Australia"], "A", "The Sahara Desert is in Africa.", "General Knowledge")
      ];
  const questions = [];
  for (let index = 0; index < count; index += 1) questions.push(pack[index % pack.length]);
  return questions;
}

function fq(questionText: string, options: [string, string, string, string], correctOption: string, explanation: string, topic: string) {
  const renderedQuestion = questionText.replace(/\{topic\}/g, topic);
  return {
    questionText: renderedQuestion,
    options: { A: options[0], B: options[1], C: options[2], D: options[3] },
    correctOption,
    explanation: explanation.replace(/\{topic\}/g, topic),
    topic,
    factIds: [topicKey(`${topic}-${renderedQuestion}`).slice(0, 72)]
  };
}

function normalizeTopic(topic: string): string {
  const cleaned = topic.trim().replace(/\s+/g, " ");
  if (!cleaned) return DEFAULT_TOPIC;
  return cleaned
    .split(" + ")
    .map((part) => normalizeIntentForModule(part).arena_name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" + ")
    .slice(0, 80);
}

function normalizeIntentForModule(raw: string) {
  const cleaned = removeRepeatedNgrams(
    raw
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s+.-]/gu, " ")
      .replace(/\b(i want to|i know about|i know|test me on|quiz me on|give quiz competition for|compete in|quiz|questions|about|on)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
  const topics: string[] = [];
  if (/\b(andaman|andaman islands|andaman and nicobar|andaman nicobar|port blair|cellular jail|havelock|swaraj dweep)\b/i.test(cleaned)) topics.push("Andaman Islands");
  if (/\b(us visa|visa system|immigration|uscis|embassy|consulate|green card|h-?1b|f-?1|b-?1|b-?2)\b/i.test(cleaned)) topics.push("US Visa System");
  if (/\b(ai|artificial intelligence|agent|agents|llm|machine learning|prompt|automation)\b/i.test(cleaned)) topics.push("AI Agents");
  if (/\b(space|rocket|nasa|orbit|satellite|mars|moon|spacex|astronomy)\b/i.test(cleaned)) topics.push("Space Technology");
  if (/\b(database|databases|db|sql|spacetimedb|redis|postgres|backend|distributed)\b/i.test(cleaned)) topics.push("Database Systems");
  if (/\b(startup|startups|founder|vc|venture|pitch|product|growth|business)\b/i.test(cleaned)) topics.push("Startup Strategy");
  if (/\b(fruit|fruits|nutrition|nutrient|biology|botany|food science)\b/i.test(cleaned)) topics.push("Fruit Science");
  if (/\b(math|probability|logic|algebra|calculus|statistics|puzzle)\b/i.test(cleaned)) topics.push("Math Logic");
  if (/\b(history|empire|ancient|civilization|geography)\b/i.test(cleaned)) topics.push("World History");
  if (/\b(sports|football|soccer|f1|formula|basketball|cricket|tennis|world cup)\b/i.test(cleaned)) topics.push("Sports Strategy");
  const canonical_topics = suppressBroadModuleTopics(dedupe(topics.length ? topics : [titleCase(cleaned || "General Knowledge")])).slice(0, 3);
  const arena_name = canonical_topics.map(displayTopic).join(" x ");
  return {
    cleaned_text: cleaned,
    canonical_topics,
    topic_key: canonical_topics.map(topicKey).sort().join("::") || "general_knowledge",
    arena_name,
    difficulty_hint: /\b(expert|advanced|hard|professional)\b/i.test(raw) ? "expert" : /\b(beginner|basic|easy|intro)\b/i.test(raw) ? "beginner" : "intermediate",
    confidence: Math.min(0.96, 0.64 + canonical_topics.length * 0.1)
  };
}

function removeRepeatedNgrams(text: string): string {
  let words = text.split(/\s+/).filter(Boolean);
  for (const size of [3, 2, 1]) {
    const output: string[] = [];
    for (let index = 0; index < words.length; index += 1) {
      const current = words.slice(index, index + size).map(repeatKey).join(" ");
      const previous = output.slice(Math.max(0, output.length - size)).map(repeatKey).join(" ");
      if (output.length >= size && current === previous) {
        index += size - 1;
        continue;
      }
      output.push(words[index] ?? "");
    }
    words = output.filter(Boolean);
  }
  return words.join(" ");
}

function displayTopic(topic: string): string {
  if (topic === "AI Agents") return "AI";
  if (topic === "Space Technology") return "Space";
  if (topic === "Database Systems") return "Databases";
  if (topic === "Startup Strategy") return "Startups";
  if (topic === "World History") return "History";
  return topic;
}

function repeatKey(word: string): string {
  const lower = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return lower.length > 3 && lower.endsWith("s") ? lower.slice(0, -1) : lower;
}

function topicKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function packTopicKey(displayTopic: string, fallbackTopicKey: string): string {
  return displayTopic.toLowerCase() === "space" ? "space" : fallbackTopicKey;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = topicKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function suppressBroadModuleTopics(topics: string[]): string[] {
  const hasSpecificScience = topics.some((topic) => ["Fruit Science", "Space Technology", "Database Systems", "AI Agents"].includes(topic));
  return hasSpecificScience ? topics.filter((topic) => topic !== "Science") : topics;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      return ["us", "usa", "uk", "ai", "llm", "db", "sql", "api"].includes(lower) ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function parseTopics(topics_json: string): string[] {
  const parsed = JSON.parse(topics_json) as unknown;
  if (!Array.isArray(parsed)) throw new Error("topics_json must be a JSON array.");
  return Array.from(new Set(parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))).slice(0, 3);
}

function cleanName(name: string): string {
  return name.trim().slice(0, 24) || "Player";
}

function cleanText(value: string, maxLength: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanJsonText(value: string, maxLength: number): string {
  try {
    const parsed = JSON.parse(value || "{}");
    return JSON.stringify(parsed).slice(0, maxLength);
  } catch {
    return "{}";
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
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

function id(ctx: ReducerCtx, prefix: string): string {
  return `${prefix}-${Date.now()}-${ctx.random.integerInRange(0, 1_000_000)}`;
}
