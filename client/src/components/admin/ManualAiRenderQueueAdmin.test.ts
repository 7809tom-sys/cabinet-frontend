import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("manual AI render queue", () => {
  it("provides the one-board review and finished-image attachment actions without direct customer upload", () => {
    const source = readFileSync(new URL("./ManualAiRenderQueueAdmin.tsx", import.meta.url), "utf8");
    expect(source).toContain("listManualAiHandoffs.useQuery");
    expect(source).toContain("Open single reference board");
    expect(source).toContain("Copy AI instruction");
    expect(source).toContain("mediaLibrary.upload.useMutation");
    expect(source).toContain("attachManualAiResult.useMutation");
    expect(source).toContain("Upload finished image");
    expect(source).toContain("exact saved plan");
    expect(source).toContain("internal email needs a recipient");
    expect(source).toContain("Open CRM review");
    expect(source).toContain("handoff.crmDealId");
  });
});
