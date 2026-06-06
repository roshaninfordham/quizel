import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SESSION_ID,
  QuizDuelEngine,
  type EnergyBalance,
  type LiveStats,
  type Match,
  type Participant,
  type QuizDuelState,
  type ReducerReceipt,
  type Round,
  type Score,
  type Session,
  type SupportEvent
} from "@quizduel/shared";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

interface RealtimeContextValue {
  state: QuizDuelState;
  stateVersion: number;
  connectionState: ConnectionState;
  lastSyncAt: number | null;
  callReducer: <T = unknown>(name: string, args: unknown, identity?: string) => Promise<ReducerReceipt<T>>;
}

const localEngine = new QuizDuelEngine();
const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function connectToSpacetime(): {
  host: string;
  module: string;
  realtimeUrl: string;
} {
  const host = import.meta.env.VITE_SPACETIMEDB_HOST ?? "ws://localhost:3000";
  const module = import.meta.env.VITE_SPACETIMEDB_MODULE ?? "quizduel-live";
  const realtimeUrl =
    import.meta.env.VITE_REALTIME_URL ?? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8787`;
  return { host, module, realtimeUrl };
}

export function RealtimeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState<QuizDuelState>(localEngine.getSnapshot());
  const [stateVersion, setStateVersion] = useState(localEngine.stateVersion);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
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

    const connect = () => {
      const { realtimeUrl } = connectToSpacetime();
      setConnectionState((current) => (current === "connected" ? "connected" : "connecting"));
      const socket = new WebSocket(realtimeUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        setConnectionState("connected");
      });

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as
          | { type: "snapshot"; state: QuizDuelState; stateVersion: number; serverTime: number }
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
      socketRef.current?.close();
    };
  }, []);

  const callReducer = useCallback(
    async <T,>(name: string, args: unknown, identity = name.startsWith("host") ? "host-local" : getDeviceIdentity()) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return await new Promise<ReducerReceipt<T>>((resolve) => {
          pendingRef.current.set(requestId, resolve as (receipt: ReducerReceipt) => void);
          socket.send(
            JSON.stringify({
              type: "call",
              requestId,
              reducer: name,
              args,
              identity
            })
          );
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
    () => ({
      state,
      stateVersion,
      connectionState,
      lastSyncAt,
      callReducer
    }),
    [callReducer, connectionState, lastSyncAt, state, stateVersion]
  );

  return React.createElement(RealtimeContext.Provider, { value }, children);
}

export function useSpacetime(): RealtimeContextValue {
  const value = useContext(RealtimeContext);
  if (!value) {
    throw new Error("useSpacetime must be used inside RealtimeProvider.");
  }
  return value;
}

export function useSession(sessionId = DEFAULT_SESSION_ID): Session | undefined {
  return useSpacetime().state.sessions.find((session) => session.sessionId === sessionId) ?? useSpacetime().state.sessions[0];
}

export function useParticipants(sessionId = DEFAULT_SESSION_ID): Participant[] {
  return useSpacetime().state.participants.filter((participant) => participant.sessionId === sessionId);
}

export function useLiveStats(sessionId = DEFAULT_SESSION_ID): LiveStats | undefined {
  return useSpacetime().state.liveStats.find((stats) => stats.sessionId === sessionId);
}

export function useCurrentMatch(sessionId = DEFAULT_SESSION_ID): Match | undefined {
  const { state } = useSpacetime();
  const session = state.sessions.find((candidate) => candidate.sessionId === sessionId) ?? state.sessions[0];
  if (!session?.currentMatchId) return undefined;
  return state.matches.find((match) => match.matchId === session.currentMatchId);
}

export function useCurrentRound(matchId?: string): Round | undefined {
  const { state } = useSpacetime();
  if (!matchId) return undefined;
  const match = state.matches.find((candidate) => candidate.matchId === matchId);
  if (!match) return undefined;
  return state.rounds.find((round) => round.matchId === matchId && round.roundNumber === match.currentRoundNumber);
}

export function useScores(matchId?: string): Score[] {
  const { state } = useSpacetime();
  if (!matchId) return [];
  return state.scores.filter((score) => score.matchId === matchId);
}

export function useSupportTotals(roundId?: string): Record<string, number> {
  const { state } = useSpacetime();
  if (!roundId) return {};
  return state.supportEvents
    .filter((event) => event.roundId === roundId)
    .reduce<Record<string, number>>((totals, event: SupportEvent) => {
      totals[event.playerId] = (totals[event.playerId] ?? 0) + event.amount;
      return totals;
    }, {});
}

export function useAgentEvents(sessionId = DEFAULT_SESSION_ID) {
  return useSpacetime().state.agentEvents.filter((event) => event.sessionId === sessionId).slice(-8).reverse();
}

export function useEnergyBalance(participantId?: string): EnergyBalance | undefined {
  const { state } = useSpacetime();
  if (!participantId) return undefined;
  return state.energyBalances.find((balance) => balance.participantId === participantId);
}

export function getDeviceIdentity(): string {
  const key = "quizduel-live-device";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `device-${crypto.randomUUID()}`;
  window.localStorage.setItem(key, created);
  return created;
}

export function getJoinedParticipantId(): string | null {
  return window.localStorage.getItem("quizduel-live-participant");
}

export function setJoinedParticipantId(participantId: string): void {
  window.localStorage.setItem("quizduel-live-participant", participantId);
}
