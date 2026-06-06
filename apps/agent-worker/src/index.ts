import { config as loadEnv } from "dotenv";
import { Effect } from "effect";
import { AgentWorkerLive, QuizGenerationProgram } from "./effects/program";
import { WorkerConfigService } from "./effects/config";
import { LlmProviderService, selectLlmProvider } from "./llm/service";
import { runRealtimeAgentWorker } from "./spacetime/agentLoop";

loadEnv({ path: ".env.local" });
loadEnv();

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
