import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
const statusExpression = source.match(/const geminiImageTestBlockingReason = ([\s\S]*?);\n/)?.[1];
function status(overrides: Record<string, unknown> = {}) {
  const state = {
    geminiManifestValidationReason: null,
    geminiImageTestJobId: null,
    geminiAutomaticRetrySeconds: 0,
    geminiAutomaticRetryLabel: "0s",
    startGeminiImageTestMutation: { isPending: false },
    photoRenderDraft: {},
    geminiCooldownActive: false,
    geminiCooldownLabel: "0s",
    ...overrides,
  };
  if (!statusExpression) throw new Error("Gemini status expression missing");
  return Function(...Object.keys(state), `return (${statusExpression});`)(...Object.values(state));
}
const button = source.match(/<Button[^>]*onClick=\{\(\) => void startGeminiImageTest\(\)\}[\s\S]*?<\/Button>/)?.[0];
const disabledExpression = button?.match(/disabled=\{([^}]+)\}/)?.[1];
function disabled(overrides: Record<string, unknown> = {}) {
  const state = {
    startGeminiImageTestMutation: { isPending: false },
    geminiCooldownActive: false,
    geminiManifestValidationReason: null,
    ...overrides,
  };
  if (!disabledExpression) throw new Error("Gemini button disabled expression missing");
  return Function(...Object.keys(state), `return (${disabledExpression});`)(...Object.values(state));
}

describe("Gemini image button workflow", () => {
  it("shows the exact material blocker instead of pretending Google is generating", () => {
    const reason = "Google image test blocked: Missing exact swatch: countertop";
    expect(status({ geminiManifestValidationReason: reason })).toBe(reason);
    expect(status({ geminiManifestValidationReason: reason, geminiImageTestJobId: 42 })).toBe(reason);
  });
  it("does not claim an idle preview is generating", () => {
    expect(status()).toBeNull();
    expect(status({ photoRenderDraft: null })).toContain("Open Final preview");
  });
  it("reports real pending requests, active jobs and rate limits", () => {
    expect(status({ startGeminiImageTestMutation: { isPending: true } })).toContain("Starting");
    expect(status({ geminiImageTestJobId: 42 })).toContain("Google is generating");
    expect(status({ geminiImageTestJobId: 42, geminiAutomaticRetrySeconds: 60, geminiAutomaticRetryLabel: "1m 00s" })).toContain("automatically in 1m 00s");
    expect(status({ geminiCooldownActive: true })).toContain("rate-limited");
  });
  it("disables any invalid manifest instead of permitting a request or showing a stale success action", () => {
    expect(disabled()).toBe(false);
    expect(disabled({ geminiManifestValidationReason: "Missing swatch" })).toBe(true);
    expect(disabled({ startGeminiImageTestMutation: { isPending: true } })).toBe(true);
    expect(disabled({ geminiCooldownActive: true })).toBe(true);
    const handler = source.slice(source.indexOf("const startGeminiImageTest = async () =>"), source.indexOf("const openSavedGeminiImageTest ="));
    expect(handler).toMatch(/if \(geminiManifestValidationReason\) \{\s*setGeminiImageTestError\(geminiManifestValidationReason\);\s*return;/);
    expect(handler.indexOf("if (geminiManifestValidationReason)")).toBeLessThan(handler.indexOf("mutateAsync("));
    expect(handler).toContain("serializeGeminiImageTestProvenanceForWire(photoRenderDraft.provenance)");
    expect(handler).toContain('sceneSignature: `${photoRenderDraft.sceneSignature}-gemini-test-v2`');
    expect(source).toContain('!geminiManifestValidationReason && geminiImageTestJobQuery.data?.status === "completed"');
    expect(source).toContain('!geminiManifestValidationReason && savedGeminiImageTestQuery.data');
  });
  it("keeps the in-house WebGL path tracer disabled", () => {
    expect(source).toContain("export const IN_HOUSE_PATH_TRACE_ENABLED = false;");
    expect(source).toContain("if (!isPhotoQualityTest || !IN_HOUSE_PATH_TRACE_ENABLED) return;");
  });
  it("offers Gemini for a current saved affiliate plan while preserving the administrator snapshot path", () => {
    expect(source).toContain("canAffiliateGeminiImageTest?: boolean;");
    expect(source).toContain("const isAffiliateGeminiImageTest = !isPhotoQualityTest && canAffiliateGeminiImageTest && Boolean(savedDesignId) && isCurrentPlanSaved;");
    expect(source).toContain("const canUseGeminiImageTest = isPhotoQualityTest || isAffiliateGeminiImageTest;");
    expect(source).toContain("{canUseGeminiImageTest && <section data-testid=\"gemini-image-test\"");
    expect(source).toContain("Affiliate results are saved automatically in this storefront’s Image Cabinet");
    expect(source).toContain("newest primary room scene");
    expect(source).toContain('isAffiliateGeminiImageTest ? <div data-testid="photo-quality-affiliate-test"');
    expect(source).toContain("No customer lead, phone verification, pricing change, or CRM record is created.");
    expect(source).toContain("{!isPhotoQualityTest && !isAffiliateGeminiImageTest && <section data-testid=\"photo-quality-phone-verification\"");
    expect(source).toContain("{(isPhotoQualityTest || isAffiliateGeminiImageTest) ? <div className=\"flex justify-end\"");
  });
});
