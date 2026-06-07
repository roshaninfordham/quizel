import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SESSION_CODE,
  DEFAULT_SESSION_ID,
  QuizRushEngine,
  compareScores,
  type AgentEvent,
  type Answer,
  type LiveStats,
  type MatchEvent,
  type Participant,
  type Question,
  type QuizRushState,
  type ReducerReceipt,
  type Round,
  type Score,
  type Session,
  type TopicVote
} from "@quizrush/shared";
import type { DbConnection, SubscriptionHandle } from "./module_bindings";
import {
  buildDirectSpacetimeConnection,
  callDirectReducer,
  registerDirectSnapshotListeners,
  snapshotFromDirectConnection
} from "./directClient";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

interface RealtimeContextValue {
  state: QuizRushState;
  stateVersion: number;
  connectionState: ConnectionState;
  lastSyncAt: number | null;
  callReducer: <T = unknown>(name: string, args: unknown, identity?: string) => Promise<ReducerReceipt<T>>;
}

const localEngine = new QuizRushEngine();
const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function connectToSpacetime(): {
  host: string;
  module: string;
  realtimeUrl: string;
  transport: "gateway" | "spacetimedb";
} {
  const host = import.meta.env.VITE_SPACETIMEDB_HOST ?? "ws://localhost:3000";
  const module = import.meta.env.VITE_SPACETIMEDB_MODULE ?? "quizrush-arena";
  const configuredRealtimeUrl = String(import.meta.env.VITE_REALTIME_URL ?? "").trim();
  const forceConfiguredRealtimeUrl = String(import.meta.env.VITE_FORCE_REALTIME_URL ?? "").toLowerCase() === "true";
  const sameOriginRealtimeUrl = browserRealtimeUrlFrom(window.location.origin);
  const realtimeUrl = forceConfiguredRealtimeUrl && configuredRealtimeUrl ? configuredRealtimeUrl : sameOriginRealtimeUrl;
  const explicitTransport = String(import.meta.env.VITE_REALTIME_TRANSPORT ?? import.meta.env.VITE_SPACETIMEDB_TRANSPORT ?? "")
    .trim()
    .toLowerCase();
  const forceDirect = String(import.meta.env.VITE_SPACETIMEDB_DIRECT ?? "").toLowerCase() === "true";
  const transport = shouldUseDirectSpacetime(host, explicitTransport, forceDirect) ? "spacetimedb" : "gateway";
  return { host, module, realtimeUrl, transport };
}

