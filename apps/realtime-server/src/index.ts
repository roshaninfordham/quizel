import { createServer } from "node:http";
import { QuizDuelEngine } from "@quizduel/shared";
import type { ReducerEnvelope, SnapshotMessage } from "@quizduel/shared";
import { WebSocketServer, type WebSocket } from "ws";

const port = Number(process.env.REALTIME_PORT ?? 8787);
const engine = new QuizDuelEngine();
const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "quizduel-realtime-server" }));
    return;
  }

  response.writeHead(200, { "content-type": "text/plain" });
  response.end("QuizDuel Live realtime reducer gateway is running.\n");
});

const wss = new WebSocketServer({ server });

function snapshot(): SnapshotMessage {
  return {
    type: "snapshot",
    state: engine.getSnapshot(),
    stateVersion: engine.stateVersion,
    serverTime: Date.now()
  };
}

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload: unknown): void {
  const encoded = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(encoded);
    }
  }
}

engine.subscribe(() => {
  broadcast(snapshot());
});

wss.on("connection", (ws) => {
  send(ws, snapshot());

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(String(raw)) as Partial<ReducerEnvelope> & {
        type?: string;
        requestId?: string;
      };

      if (message.type === "ping") {
        send(ws, { type: "pong", serverTime: Date.now() });
        return;
      }

      if (message.type !== "call" || typeof message.reducer !== "string") {
        send(ws, {
          type: "error",
          error: "Expected { type: 'call', reducer, args, identity }."
        });
        return;
      }

      const receipt = engine.callReducer(message.reducer, message.args ?? {}, message.identity ?? "anonymous-device");
      send(ws, {
        type: "receipt",
        requestId: message.requestId ?? null,
        receipt
      });
    } catch (error) {
      send(ws, {
        type: "error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.info(`QuizDuel Live realtime reducer gateway listening on ws://0.0.0.0:${port}`);
});
