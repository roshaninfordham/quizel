import { WebSocket } from "ws";
import { DbConnection } from "../apps/agent-worker/src/spacetime/module_bindings";

const realtimeUrl = process.env.REALTIME_URL;
const sessionId = process.env.SESSION_ID ?? "session-demo";
const host = process.env.STDB_HOST ?? process.env.AGENT_SPACETIMEDB_HOST ?? process.env.VITE_SPACETIMEDB_HOST ?? "https://maincloud.spacetimedb.com";
const moduleName = process.env.STDB_MODULE ?? process.env.AGENT_SPACETIMEDB_MODULE ?? process.env.VITE_SPACETIMEDB_MODULE ?? "quizrush-live";

if (realtimeUrl) {
  await callLocalGatewayReducer(realtimeUrl, "reset_demo", { sessionId }, "host-local");
  console.info(`Reset ${sessionId} through ${realtimeUrl}`);
} else {
  const connection = await connectDirect();
  try {
    await connection.reducers.resetDemo({ sessionId });
    console.info(`Reset ${sessionId} in SpacetimeDB ${host}/${moduleName}`);
  } finally {
    connection.disconnect();
  }
}

async function callLocalGatewayReducer(url: string, reducer: string, args: unknown, identity: string) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const receipt = await new Promise<{ ok: boolean; error?: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Reducer call timed out.")), 5000);
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw)) as {
        type: string;
        requestId?: string;
        receipt?: { ok: boolean; error?: string };
      };
      if (message.type === "receipt" && message.requestId === requestId && message.receipt) {
        clearTimeout(timer);
        resolve(message.receipt);
      }
    });
    socket.send(JSON.stringify({ type: "call", requestId, reducer, args, identity }));
  });
  socket.close();
  if (!receipt.ok) throw new Error(receipt.error ?? `${reducer} failed`);
}

function connectDirect(): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error("Timed out connecting to SpacetimeDB."));
    }, 15_000);
    const connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(moduleName)
      .withConfirmedReads(false)
      .onConnect((connected) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(connected);
      })
      .onConnectError((_ctx, error) => {
        if (!settled) reject(error);
      })
      .onDisconnect((_ctx, error) => {
        if (!settled && error) reject(error);
      })
      .build();
    return connection;
  });
}

function once(socket: WebSocket, event: "open") {
  return new Promise<void>((resolve, reject) => {
    socket.once(event, () => resolve());
    socket.once("error", reject);
  });
}
