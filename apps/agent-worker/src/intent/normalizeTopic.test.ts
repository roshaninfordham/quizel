import { describe, expect, it } from "vitest";
import { normalizeTopic } from "./normalizeTopic";

describe("normalizeTopic", () => {
  it("normalizes mixed-case Space", () => {
    const result = normalizeTopic({ rawText: "sPACE" });
    expect(result.displayTopic).toBe("Space");
    expect(result.topicKey).toBe("space::intermediate");
  });

  it("dedupes repeated Space words", () => {
    const result = normalizeTopic({ rawText: "SPACE space space" });
    expect(result.displayTopic).toBe("Space");
  });

  it("resolves Andaman aliases", () => {
    expect(normalizeTopic({ rawText: "Andaman" }).displayTopic).toBe("Andaman Islands");
    expect(normalizeTopic({ rawText: "Andaman Islands" }).displayTopic).toBe("Andaman Islands");
  });

  it("composes technology and startup themes", () => {
    const result = normalizeTopic({ rawText: "AI AI startup database" });
    expect(result.displayTopic).toBe("Artificial Intelligence x Startup Strategy x Databases");
  });

  it("falls back for empty input", () => {
    const result = normalizeTopic({ rawText: "" });
    expect(result.displayTopic).toBe("General Knowledge");
  });
});
