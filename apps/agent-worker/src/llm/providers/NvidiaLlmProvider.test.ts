import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NvidiaLlmProvider } from "./NvidiaLlmProvider";

const baseConfig = {
  baseUrl: "https://integrate.api.nvidia.com/v1",
  apiKey: "",
  authorApiKey: "author-key",
  authorModelId: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  reasoningApiKey: "reasoning-key",
  reasoningModelId: "nvidia/nemotron-3-super-120b-a12b",
  smallApiKey: "small-key",
  smallModelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
  safetyApiKey: "safety-key",
  safetyModelId: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
  jsonMode: false,
  reasoningEnabled: true,
  authorMaxConcurrency: 1,
  reasoningMaxConcurrency: 1,
  smallMaxConcurrency: 1,
  safetyMaxConcurrency: 1,
  routeQueueTimeoutMs: 10,
  cooldownMs: 1000
};

describe("NvidiaLlmProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a /v1 base URL and posts to chat completions", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"approved\":true,\"rejectedCount\":0,\"issues\":[],\"fixedQuestions\":[]}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NvidiaLlmProvider(baseConfig);
    const result = await Effect.runPromise(
      provider.generateJson<{ approved: boolean }>({
        system: "Return JSON",
        user: "{}",
        schemaName: "FairnessReview",
        timeoutMs: 500,
        temperature: 0.1
      })
    );

    expect(result.approved).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://integrate.api.nvidia.com/v1/chat/completions", expect.any(Object));
  });

  it("fails open when a route is saturated instead of queueing indefinitely", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return new Response(JSON.stringify({ choices: [{ message: { content: "{\"questions\":[]}" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const provider = new NvidiaLlmProvider(baseConfig);
    const input = {
      system: "Return JSON",
      user: "{}",
      schemaName: "QuizQuestionBatch",
      timeoutMs: 500,
      temperature: 0.2
    };

    const [first, second] = await Promise.allSettled([
      Effect.runPromise(provider.generateJson(input)),
      Effect.runPromise(provider.generateJson(input))
    ]);

    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("rejected");
    if (second.status === "rejected") {
      expect(String(second.reason)).toContain("concurrency limit reached");
    }
  });

  it("routes topic selection through the small model", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"selected_topic\":\"Space\",\"reason\":\"fast\",\"topic_weights\":[{\"topic\":\"Space\",\"weight\":1}]}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NvidiaLlmProvider(baseConfig);
    await Effect.runPromise(
      provider.generateJson({
        system: "Return JSON",
        user: "{}",
        schemaName: "TopicRouter",
        timeoutMs: 500,
        temperature: 0.1
      })
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("nvidia/llama-3.1-nemotron-nano-8b-v1");
  });

  it("coerces NVIDIA safety guard label text into the app safety schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "User Safety: safe\nResponse Safety: safe" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const provider = new NvidiaLlmProvider(baseConfig);
    const result = await Effect.runPromise(
      provider.generateJson<{ safe: boolean; riskLevel: string }>({
        system: "Return safety labels",
        user: "{}",
        schemaName: "SafetyGuardReview",
        timeoutMs: 500,
        temperature: 0
      })
    );

    expect(result).toMatchObject({ safe: true, riskLevel: "low" });
  });
});
