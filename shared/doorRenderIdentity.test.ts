import { describe, expect, it } from "vitest";
import { doorLightsForFinish, isVeryDarkCabinetStain, RESTORED_DOOR_LIGHTS } from "./doorRenderLights";
import {
  doorAuditFingerprintForStyle,
  resolveDoorShapeDecision,
  resolveRenderHex,
} from "./doorRenderIdentity";
import { resolveDoorProfile } from "./doorStyleAppearance";

describe("door shape decisions", () => {
  it("lets an explicit door shape win over distributor text and the Aspen default", () => {
    expect(resolveDoorShapeDecision({
      ourName: "Aspen White",
      styleCode: "AW",
      doorStyle: "Shaker",
      doorShape: "slab",
    })).toEqual({ shape: "slab", source: "explicit" });
    const profile = resolveDoorProfile({
      ourName: "Aspen White",
      styleCode: "AW",
      doorStyle: "Shaker",
      doorShape: "recessed-shaker",
    });
    expect(profile.profileSource).toBe("explicit");
    expect(profile.panelConstruction).toBe("flat");
    expect(profile.doorStyle).toBe("Shaker");
  });

  it("reads distributor phrases and does not treat flat panel as a slab", () => {
    expect(resolveDoorShapeDecision({ doorStyle: "Traditional", profileNotes: "ogee cathedral" }).shape).toBe("raised");
    expect(resolveDoorShapeDecision({ doorPanelType: "Flat Panel" })).toEqual({ shape: "recessed-shaker", source: "distributor" });
    expect(resolveDoorShapeDecision({ profileDescription: "Recessed center panel" }).shape).toBe("recessed-shaker");
    expect(resolveDoorShapeDecision({ doorStyle: "Slab" }).shape).toBe("slab");
  });

  it("keeps AC and AW raised when no explicit shape is stored", () => {
    expect(resolveDoorShapeDecision({ ourName: "Aspen White", styleCode: "AW", doorStyle: "Shaker" })).toEqual({
      shape: "raised",
      source: "aspen-default",
    });
    expect(resolveDoorProfile({ ourName: "Mystery", doorStyle: null }).profileSource).toBe("guessed");
  });

  it("lets renderHex win over the name fallback and a distributor hex", () => {
    expect(resolveRenderHex({ color: "Cherry", renderHex: "#112233" })).toBe("#112233");
    expect(resolveRenderHex({ color: "#445566", ourName: "Cherry" })).toBe("#445566");
    expect(resolveRenderHex({ color: "Light Gray" })).toBe("#d5d4d0");
  });

  it("puts the renderer version, profile, color, and swatch in the fingerprint", () => {
    const first = doorAuditFingerprintForStyle({
      version: "door-audit-v2-720x1080",
      ourName: "Aspen Charcoal",
      styleCode: "AC",
      doorStyle: "Raised Panel",
      panelConstruction: "raised",
      color: "Espresso Brown",
      swatchCode: "SW7069",
    });
    const changed = doorAuditFingerprintForStyle({
      version: "door-audit-v2-720x1080",
      ourName: "Aspen Charcoal",
      styleCode: "AC",
      doorStyle: "Raised Panel",
      panelConstruction: "raised",
      color: "Espresso Brown",
      renderHex: "#010101",
      swatchCode: "SW7069",
    });
    expect(first.startsWith("door-audit-v2-720x1080|")).toBe(true);
    expect(first).toContain("raised");
    expect(first).toContain("#434341");
    expect(changed).not.toBe(first);
    expect(changed).toContain("#010101");
  });
});

describe("door lights", () => {
  it("restores the bright rig and keeps the soft rig for a very dark stain", () => {
    expect(RESTORED_DOOR_LIGHTS.exposure).toBe(0.84);
    expect(RESTORED_DOOR_LIGHTS.key.intensity).toBe(1.5);
    expect(doorLightsForFinish("#f4f1ea").hemisphere.intensity).toBe(0.92);
    expect(isVeryDarkCabinetStain("#2a211c")).toBe(true);
    expect(doorLightsForFinish("#2a211c").exposure).toBe(0.68);
    expect(doorLightsForFinish("#2a211c", 0.84).exposure).toBe(0.84);
    expect(doorLightsForFinish("#2a211c", 0.84).key.intensity).toBe(0.72);
  });
});