export function browserRealtimeUrlFrom(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/quizrush-ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function RealtimeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState<QuizRushState>(localEngine.getSnapshot());
  const [stateVersion, setStateVersion] = useState(localEngine.stateVersion);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const directConnectionRef = useRef<DbConnection | null>(null);
  const directHandlesRef = useRef<SubscriptionHandle[]>([]);
  const directStateVersionRef = useRef(0);
  const participantSubscriptionIdsRef = useRef(new Set<string>());
  const ensureParticipantSubscriptionRef = useRef<(participantId: string) => void>(() => undefined);
  const pendingRef = useRef(new Map<string, (receipt: ReducerReceipt) => void>());

  useEffect(() => {
    const unsubscribe = localEngine.subscribe(() => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        setState(localEngine.getSnapshot());
        setStateVersion(localEngine.stateVersion);
        setLastSyncAt(Date.now());
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let closedByEffect = false;
    let retryTimer: number | undefined;
    let directSnapshotTimer: number | undefined;
    let removeDirectListeners: (() => void) | undefined;

    const connect = () => {
      const { host, module, realtimeUrl, transport } = connectToSpacetime();
      setConnectionState((current) => (current === "connected" ? "connected" : "connecting"));

      if (transport === "spacetimedb") {
        const profile = subscriptionProfileFromLocation();
        const emitDirectSnapshot = (connection: DbConnection) => {
          if (closedByEffect) return;
          directStateVersionRef.current += 1;
          setState(snapshotFromDirectConnection(connection));
          setStateVersion(directStateVersionRef.current);
          setLastSyncAt(Date.now());
        };
        const scheduleDirectSnapshot = (connection: DbConnection) => {
          if (closedByEffect || directSnapshotTimer) return;
          directSnapshotTimer = window.setTimeout(() => {
            directSnapshotTimer = undefined;
            emitDirectSnapshot(connection);
          }, 80);
        };
        const subscribe = (connection: DbConnection, queries: string[], onApplied?: () => void) => {
          const handle = connection
            .subscriptionBuilder()
            .onApplied(() => {
              if (closedByEffect) return;
              onApplied?.();
              scheduleDirectSnapshot(connection);
            })
            .onError(() => setConnectionState((current) => (current === "connected" ? current : "error")))
            .subscribe(queries);
          directHandlesRef.current.push(handle);
          return handle;
        };
        const ensureParticipantSubscription = (connection: DbConnection, participantId: string) => {
          if (!participantId || participantSubscriptionIdsRef.current.has(participantId)) return;
          participantSubscriptionIdsRef.current.add(participantId);
          subscribe(connection, participantSubscriptionQueries(profile.sessionId, participantId));
        };
        ensureParticipantSubscriptionRef.current = (participantId: string) => {
          const connection = directConnectionRef.current;
          if (!connection) return;
          ensureParticipantSubscription(connection, participantId);
        };

        const connection = buildDirectSpacetimeConnection({
          host,
          module,
          onConnect: (connectedConnection) => {
            if (closedByEffect) return;
            directConnectionRef.current = connectedConnection;
            connectedConnection
              .subscriptionBuilder()
              .onApplied(() => {
                if (closedByEffect) return;
                removeDirectListeners?.();
                removeDirectListeners = registerDirectSnapshotListeners(connectedConnection, () => scheduleDirectSnapshot(connectedConnection));
                setConnectionState("connected");
                emitDirectSnapshot(connectedConnection);
                if (profile.participantId) ensureParticipantSubscription(connectedConnection, profile.participantId);
              })
              .onError(() => setConnectionState("error"))
              .subscribe(profile.queries);
          },
          onConnectError: () => {
            if (closedByEffect) return;
            setConnectionState("error");
          },
          onDisconnect: (error) => {
            if (closedByEffect) return;
            directConnectionRef.current = null;
            setConnectionState(error ? "error" : "disconnected");
          }
        });
        directConnectionRef.current = connection;
        return;
      }

      const socket = new WebSocket(realtimeUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        setConnectionState("connected");
      });

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as
          | { type: "snapshot"; state: QuizRushState; stateVersion: number; serverTime: number }
          | { type: "receipt"; requestId: string | null; receipt: ReducerReceipt }
          | { type: "error"; error: string };

        if (message.type === "snapshot") {
          setState(message.state);
          setStateVersion(message.stateVersion);
          setLastSyncAt(Date.now());
          return;
        }

        if (message.type === "receipt" && message.requestId) {
          const resolve = pendingRef.current.get(message.requestId);
          if (resolve) {
            pendingRef.current.delete(message.requestId);
            resolve(message.receipt);
          }
        }
      });

      socket.addEventListener("close", () => {
        if (closedByEffect) return;
        setConnectionState("reconnecting");
        retryTimer = window.setTimeout(connect, 1200);
      });

      socket.addEventListener("error", () => {
        setConnectionState("error");
      });
    };

    connect();

    return () => {
      closedByEffect = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (directSnapshotTimer) window.clearTimeout(directSnapshotTimer);
      removeDirectListeners?.();
      for (const handle of directHandlesRef.current) handle.unsubscribe();
      directHandlesRef.current = [];
      participantSubscriptionIdsRef.current.clear();
      ensureParticipantSubscriptionRef.current = () => undefined;
      directConnectionRef.current?.disconnect();
      directConnectionRef.current = null;
      socketRef.current?.close();
    };
  }, []);

  const callReducer = useCallback(
    async <T,>(name: string, args: unknown, identity = getDeviceIdentity()) => {
      const directConnection = directConnectionRef.current;
      if (directConnection && connectToSpacetime().transport === "spacetimedb") {
        const result = await callDirectReducer<T>(directConnection, name, args, directStateVersionRef.current);
        directStateVersionRef.current = result.receipt.stateVersion;
        setState(result.snapshot);
        setStateVersion(result.receipt.stateVersion);
        setLastSyncAt(Date.now());
        const participantId = participantIdFromReducerResult(name, args, result.receipt.data);
        if (participantId) ensureParticipantSubscriptionRef.current(participantId);
        return result.receipt;
      }

      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return await new Promise<ReducerReceipt<T>>((resolve) => {
          pendingRef.current.set(requestId, resolve as (receipt: ReducerReceipt) => void);
          socket.send(JSON.stringify({ type: "call", requestId, reducer: name, args, identity }));
          window.setTimeout(() => {
            const pending = pendingRef.current.get(requestId);
            if (pending) {
              pendingRef.current.delete(requestId);
              pending({
                ok: false,
                reducer: name,
                error: "Reducer response timed out.",
                stateVersion,
                serverTime: Date.now()
              });
            }
          }, 5000);
        });
      }

      setConnectionState((current) => (current === "connecting" ? "disconnected" : current));
      return localEngine.callReducer<T>(name, args, identity);
    },
    [stateVersion]
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({ state, stateVersion, connectionState, lastSyncAt, callReducer }),
    [callReducer, connectionState, lastSyncAt, state, stateVersion]
  );

  return React.createElement(RealtimeContext.Provider, { value }, children);
}

