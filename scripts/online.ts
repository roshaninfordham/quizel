import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { Effect } from "effect";
import qrcode from "qrcode-terminal";
import { WebSocket } from "ws";
import { DEFAULT_SESSION_CODE, QUESTION_COUNT } from "../packages/shared/src/index";

const REALTIME_PORT = Number(process.env.REALTIME_PORT ?? 8787);
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const realtimeUrl = process.env.AGENT_REALTIME_URL ?? `ws://localhost:${REALTIME_PORT}`;
const localBaseUrl = `http://localhost:${WEB_PORT}`;
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_APP_URL || localBaseUrl).replace(/\/$/, "");
const joinUrl = `${publicBaseUrl}/join/${DEFAULT_SESSION_CODE}`;
const projectorUrl = `${localBaseUrl}/arena/${DEFAULT_SESSION_CODE}`;

interface ManagedProcess {
  name: string;
  process: ChildProcessWithoutNullStreams;
}

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Starting QuizRush Live local arena");
  const processes: ManagedProcess[] = [];

  const start = (name: string, args: string[], env: Record<string, string> = {}) => {
    const child = spawn("pnpm", args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", (chunk) => process.stdout.write(prefixLines(name, String(chunk))));
    child.stderr.on("data", (chunk) => process.stderr.write(prefixLines(name, String(chunk))));
    processes.push({ name, process: child });
    return child;
  };

  const cleanup = () => {
    for (const item of processes) {
      if (!item.process.killed) item.process.kill("SIGTERM");
    }
  };
  process.once("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  start("realtime", ["--filter", "@quizrush/realtime-server", "start"], { REALTIME_PORT: String(REALTIME_PORT) });
  yield* waitForHttp(`http://localhost:${REALTIME_PORT}/health`, "realtime server");

  yield* resetSession();

  start("agent", ["--filter", "@quizrush/agent-worker", "start"], {
    AGENT_REALTIME_URL: realtimeUrl,
    VITE_PUBLIC_APP_URL: publicBaseUrl,
    QUIZ_QUESTION_COUNT: String(QUESTION_COUNT),
    QUIZ_TOPIC: "AI + Space + Startups"
  });
  start("web", ["--filter", "@quizrush/web", "dev", "--", "--host", "0.0.0.0", "--port", String(WEB_PORT)], {
    VITE_REALTIME_URL: realtimeUrl,
    VITE_PUBLIC_APP_URL: publicBaseUrl
  });
  yield* waitForHttp(localBaseUrl, "Vite web app");

  printReadyBlock();
  yield* openProjector(projectorUrl);
  yield* Effect.never;
}).pipe(
  Effect.catchAll((error) =>
    Effect.sync(() => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    })
  )
);

await Effect.runPromise(program);

function waitForHttp(url: string, label: string): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
          const response = await fetch(url);
          if (response.ok) return;
        } catch {
          // Retry while the dev server boots.
        }
        await sleep(200);
      }
      throw new Error(`${label} did not become ready at ${url}`);
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error)))
  });
}

function resetSession(): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      await callReducer("reset_demo", { sessionId: "session-demo" }, "operator");
      await callReducer("create_session", { code: DEFAULT_SESSION_CODE, questionCount: QUESTION_COUNT }, "operator");
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error)))
  });
}

async function callReducer(reducer: string, args: unknown, identity: string) {
  const socket = new WebSocket(realtimeUrl);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const receipt = await new Promise<{ ok: boolean; error?: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${reducer} timed out.`)), 5000);
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

function printReadyBlock() {
  console.log("");
  console.log("QuizRush Live is online");
  console.log("");
  console.log(`Projector: ${projectorUrl}`);
  console.log(`Public join: ${joinUrl}`);
  console.log(`Realtime: ${realtimeUrl}`);
  console.log(`Session: ${DEFAULT_SESSION_CODE}`);
  console.log("");
  qrcode.generate(joinUrl, { small: true });
  console.log("");
  console.log("Keyboard on projector: S start | G generate | A add simulated players | T tech | F finish | R reset");
  if (publicBaseUrl === localBaseUrl) {
    console.log("For room phones, set PUBLIC_BASE_URL to a Cloudflare/ngrok URL before running make online.");
  }
  console.log("");
}

function openProjector(url: string): Effect.Effect<void> {
  return Effect.sync(() => {
    const child = spawn("open", [url], { stdio: "ignore", detached: true });
    child.unref();
  });
}

function prefixLines(name: string, input: string): string {
  return input
    .split(/\n/)
    .filter(Boolean)
    .map((line) => `[${name}] ${line}\n`)
    .join("");
}
