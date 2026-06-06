import type { Effect } from "effect";
import type { LlmError } from "./errors";

export interface GenerateJsonInput {
  system: string;
  user: string;
  schemaName: string;
  timeoutMs: number;
  temperature: number;
}

export interface LlmProvider {
  generateJson<T>(input: GenerateJsonInput): Effect.Effect<T, LlmError>;
}
