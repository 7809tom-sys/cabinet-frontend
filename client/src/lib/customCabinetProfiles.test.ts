import { describe, expect, it } from "vitest";
import { customProfileUsesGenericImage, isCustomCabinetProfile } from "./customCabinetProfiles";

describe("Custom Cabinet Rule profiles", () => {
  it("recognizes supported non-standard cabinet profiles", () => {
    expect(isCustomCabinetProfile("wine-rack")).toBe(true);
    expect(isCustomCabinetProfile("open-shelf-side-door")).toBe(true);
    expect(isCustomCabinetProfile("end-angle")).toBe(true);
    expect(isCustomCabinetProfile("curved-open-shelf")).toBe(true);
    expect(isCustomCabinetProfile("pullout-tower")).toBe(true);
    expect(isCustomCabinetProfile("knee-drawer")).toBe(true);
    expect(isCustomCabinetProfile("hood-wall-chimney")).toBe(true);
    expect(isCustomCabinetProfile("hood-insert")).toBe(true);
  });

  it("does not treat standard or unknown drawing types as custom profiles", () => {
    expect(isCustomCabinetProfile("standard")).toBe(false);
    expect(isCustomCabinetProfile("base_2door")).toBe(false);
    expect(isCustomCabinetProfile(null)).toBe(false);
  });

  it("uses a configured generic image for supported custom profiles", () => {
    expect(customProfileUsesGenericImage("curved-open-shelf")).toBe(true);
    expect(customProfileUsesGenericImage("end-angle")).toBe(true);
    expect(customProfileUsesGenericImage("wine-rack")).toBe(true);
    expect(customProfileUsesGenericImage("knee-drawer")).toBe(true);
    expect(customProfileUsesGenericImage("hood-insert")).toBe(true);
    expect(customProfileUsesGenericImage("standard")).toBe(false);
  });
});
