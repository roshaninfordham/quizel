import { WebSocket } from "ws";

const url = process.env.REALTIME_URL ?? "ws://localhost:8787";
const sessionId = process.env.SESSION_ID ?? "session-demo";

await callReducer("reset_demo", { sessionId }, "host-local");
console.info(`Reset ${sessionId} through ${url}`);

async function callReducer(reducer: string, args: unknown, identity: string) {
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

function once(socket: WebSocket, event: "open") {
  return new Promise<void>((resolve, reject) => {
    socket.once(event, () => resolve());
    socket.once("error", reject);
  });
}
