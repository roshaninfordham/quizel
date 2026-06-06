import { Effect } from "effect";
import { WebSocket } from "ws";
import type { QuizRushState, ReducerReceipt, SnapshotMessage } from "@quizrush/shared";
import { SpacetimeWriteError } from "../llm/errors";

export interface RealtimeClient {
  readonly waitForSnapshot: () => Effect.Effect<QuizRushState, SpacetimeWriteError>;
  readonly callReducer: <T = unknown>(
    reducer: string,
    args: unknown,
    identity?: string
  ) => Effect.Effect<ReducerReceipt<T>, SpacetimeWriteError>;
  readonly close: () => Effect.Effect<void>;
}

export function makeRealtimeClient(url: string): Effect.Effect<RealtimeClient, SpacetimeWriteError> {
  return Effect.tryPromise({
    try: async () => {
      const socket = new WebSocket(url);
      await new Promise<void>((resolve, reject) => {
        socket.once("open", () => resolve());
        socket.once("error", reject);
      });

      let latestSnapshot: { state: QuizRushState; stateVersion: number } | null = null;
      let lastDeliveredVersion = -1;
      const snapshotWaiters = new Set<{
        resolve: (snapshot: { state: QuizRushState; stateVersion: number }) => void;
        reject: (error: Error) => void;
      }>();
      const pendingReceipts = new Map<
        string,
        {
          resolve: (receipt: ReducerReceipt) => void;
          reject: (error: Error) => void;
          timer: ReturnType<typeof setTimeout>;
        }
      >();

      const failPending = (error: Error) => {
        for (const waiter of snapshotWaiters) waiter.reject(error);
        snapshotWaiters.clear();
        for (const pending of pendingReceipts.values()) {
          clearTimeout(pending.timer);
          pending.reject(error);
        }
        pendingReceipts.clear();
      };

      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as
          | SnapshotMessage
          | { type: "receipt"; requestId: string | null; receipt: ReducerReceipt }
          | { type: "error"; error: string };

        if (message.type === "snapshot") {
          latestSnapshot = { state: message.state, stateVersion: message.stateVersion };
          for (const waiter of snapshotWaiters) waiter.resolve(latestSnapshot);
          snapshotWaiters.clear();
          return;
        }

        if (message.type === "receipt" && message.requestId) {
          const pending = pendingReceipts.get(message.requestId);
          if (pending) {
            pendingReceipts.delete(message.requestId);
            clearTimeout(pending.timer);
            pending.resolve(message.receipt);
          }
        }
      });

      socket.on("close", () => failPending(new Error("Realtime socket closed.")));
      socket.on("error", (error) => failPending(error instanceof Error ? error : new Error(String(error))));

      return {
        waitForSnapshot: () =>
          Effect.tryPromise({
            try: () =>
              new Promise<QuizRushState>((resolve, reject) => {
                if (latestSnapshot && latestSnapshot.stateVersion !== lastDeliveredVersion) {
                  lastDeliveredVersion = latestSnapshot.stateVersion;
                  resolve(latestSnapshot.state);
                  return;
                }
                const waiter = {
                  resolve: (snapshot: { state: QuizRushState; stateVersion: number }) => {
                    lastDeliveredVersion = snapshot.stateVersion;
                    resolve(snapshot.state);
                  },
                  reject
                };
                snapshotWaiters.add(waiter);
              }),
            catch: (error) => new SpacetimeWriteError(error instanceof Error ? error.message : String(error))
          }),
        callReducer: <T = unknown>(reducer: string, args: unknown, identity = "agent-worker") =>
          Effect.tryPromise({
            try: () =>
              new Promise<ReducerReceipt<T>>((resolve, reject) => {
                if (socket.readyState !== socket.OPEN) {
                  reject(new Error("Realtime socket is not open."));
                  return;
                }
                const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const timer = setTimeout(() => {
                  pendingReceipts.delete(requestId);
                  reject(new Error(`${reducer} timed out.`));
                }, 5_000);
                pendingReceipts.set(requestId, {
                  timer,
                  resolve: (receipt) => resolve(receipt as ReducerReceipt<T>),
                  reject
                });
                socket.send(JSON.stringify({ type: "call", requestId, reducer, args, identity }));
              }),
            catch: (error) => new SpacetimeWriteError(error instanceof Error ? error.message : String(error))
          }),
        close: () =>
          Effect.sync(() => {
            socket.close();
          })
      };
    },
    catch: (error) => new SpacetimeWriteError(error instanceof Error ? error.message : String(error))
  });
}

export function requireOk<T>(receipt: ReducerReceipt<T>): Effect.Effect<T | undefined, SpacetimeWriteError> {
  if (receipt.ok) return Effect.succeed(receipt.data);
  return Effect.fail(new SpacetimeWriteError(receipt.error ?? `${receipt.reducer} failed`));
}
