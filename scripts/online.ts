import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { networkInterfaces } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { Effect } from "effect";
import qrcode from "qrcode-terminal";
import { WebSocket } from "ws";
import { DEFAULT_SESSION_CODE, QUESTION_COUNT } from "../packages/shared/src/index";

const REALTIME_PORT = Number(process.env.REALTIME_PORT ?? 8787);
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const TUNNEL_PROVIDER = (process.env.TUNNEL_PROVIDER ?? "none").toLowerCase();
const lanHost = process.env.QUIZRUSH_LAN_HOST ?? findLanHost() ?? "localhost";
const agentRealtimeUrl = process.env.AGENT_REALTIME_URL ?? `ws://127.0.0.1:${REALTIME_PORT}`;
const localBaseUrl = `http://localhost:${WEB_PORT}`;
const lanBaseUrl = `http://${lanHost}:${WEB_PORT}`;
let publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_APP_URL || lanBaseUrl).replace(/\/$/, "");
let browserRealtimeUrl = (
  process.env.PUBLIC_REALTIME_URL ||
  process.env.VITE_REALTIME_URL ||
  realtimeUrlFromBase(publicBaseUrl)
).replace(/\/$/, "");
let joinUrl = `${publicBaseUrl}/join/${DEFAULT_SESSION_CODE}`;
let projectorUrl = `${localBaseUrl}/arena/${DEFAULT_SESSION_CODE}`;

