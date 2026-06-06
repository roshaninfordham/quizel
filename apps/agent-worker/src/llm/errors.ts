export class LlmTimeoutError extends Error {
  public override readonly name = "LlmTimeoutError";
}

export class LlmMalformedJsonError extends Error {
  public override readonly name = "LlmMalformedJsonError";
}

export class LlmProviderError extends Error {
  public override readonly name = "LlmProviderError";
}

export class SpacetimeWriteError extends Error {
  public override readonly name = "SpacetimeWriteError";
}

export class ValidationError extends Error {
  public override readonly name = "ValidationError";
}

export type LlmError =
  | LlmTimeoutError
  | LlmMalformedJsonError
  | LlmProviderError
  | SpacetimeWriteError
  | ValidationError;
