import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designToolSource = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("designer real-room measurement bridge", () => {
  it("creates, polls, reviews, and consumes a protected phone measurement session", () => {
    expect(designToolSource).toContain("trpc.measureSessions.createSession.useMutation");
    expect(designToolSource).toContain("trpc.measureSessions.pollSession.useQuery");
    expect(designToolSource).toContain("trpc.measureSessions.consumeSession.useMutation");
    expect(designToolSource).toContain("Review measured room dimensions");
    expect(designToolSource).toContain("Apply measured room size");
  });

  it("registers the standalone phone measurement route", () => {
    expect(appSource).toContain('path="/measure"');
    expect(appSource).toContain('lazy(() => import("@/pages/ARMeasure"))');
  });
});
