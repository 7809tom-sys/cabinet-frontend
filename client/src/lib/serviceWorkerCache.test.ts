import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const serviceWorkerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

describe("Designer mobile cache freshness", () => {
  it("retires the legacy navigation cache and never caches the application shell", () => {
    expect(serviceWorkerSource).toContain('const CACHE_NAME = "cabinet-dealz-v3-network-current"');
    expect(serviceWorkerSource).toContain("self.skipWaiting()");
    expect(serviceWorkerSource).toContain("self.clients.claim()");
    expect(serviceWorkerSource).not.toContain("cache.put(event.request");
    expect(serviceWorkerSource).not.toContain("caches.match(\"/\")");
    expect(serviceWorkerSource).not.toContain("event.respondWith(");
  });
});
