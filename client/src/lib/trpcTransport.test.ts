import { describe, expect, it, vi } from "vitest";
import { fetchTrpcJson, isHtmlApiFallback, isTrpcRequest, TRPC_HTML_RETRY_DELAYS_MS, TRPC_QUERY_METHOD_OVERRIDE } from "./trpcTransport";

describe("tRPC transport", () => {
  it("uses POST for query batches so large cabinet-price payloads stay out of the URL", () => {
    expect(TRPC_QUERY_METHOD_OVERRIDE).toBe("POST");
  });

  it("identifies tRPC paths and HTML fallback responses", () => {
    expect(isTrpcRequest("/api/trpc/pageContent.getAll?batch=1")).toBe(true);
    expect(isTrpcRequest("/catalog")).toBe(false);
    expect(isHtmlApiFallback(new Response("<!doctype html>", { headers: { "content-type": "text/html" } }))).toBe(true);
    expect(isHtmlApiFallback(new Response("{}", { headers: { "content-type": "application/json" } }))).toBe(false);
  });

  it("retries transient HTML fallbacks through a short server restart and retains JSON credentials", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("<!doctype html>", { headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response("<!doctype html>", { headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response("{\"result\":{}}", { headers: { "content-type": "application/json" } }));
    const wait = vi.fn().mockResolvedValue(undefined);

    const response = await fetchTrpcJson("/api/trpc/pageContent.getAll?batch=1", { headers: { "x-test": "1" } }, fetchImpl, wait);

    expect(wait.mock.calls.map(([delay]) => delay)).toEqual([250, 750]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers).toBeInstanceOf(Headers);
    expect(((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers as Headers).get("x-test")).toBe("1");
    expect(((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers as Headers).get("accept")).toBe("application/json");
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("never sends a persistent HTML app shell to the tRPC JSON parser", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<!doctype html>", { headers: { "content-type": "text/html" } }));
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(fetchTrpcJson("/api/trpc/auth.me", undefined, fetchImpl, wait)).rejects.toThrow("API is temporarily restarting");
    expect(fetchImpl).toHaveBeenCalledTimes(TRPC_HTML_RETRY_DELAYS_MS.length + 1);
    expect(wait.mock.calls.map(([delay]) => delay)).toEqual([...TRPC_HTML_RETRY_DELAYS_MS]);
  });

  it("does not retry an ordinary API JSON response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json" } }));

    await fetchTrpcJson("/api/trpc/auth.me", undefined, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
