import { describe, expect, it } from "vitest";
import { autoDesignSubscriptionGateEnabled, parseAutoDesignGateFlag } from "./autoDesignAccessFlag";

describe("Auto Design gate flag", () => {
  it("is off unless explicitly turned on", () => {
    expect(parseAutoDesignGateFlag(undefined)).toBe(false);
    expect(parseAutoDesignGateFlag("")).toBe(false);
    expect(parseAutoDesignGateFlag("off")).toBe(false);
    expect(parseAutoDesignGateFlag("0")).toBe(false);
    for (const v of ["on", "1", "true", "YES"]) expect(parseAutoDesignGateFlag(v)).toBe(true);
  });
  it("defaults OFF in this environment", () => {
    expect(autoDesignSubscriptionGateEnabled()).toBe(false);
  });
});