interface ManagedProcess {
  name: string;
  process: ChildProcessWithoutNullStreams;
}

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Starting QuizRush Live local arena");
  const processes: ManagedProcess[] = [];

  const startProcess = (name: string, command: string, args: string[], env: Record<string, string> = {}) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", (chunk) => process.stdout.write(prefixLines(name, String(chunk))));
    child.stderr.on("data", (chunk) => process.stderr.write(prefixLines(name, String(chunk))));
    processes.push({ name, process: child });
    return child;
  };
  const start = (name: string, args: string[], env: Record<string, string> = {}) => startProcess(name, "pnpm", args, env);

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

  if (!process.env.PUBLIC_BASE_URL && !process.env.VITE_PUBLIC_APP_URL && TUNNEL_PROVIDER !== "none") {
    const tunnelUrl = yield* maybeStartPublicTunnel(startProcess);
    if (tunnelUrl) {
      publicBaseUrl = tunnelUrl;
      browserRealtimeUrl = (process.env.PUBLIC_REALTIME_URL || process.env.VITE_REALTIME_URL || realtimeUrlFromBase(publicBaseUrl)).replace(/\/$/, "");
      joinUrl = `${publicBaseUrl}/join/${DEFAULT_SESSION_CODE}`;
      projectorUrl = `${localBaseUrl}/arena/${DEFAULT_SESSION_CODE}`;
    }
  }

  start("agent", ["--filter", "@quizrush/agent-worker", "start"], {
    AGENT_REALTIME_URL: agentRealtimeUrl,
    VITE_PUBLIC_APP_URL: publicBaseUrl,
    QUIZ_QUESTION_COUNT: String(QUESTION_COUNT),
    QUIZ_TOPIC: "AI + Space + Startups"
  });
  start("web", ["--filter", "@quizrush/web", "dev", "--", "--host", "0.0.0.0", "--port", String(WEB_PORT)], {
    VITE_REALTIME_URL: browserRealtimeUrl,
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
  const socket = new WebSocket(agentRealtimeUrl);
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
  console.log(`Projector on this laptop: ${projectorUrl}`);
  console.log(`Phone join QR: ${joinUrl}`);
  console.log(`Phone realtime websocket: ${browserRealtimeUrl}`);
  console.log(`Worker realtime websocket: ${agentRealtimeUrl}`);
  console.log(`Session: ${DEFAULT_SESSION_CODE}`);
  console.log("");
  qrcode.generate(joinUrl, { small: true });
  console.log("");
  console.log("Keyboard on projector: S start | G generate | A add simulated players | T tech | F finish | R reset");
  if (lanHost === "localhost" && !process.env.PUBLIC_BASE_URL && !process.env.VITE_PUBLIC_APP_URL) {
    console.log("Could not detect a LAN IP. Set QUIZRUSH_LAN_HOST to your laptop IP before running make online.");
  }
  if (isLocalOnly(publicBaseUrl) || isLocalOnly(browserRealtimeUrl)) {
    console.log("Warning: the QR or websocket points at localhost. Phones need a LAN IP or public tunnel URL.");
  }
  if (isLanOnly(publicBaseUrl) && TUNNEL_PROVIDER === "none" && !process.env.PUBLIC_BASE_URL && !process.env.VITE_PUBLIC_APP_URL) {
    console.log("Network scope: same Wi-Fi/LAN only. For friends on any network, stop this and run: make online-public");
  }
  if (isLanOnly(publicBaseUrl) && TUNNEL_PROVIDER !== "none" && !process.env.PUBLIC_BASE_URL && !process.env.VITE_PUBLIC_APP_URL) {
    console.log("Public tunnel did not start. Install cloudflared or configure ngrok, then rerun make online-public.");
  }
  if (publicBaseUrl.includes("trycloudflare.com")) {
    console.log("Public tunnel: Cloudflare quick tunnel. This QR is intended for phones on any network.");
  }
  if (publicBaseUrl.includes("ngrok")) {
    console.log("Public tunnel note: ngrok free links may show a browser warning. Tap Visit Site once, then join works.");
  }
  console.log("");
}

function maybeStartPublicTunnel(
  startProcess: (name: string, command: string, args: string[], env?: Record<string, string>) => ChildProcessWithoutNullStreams
): Effect.Effect<string | null, never> {
  return Effect.promise(async () => {
    if ((TUNNEL_PROVIDER === "auto" || TUNNEL_PROVIDER === "cloudflare" || TUNNEL_PROVIDER === "cloudflared") && commandExists("cloudflared")) {
      try {
        const url = await startCloudflareTunnel(startProcess);
        if (url) return url;
      } catch {
        // Fall through to another provider or LAN mode.
      }
    }

    if ((TUNNEL_PROVIDER === "auto" || TUNNEL_PROVIDER === "ngrok") && commandExists("ngrok")) {
      try {
        return await startNgrokTunnel(startProcess);
      } catch {
        return null;
      }
    }

    return null;
  });
}

async function startCloudflareTunnel(
  startProcess: (name: string, command: string, args: string[], env?: Record<string, string>) => ChildProcessWithoutNullStreams
): Promise<string | null> {
  const child = startProcess("cloudflared", "cloudflared", ["tunnel", "--url", `http://localhost:${WEB_PORT}`, "--no-autoupdate"]);
  const url = await waitForProcessUrl(child, /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (!url && !child.killed) child.kill("SIGTERM");
  return url ? url.replace(/\/$/, "") : null;
}

async function startNgrokTunnel(
  startProcess: (name: string, command: string, args: string[], env?: Record<string, string>) => ChildProcessWithoutNullStreams
): Promise<string | null> {
  const child = startProcess("ngrok", "ngrok", ["http", `http://localhost:${WEB_PORT}`, "--log=stdout"]);
  const url = await waitForNgrokUrl();
  if (!url) {
    if (!child.killed) child.kill("SIGTERM");
    return null;
  }
  return url.replace(/\/$/, "");
}

async function waitForProcessUrl(child: ChildProcessWithoutNullStreams, pattern: RegExp): Promise<string | null> {
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 20_000);
    const onData = (chunk: Buffer) => {
      const match = String(chunk).match(pattern);
      if (match?.[0]) {
        cleanup();
        resolve(match[0]);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
  });
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
    .filter((line) => !isBenignWebProxyNoise(name, line))
    .map((line) => `[${name}] ${line}\n`)
    .join("");
}

function isBenignWebProxyNoise(name: string, line: string): boolean {
  if (name !== "web") return false;
  const trimmed = line.trim();
  return (
    trimmed.includes("[vite] ws proxy socket error") ||
    trimmed === "Error: write EPIPE" ||
    trimmed === "Error: read ECONNRESET" ||
    trimmed.startsWith("at afterWriteDispatched") ||
    trimmed.startsWith("at writeGeneric") ||
    trimmed.startsWith("at Socket._write") ||
    trimmed.startsWith("at writeOrBuffer") ||
    trimmed.startsWith("at _write") ||
    trimmed.startsWith("at Writable.write") ||
    trimmed.startsWith("at Socket.ondata") ||
    trimmed.startsWith("at Socket.emit") ||
    trimmed.startsWith("at addChunk") ||
    trimmed.startsWith("at readableAddChunk") ||
    trimmed.startsWith("at Readable.push") ||
    trimmed.startsWith("at TCP.onStreamRead") ||
    trimmed.startsWith("at Readable.read") ||
    trimmed.startsWith("at Socket.read") ||
    trimmed.startsWith("at flow") ||
    trimmed.startsWith("at emitReadable_") ||
    trimmed.startsWith("at process.processTicksAndRejections")
  );
}

function findLanHost(): string | null {
  const defaultInterface = readDefaultInterface();
  const preferredInterfaces = [defaultInterface, "en0", "en1", "en2"].filter(Boolean) as string[];
  for (const name of [...new Set(preferredInterfaces)]) {
    const address = readInterfaceAddress(name);
    if (address && isUsableLanAddress(address)) return address;
  }

  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal && isUsableLanAddress(entry.address)) {
        return entry.address;
      }
    }
  }
  return null;
}

function readDefaultInterface(): string | null {
  try {
    const output = execFileSync("route", ["-n", "get", "default"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return output.match(/interface:\s+(\S+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function readInterfaceAddress(name: string): string | null {
  try {
    const output = execFileSync("ipconfig", ["getifaddr", name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return output.trim() || null;
  } catch {
    return null;
  }
}

function isUsableLanAddress(address: string): boolean {
  return Boolean(address) && !address.startsWith("127.") && !address.startsWith("169.254.");
}

function isLocalOnly(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function isLanOnly(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
    const [first, second] = parts;
    return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
  } catch {
    return false;
  }
}

function realtimeUrlFromBase(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/quizrush-ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function commandExists(command: string): boolean {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function waitForNgrokUrl(): Promise<string | null> {
  for (let attempt = 0; attempt < 35; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4040/api/tunnels");
      if (response.ok) {
        const payload = (await response.json()) as {
          tunnels?: Array<{ public_url?: string; proto?: string }>;
        };
        const tunnel =
          payload.tunnels?.find((item) => item.public_url?.startsWith("https://")) ??
          payload.tunnels?.find((item) => item.public_url?.startsWith("http://"));
        if (tunnel?.public_url) return tunnel.public_url;
      }
    } catch {
      // ngrok API is still booting.
    }
    await sleep(300);
  }
  return null;
}
