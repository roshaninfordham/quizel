import { Effect } from "effect";
import { demoQuestions } from "../../fallbacks/demoQuestions";
import type { LlmError } from "../errors";
import type { GenerateJsonInput, LlmProvider } from "../provider";

export class FallbackSeedProvider implements LlmProvider {
  public generateJson<T>(_input: GenerateJsonInput): Effect.Effect<T, LlmError> {
    return Effect.succeed({
      questions: demoQuestions
    } as T);
  }
}
