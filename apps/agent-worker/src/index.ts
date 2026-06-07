import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { AgentWorkerLive, QuizGenerationProgram } from "./effects/program";
import { WorkerConfigService } from "./effects/config";
import { LlmProviderService, selectLlmProvider } from "./llm/service";
import { runRealtimeAgentWorker } from "./spacetime/agentLoop";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(sourceDir, "../../..");
for (const envPath of [
  resolve(repoRoot, ".env.local"),
  resolve(process.cwd(), ".env.local"),
  resolve(repoRoot, ".env"),
  resolve(process.cwd(), ".env")
]) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}

const mode = process.env.AGENT_WORKER_MODE ?? "watch";

const runnable =
  mode === "once"
    ? Effect.provide(QuizGenerationProgram, AgentWorkerLive)
    : Effect.provide(
        Effect.gen(function* () {
          const config = yield* WorkerConfigService;
          const provider = yield* LlmProviderService;
          const selection = selectLlmProvider(config);

          yield* Effect.logInfo("Agent worker started", {
            transport: config.realtime.transport,
            realtimeUrl: config.realtime.url,
            spacetimeHost: config.realtime.transport === "spacetime" ? config.realtime.spacetimeHost : undefined,
            spacetimeModule: config.realtime.transport === "spacetime" ? config.realtime.spacetimeModule : undefined,
            providerName: selection.providerName,
            modelId: selection.modelId,
            configured: selection.configured,
            reason: selection.reason
          });

          return yield* runRealtimeAgentWorker(config, provider);
        }),
        AgentWorkerLive
      );

Effect.runPromise(runnable)
  .then((result) => {
    console.info(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
