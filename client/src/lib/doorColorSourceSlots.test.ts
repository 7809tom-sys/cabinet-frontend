import { describe, expect, it } from "vitest";
import type { DoorColorSourceSelection } from "@shared/doorColorSourceSelection";
import { activeFourSlotSource, buildFourSlots, listingIsAvailable, paintForSlot } from "./doorColorSourceSlots";

const NOW = "2026-11-18T20:00:00.000Z";
const SW = {
  finish: "paint" as const,
  code: "SW 7036",
  label: "Accessible Beige",
  hex: "#d1c7b7",
  woodSpecies: null,
  grainDirection: "none" as const,
  profileImageUrl: null,
};
const base = { supplierPhotoUrl: "https://cdn/door.jpg", aiImageUrl: "https://cdn/ai.png", aiAvailable: true, stored: null as DoorColorSourceSelection | null, now: NOW };
const bySource = (slots: ReturnType<typeof buildFourSlots>) => Object.fromEntries(slots.map((slot) => [slot.source, slot]));

describe("buildFourSlots", () => {
  it("always returns the four slots in the fixed order", () => {
    expect(buildFourSlots(base).map((slot) => slot.source)).toEqual(["original-image", "approved-ai-image", "sherwin-williams", "hex"]);
  });

  it("with nothing chosen, Original image is the checked slot (the default)", () => {
    const slots = bySource(buildFourSlots(base));
    expect(slots["original-image"].checked).toBe(true);
    expect(Object.values(slots).filter((slot) => slot.checked)).toHaveLength(1);
  });

  it("only the checked slot follows the editor's confirmed choice", () => {
    const stored: DoorColorSourceSelection = { source: "hex", confirmed: true, chosenAt: NOW, hex: "#224466" };
    const slots = bySource(buildFourSlots({ ...base, stored }));
    expect(slots.hex.checked).toBe(true);
    expect(slots["original-image"].checked).toBe(false);
    expect(slots.hex.hex).toBe("#224466");
    expect(slots.hex.selection).toMatchObject({ source: "hex", hex: "#224466" });
  });

  it("an Approved AI choice with no accepted render falls back: Original stays checked, AI is not checkable", () => {
    const stored: DoorColorSourceSelection = { source: "approved-ai-image", chosenAt: NOW };
    const slots = bySource(buildFourSlots({ ...base, aiAvailable: false, stored }));
    expect(slots["approved-ai-image"].checked).toBe(false);
    expect(slots["original-image"].checked).toBe(true);
    expect(slots["approved-ai-image"].filled).toBe(true);
    expect(slots["approved-ai-image"].checkable).toBe(false);
    expect(slots["approved-ai-image"].caption).toMatch(/3D cannot use it yet/i);
    expect(slots["approved-ai-image"].reason).toMatch(/3D cannot use it yet/i);
    expect(activeFourSlotSource({ ...base, aiAvailable: false, stored })).toBe("original-image");
  });

  it("a saved Gemini picture that 3D can use is checkable and says it is not an accepted render", () => {
    const slots = bySource(buildFourSlots({ ...base, aiAccepted: false }));
    expect(slots["approved-ai-image"]).toMatchObject({ checkable: true, reason: null });
    expect(slots["approved-ai-image"].caption).toMatch(/Saved Gemini picture/);
    expect(bySource(buildFourSlots(base))["approved-ai-image"].caption).toMatch(/Approved AI \(Gemini\) render/);
  });

  it("every slot that cannot be picked gives a plain reason, and every pickable slot has none", () => {
    const empty = bySource(buildFourSlots({ ...base, aiImageUrl: null, aiAvailable: false }));
    expect(empty["approved-ai-image"].reason).toMatch(/No Gemini picture/);
    expect(empty["sherwin-williams"].reason).toMatch(/Sherwin-Williams/);
    expect(empty.hex.reason).toMatch(/hex/i);
    expect(empty["original-image"].reason).toBeNull();
    const stored: DoorColorSourceSelection = { source: "hex", confirmed: true, chosenAt: NOW, hex: "#224466" };
    const filled = bySource(buildFourSlots({ ...base, stored }));
    expect(filled.hex.reason).toBeNull();
    expect(filled["approved-ai-image"].reason).toBeNull();
  });

  it("a saved, accepted AI picture is shown and checkable", () => {
    const slots = bySource(buildFourSlots(base));
    expect(slots["approved-ai-image"]).toMatchObject({ imageUrl: "https://cdn/ai.png", checkable: true, filled: true });
    expect(slots["approved-ai-image"].selection).toMatchObject({ source: "approved-ai-image" });
  });

  it("empty slots say so and cannot be checked (Sherwin-Williams, hex, AI with no picture)", () => {
    const slots = bySource(buildFourSlots({ ...base, aiImageUrl: null, aiAvailable: false }));
    for (const source of ["approved-ai-image", "sherwin-williams", "hex"] as const) {
      expect(slots[source].checkable).toBe(false);
      expect(slots[source].filled).toBe(false);
      expect(slots[source].selection).toBeNull();
    }
    expect(slots.hex.caption).toMatch(/no hex/i);
    expect(slots["sherwin-williams"].caption).toMatch(/no sherwin/i);
  });

  it("Original is always checkable, even with no supplier photo", () => {
    const slots = bySource(buildFourSlots({ ...base, supplierPhotoUrl: null }));
    expect(slots["original-image"].checkable).toBe(true);
    expect(slots["original-image"].filled).toBe(false);
  });

  it("before the sources table exists, an unavailable listing fills nothing extra", () => {
    const listing = { available: false, sources: [{ source: "hex", value: { hex: "#112233" } }] };
    const slots = bySource(buildFourSlots({ ...base, listing }));
    expect(slots.hex.filled).toBe(false);
    expect(listingIsAvailable(listing)).toBe(false);
    expect(listingIsAvailable(null)).toBe(false);
  });

  it("with the sources table, all four slots fill at once and each is checkable", () => {
    const listing = {
      available: true,
      activeSource: "sherwin-williams",
      sources: [
        { source: "sherwin-williams", value: SW, isActive: true },
        { source: "hex", value: { hex: "#224466" }, isActive: false },
      ],
    };
    const stored: DoorColorSourceSelection = { source: "sherwin-williams", confirmed: true, chosenAt: NOW, color: SW };
    const slots = bySource(buildFourSlots({ ...base, listing, stored }));
    expect(Object.values(slots).every((slot) => slot.filled && slot.checkable)).toBe(true);
    expect(slots["sherwin-williams"]).toMatchObject({ checked: true, hex: "#d1c7b7", caption: "Accessible Beige · #d1c7b7" });
    expect(slots.hex).toMatchObject({ checked: false, hex: "#224466" });
    expect(slots.hex.selection).toMatchObject({ source: "hex", confirmed: true, hex: "#224466" });
  });

  it("the editor's own confirmed value beats a stale table row for its slot", () => {
    const listing = { available: true, sources: [{ source: "hex", value: { hex: "#000000" } }] };
    const stored: DoorColorSourceSelection = { source: "hex", confirmed: true, chosenAt: NOW, hex: "#224466" };
    expect(bySource(buildFourSlots({ ...base, listing, stored })).hex.hex).toBe("#224466");
  });

  it("ignores a malformed table value instead of throwing", () => {
    const listing = { available: true, sources: [{ source: "hex", value: { hex: "red" } }, { source: "sherwin-williams", value: { code: 1 } }] };
    const slots = bySource(buildFourSlots({ ...base, listing }));
    expect(slots.hex.filled).toBe(false);
    expect(slots["sherwin-williams"].filled).toBe(false);
  });

  it("the table can supply the AI picture when the editor has none", () => {
    const listing = { available: true, sources: [{ source: "approved-ai-image", value: { imageUrl: "https://cdn/row-ai.png" } }] };
    const slots = bySource(buildFourSlots({ ...base, aiImageUrl: null, aiAvailable: true, listing }));
    expect(slots["approved-ai-image"].imageUrl).toBe("https://cdn/row-ai.png");
  });
});

describe("paintForSlot", () => {
  it("color slots paint their hex, photo slots paint their picture", () => {
    const slots = bySource(buildFourSlots({ ...base, stored: { source: "hex", confirmed: true, chosenAt: NOW, hex: "#224466" } }));
    expect(paintForSlot(slots.hex)).toEqual({ kind: "hex", hex: "#224466" });
    expect(paintForSlot(slots["original-image"])).toEqual({ kind: "photo", url: "https://cdn/door.jpg" });
    expect(paintForSlot(slots["approved-ai-image"])).toEqual({ kind: "photo", url: "https://cdn/ai.png" });
    expect(paintForSlot(undefined)).toEqual({ kind: "photo", url: null });
  });
});
