import { afterEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { fetchFirecrawlFacts } from "./firecrawl";

describe("Firecrawl grounding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts compact fact cards from Firecrawl search results", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          creditsUsed: 1,
          data: {
            web: [
              {
                title: "Andaman Islands - Wikipedia",
                url: "https://en.wikipedia.org/wiki/Andaman_Islands",
                description:
                  "The Andaman Islands are an archipelago in the northeastern Indian Ocean. The islands are part of India's Andaman and Nicobar Islands union territory.",
                markdown:
                  "Port Blair is the capital of the Andaman and Nicobar Islands. Barren Island is known for India's only confirmed active volcano."
              }
            ]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await Effect.runPromise(
      fetchFirecrawlFacts(
        {
          enabled: true,
          apiKey: "fc-test",
          apiBaseUrl: "https://api.firecrawl.dev",
          timeoutMs: 1000,
          limit: 3,
          maxFacts: 6,
          country: "US"
        },
        "Andaman"
      )
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.displayName).toBe("Andaman Islands");
    expect(result.facts.length).toBeGreaterThanOrEqual(3);
    expect(result.facts.map((fact) => fact.factText).join(" ")).toContain("Port Blair");
    expect(result.facts.every((fact) => fact.sourceType === "firecrawl" && fact.sourceUrl)).toBe(true);
  });
});
