import { Effect } from "effect";
import { AgentWorkerLive, QuizGenerationProgram } from "./effects/program";

const runnable = Effect.provide(QuizGenerationProgram, AgentWorkerLive);

Effect.runPromise(runnable)
  .then((result) => {
    console.info(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
