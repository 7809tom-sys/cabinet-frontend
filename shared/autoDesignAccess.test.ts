import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTO_DESIGN_ACCESS_CONFIG,
  decideAutoDesignRun,
  freeRunsLeft,
  normalizePhoneE164,
  resolveAutoDesignAccessConfig,
  type AutoDesignAccessStatus,
} from "./autoDesignAccess";

const verified = (over: Partial<AutoDesignAccessStatus> = {}): AutoDesignAccessStatus => ({
  signedIn: true, verifiedPhoneE164: "+15555551234", hasActiveSubscription: false, runsForPhone: 0, ...over,
});

describe("normalizePhoneE164 (same rules as cabinet-backend twilioVerify)", () => {
  it("reads 10 digits as US/Canada", () => {
    expect(normalizePhoneE164("(555) 555-1234")).toBe("+15555551234");
    expect(normalizePhoneE164("555.555.1234")).toBe("+15555551234");
  });
  it("keeps an explicit country code", () => {
    expect(normalizePhoneE164("+1 555 555 1234")).toBe("+15555551234");
    expect(normalizePhoneE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhoneE164("15555551234")).toBe("+15555551234");
  });
  it("maps different spellings of one number to one key", () => {
    const keys = new Set(["5555551234", "+1-555-555-1234", " 1 (555) 555 1234 "].map(normalizePhoneE164));
    expect([...keys]).toEqual(["+15555551234"]);
  });
  it("rejects junk", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164("12345")).toBeNull();
    expect(normalizePhoneE164("+0123456789")).toBeNull();
    expect(normalizePhoneE164(null)).toBeNull();
  });
});

describe("decideAutoDesignRun", () => {
  it("allows everything with the gate off (default)", () => {
    expect(decideAutoDesignRun(false, null)).toEqual({ allowed: true, basis: "gate_off", freeRunsLeftAfter: null });
  });
  it("asks a guest to sign in", () => {
    expect(decideAutoDesignRun(true, null)).toMatchObject({ allowed: false, reason: "sign_in" });
  });
  it("asks for a verified phone before any run, even for subscribers", () => {
    expect(decideAutoDesignRun(true, verified({ verifiedPhoneE164: null, hasActiveSubscription: true }))).toMatchObject({ allowed: false, reason: "verify_phone" });
    expect(decideAutoDesignRun(true, verified({ verifiedPhoneE164: "5555551234" }))).toMatchObject({ allowed: false, reason: "verify_phone" });
  });
  it("gives one free run per phone by default, then asks to subscribe", () => {
    expect(decideAutoDesignRun(true, verified({ runsForPhone: 0 }))).toEqual({ allowed: true, basis: "free_run", freeRunsLeftAfter: 0 });
    const blocked = decideAutoDesignRun(true, verified({ runsForPhone: 1 }));
    expect(blocked).toMatchObject({ allowed: false, reason: "subscribe" });
    expect(blocked.allowed ? "" : blocked.message).toContain("$9.99");
  });
  it("lets a subscriber run regardless of the count", () => {
    expect(decideAutoDesignRun(true, verified({ runsForPhone: 40, hasActiveSubscription: true }))).toMatchObject({ allowed: true, basis: "subscribed" });
  });
  it("honours a configured free count and fee", () => {
    const config = resolveAutoDesignAccessConfig({ freeDesignsPerPhone: "3", accessFeeCents: "1999" });
    expect(decideAutoDesignRun(true, verified({ runsForPhone: 2 }), config)).toMatchObject({ allowed: true, freeRunsLeftAfter: 0 });
    const blocked = decideAutoDesignRun(true, verified({ runsForPhone: 3 }), config);
    expect(blocked.allowed ? "" : blocked.message).toContain("$19.99");
    const none = resolveAutoDesignAccessConfig({ freeDesignsPerPhone: 0 });
    expect(decideAutoDesignRun(true, verified(), none)).toMatchObject({ allowed: false, reason: "subscribe" });
  });
});

describe("config", () => {
  it("defaults to 1 free design per phone and $9.99", () => {
    expect(DEFAULT_AUTO_DESIGN_ACCESS_CONFIG.freeDesignsPerPhone).toBe(1);
    expect(DEFAULT_AUTO_DESIGN_ACCESS_CONFIG.accessFeeCents).toBe(999);
    expect(DEFAULT_AUTO_DESIGN_ACCESS_CONFIG.packs).toEqual([]);
  });
  it("ignores bad overrides", () => {
    expect(resolveAutoDesignAccessConfig({ freeDesignsPerPhone: "abc", accessFeeCents: "-5" })).toMatchObject({ freeDesignsPerPhone: 1, accessFeeCents: 999 });
    expect(resolveAutoDesignAccessConfig({ accessFeeCents: "0" }).accessFeeCents).toBe(999);
  });
  it("freeRunsLeft never goes negative", () => {
    expect(freeRunsLeft(5, 1)).toBe(0);
    expect(freeRunsLeft(Number.NaN, 2)).toBe(2);
  });
});