function shouldUseDirectSpacetime(host: string, explicitTransport: string, forceDirect: boolean): boolean {
  if (["spacetimedb", "direct", "stdb"].includes(explicitTransport) || forceDirect) return true;
  if (["gateway", "local", "websocket", "ws"].includes(explicitTransport)) return false;
  if (!import.meta.env.VITE_SPACETIMEDB_HOST) return false;
  return !isLocalBrowserHost(window.location.hostname) && !isLocalUrl(host);
}

function isLocalUrl(value: string): boolean {
  try {
    return isLocalBrowserHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isLocalBrowserHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1" || hostname === "[::1]";
}

interface SubscriptionProfile {
  route: "projector" | "phone" | "share" | "tech";
  sessionId: string;
  participantId: string | null;
  queries: string[];
}

function subscriptionProfileFromLocation(): SubscriptionProfile {
  const parts = window.location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const route = parts[0] ?? "arena";
  const sessionCode = route === "join" || route === "arena" || route === "tech" ? parts[1] ?? DEFAULT_SESSION_CODE : DEFAULT_SESSION_CODE;
  const sessionId = DEFAULT_SESSION_ID;
  if (route === "share" && parts[1]) {
    const slug = parts[1];
    return {
      route: "share",
      sessionId,
      participantId: null,
      queries: shareSubscriptionQueries(slug)
    };
  }
  if (route === "join") {
    const participantId = getJoinedParticipantId(sessionCode);
    return {
      route: "phone",
      sessionId,
      participantId,
      queries: phoneBootstrapQueries(sessionId)
    };
  }
  if (route === "tech") {
    return {
      route: "tech",
      sessionId,
      participantId: null,
      queries: techSubscriptionQueries(sessionId)
    };
  }
  return {
    route: "projector",
    sessionId,
    participantId: null,
    queries: projectorSubscriptionQueries(sessionId)
  };
}

function projectorSubscriptionQueries(sessionId: string): string[] {
  const s = sqlString(sessionId);
  return [
    `SELECT * FROM session WHERE session_id = ${s}`,
    `SELECT * FROM session_capacity WHERE session_id = ${s}`,
    `SELECT * FROM live_stats WHERE session_id = ${s}`,
    `SELECT * FROM participant WHERE session_id = ${s}`,
    `SELECT * FROM topic_vote WHERE session_id = ${s}`,
    `SELECT * FROM player_intent WHERE session_id = ${s}`,
    `SELECT * FROM question_pack WHERE session_id = ${s}`,
    `SELECT * FROM score WHERE session_id = ${s}`,
    `SELECT * FROM final_result WHERE session_id = ${s}`,
    `SELECT * FROM round WHERE session_id = ${s}`,
    `SELECT * FROM answer WHERE session_id = ${s}`,
    `SELECT * FROM match_event WHERE session_id = ${s}`,
    `SELECT * FROM agent_request WHERE session_id = ${s}`,
    `SELECT * FROM agent_event WHERE session_id = ${s}`,
    `SELECT * FROM operation_trace WHERE session_id = ${s}`,
    `SELECT * FROM client_error WHERE session_id = ${s}`
  ];
}

function phoneBootstrapQueries(sessionId: string): string[] {
  const s = sqlString(sessionId);
  return [
    `SELECT * FROM session WHERE session_id = ${s}`,
    `SELECT * FROM session_capacity WHERE session_id = ${s}`,
    `SELECT * FROM live_stats WHERE session_id = ${s}`,
    `SELECT * FROM participant WHERE session_id = ${s}`,
    `SELECT * FROM agent_event WHERE session_id = ${s}`
  ];
}

function participantSubscriptionQueries(sessionId: string, participantId: string): string[] {
  const s = sqlString(sessionId);
  const p = sqlString(participantId);
  return [
    `SELECT * FROM participant WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM admission_ticket WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM topic_vote WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM player_intent WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM question_pack WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM question_public WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM round WHERE session_id = ${s}`,
    `SELECT * FROM answer WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM score WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM final_result WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM share_card WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM client_error WHERE session_id = ${s} AND participant_id = ${p}`,
    `SELECT * FROM agent_event WHERE session_id = ${s}`
  ];
}

function shareSubscriptionQueries(slug: string): string[] {
  const slugSql = sqlString(slug);
  return [
    `SELECT * FROM share_card WHERE slug = ${slugSql}`,
    "SELECT * FROM session"
  ];
}

function techSubscriptionQueries(sessionId: string): string[] {
  return [
    ...projectorSubscriptionQueries(sessionId),
    `SELECT * FROM question_pack WHERE session_id = ${sqlString(sessionId)}`,
    `SELECT * FROM question_public WHERE session_id = ${sqlString(sessionId)}`,
    `SELECT * FROM share_card WHERE session_id = ${sqlString(sessionId)}`,
    `SELECT * FROM admission_ticket WHERE session_id = ${sqlString(sessionId)}`,
    `SELECT * FROM audit_event WHERE session_id = ${sqlString(sessionId)}`
  ];
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function participantIdFromReducerResult(name: string, rawArgs: unknown, data: unknown): string | null {
  if (name === "join_session") {
    const participant = (data as { participant?: { participantId?: string } } | undefined)?.participant;
    return participant?.participantId ?? null;
  }
  if (name === "create_share_card") {
    const args = rawArgs as { participantId?: string } | undefined;
    return args?.participantId ?? null;
  }
  return null;
}

export function useSpacetime(): RealtimeContextValue {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useSpacetime must be used inside RealtimeProvider.");
  return value;
}

export function useSession(sessionId = DEFAULT_SESSION_ID): Session | undefined {
  const { state } = useSpacetime();
  return state.sessions.find((session) => session.sessionId === sessionId) ?? state.sessions[0];
}

export function useSessionByCode(code = DEFAULT_SESSION_CODE): Session | undefined {
  const { state } = useSpacetime();
  return state.sessions.find((session) => session.code === code || session.sessionId === code) ?? state.sessions[0];
}

export function useParticipants(sessionId = DEFAULT_SESSION_ID): Participant[] {
  return useSpacetime().state.participants.filter((participant) => participant.sessionId === sessionId);
}

export function useTopicVotes(sessionId = DEFAULT_SESSION_ID): TopicVote[] {
  return useSpacetime().state.topicVotes.filter((vote) => vote.sessionId === sessionId);
}

export function useQuestions(sessionId = DEFAULT_SESSION_ID): Question[] {
  return useSpacetime().state.questions.filter((question) => question.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex);
}

export function useCurrentRound(sessionId = DEFAULT_SESSION_ID): Round | undefined {
  const { state } = useSpacetime();
  const session = state.sessions.find((candidate) => candidate.sessionId === sessionId) ?? state.sessions[0];
  if (!session) return undefined;
  return (
    state.rounds.find((round) => round.sessionId === session.sessionId && round.status === "active") ??
    state.rounds
      .filter((round) => round.sessionId === session.sessionId)
      .sort((a, b) => b.orderIndex - a.orderIndex)[0]
  );
}

export function useCurrentQuestion(sessionId = DEFAULT_SESSION_ID, participantId?: string | null): Question | undefined {
  const round = useCurrentRound(sessionId);
  const { state } = useSpacetime();
  if (!round) return undefined;
  if (participantId) {
    const participantQuestion = state.questions.find(
      (question) => question.sessionId === sessionId && question.participantId === participantId && question.orderIndex === round.orderIndex
    );
    if (participantQuestion) return participantQuestion;
  }
  return state.questions.find((question) => question.questionId === round.questionId);
}

export function useAnswers(sessionId = DEFAULT_SESSION_ID): Answer[] {
  return useSpacetime().state.answers.filter((answer) => answer.sessionId === sessionId);
}

export function useScores(sessionId = DEFAULT_SESSION_ID): Score[] {
  return useSpacetime().state.scores.filter((score) => score.sessionId === sessionId).sort(compareScores);
}

export function useMatchEvents(sessionId = DEFAULT_SESSION_ID): MatchEvent[] {
  return useSpacetime().state.matchEvents.filter((event) => event.sessionId === sessionId);
}

export function useAgentEvents(sessionId = DEFAULT_SESSION_ID): AgentEvent[] {
  return useSpacetime().state.agentEvents.filter((event) => event.sessionId === sessionId).slice(-8).reverse();
}

export function useLiveStats(sessionId = DEFAULT_SESSION_ID): LiveStats | undefined {
  return useSpacetime().state.liveStats.find((stats) => stats.sessionId === sessionId);
}

export function getDeviceIdentity(): string {
  const key = "quizrush-arena-device";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = createClientId("device");
  window.localStorage.setItem(key, created);
  return created;
}

function createClientId(prefix: string): string {
  if (typeof window.crypto?.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  if (typeof window.crypto?.getRandomValues === "function") {
    const bytes = new Uint32Array(4);
    window.crypto.getRandomValues(bytes);
    return `${prefix}-${Array.from(bytes, (value) => value.toString(36)).join("")}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getJoinedParticipantId(code = DEFAULT_SESSION_CODE): string | null {
  return window.localStorage.getItem(`quizrush-arena-participant-${code}`);
}

export function setJoinedParticipantId(participantId: string, code = DEFAULT_SESSION_CODE): void {
  window.localStorage.setItem(`quizrush-arena-participant-${code}`, participantId);
}
