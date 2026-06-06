import { LlmMalformedJsonError } from "./errors";

export function parseJsonContent<T>(content: string): T {
  const trimmed = content.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    const firstObject = unfenced.indexOf("{");
    const lastObject = unfenced.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      try {
        return JSON.parse(unfenced.slice(firstObject, lastObject + 1)) as T;
      } catch {
        // Fall through to typed error below.
      }
    }
  }

  throw new LlmMalformedJsonError("LLM response was not valid JSON.");
}
