import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FURNITURE_CATALOG, restoreSavedDesignerPlan, restoredFurniture, type PlacedCabinet, type RoomData } from "./design";

describe("Saved bathroom plans that still contain planning-zone data", () => {
  it("loads the real fixtures and ignores every zone row instead of crashing", () => {
    const saved = [
      { uid: "zone-vanity", defId: "bathroom-zone-vanity-60", x: 0, y: 0, rotation: 0 },
      { uid: "zone-toilet", defId: "bathroom-zone-toilet", x: 84, y: 12, rotation: 0, planningZoneSize: { version: 1, widthIn: 30, depthIn: 54 } },
      { uid: "zone-tub", defId: "bathroom-zone-tub-60", x: 0, y: 60, rotation: 0, planningZoneSize: { version: 1, widthIn: 72, depthIn: 36 } },
      { uid: "toilet", defId: "pelican-toilet-pl-12044", x: 12, y: 8, rotation: 0, pelicanCode: "PL-12044", pelicanProductId: 901, pelicanSellPrice: 388 },
      { uid: "tub", defId: "pelican-tub-pl-02146-59", x: 8, y: 64, rotation: 90, pelicanCode: 'PL-02146 59"' },
    ];

    const restored = restoredFurniture(saved);

    expect(restored.map((item) => item.uid)).toEqual(["toilet", "tub"]);
    expect(restored.every((item) => !item.defId.startsWith("bathroom-zone-"))).toBe(true);
    expect(restored.every((item) => !("planningZoneSize" in item))).toBe(true);
    // The moved toilet keeps its own coordinates and price identity.
    expect(restored[0]).toMatchObject({ x: 12, y: 8, pelicanCode: "PL-12044", pelicanProductId: 901, pelicanSellPrice: 388 });
    expect(restored[1].rotation).toBe(90);
  });

  it("survives garbage rows in an older saved payload", () => {
    const restored = restoredFurniture([
      null,
      "bathroom-zone-toilet",
      42,
      {},
      { uid: "not-in-catalog", defId: "bathroom-zone-something-else", x: 0, y: 0, rotation: 0 },
      { uid: "unknown-def", defId: "no-such-fixture", x: 0, y: 0, rotation: 0 },
      { defId: "pelican-toilet-pl-12044", x: Number.NaN, y: "bad", rotation: Number.POSITIVE_INFINITY },
    ]);

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ defId: "pelican-toilet-pl-12044", x: 0, y: 0, rotation: 0 });
    expect(typeof restored[0].uid).toBe("string");
    expect(restored[0].uid.length).toBeGreaterThan(0);
  });

  it("returns an empty list for a plan with no furniture at all", () => {
    expect(restoredFurniture(undefined)).toEqual([]);
    expect(restoredFurniture(null)).toEqual([]);
    expect(restoredFurniture("zones")).toEqual([]);
  });

  it("has no zone definitions left in the furniture catalog", () => {
    expect(FURNITURE_CATALOG.some((definition) => definition.id.startsWith("bathroom-zone-"))).toBe(false);
    for (const removedId of ["bathroom-zone-vanity-60", "bathroom-zone-toilet", "bathroom-zone-tub-60"]) {
      expect(FURNITURE_CATALOG.some((definition) => definition.id === removedId)).toBe(false);
    }
  });

  it("keeps the designer's save/restore paths going through the zone filter", () => {
    const source = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(source).toContain("restoreSavedDesignerPlan");
    expect(source).toContain("setFurniture(restoredFurniture(d.furniture))");
    expect(source).not.toContain("BathroomZoneAttributesDialog");
    expect(source).not.toContain("bathroomZoneWarningsByFixture");
  });

  it("reloads a bathroom exactly: no merged tubs, and the pantry stays where it was saved", () => {
    const tub = { uid: "tub", defId: "pelican-tub-pl-02146-59", x: 8, y: 40, rotation: 90, pelicanCode: 'PL-02146 59"' };
    const toilet = { uid: "toilet", defId: "pelican-toilet-pl-12044", x: 78, y: 8, rotation: 0, pelicanCode: "PL-12044" };
    const staleTubs = [
      tub,
      { uid: "oval", defId: "pelican-tub-pl-02138-59", x: 40, y: 30, rotation: 0, pelicanCode: 'PL-02138 59"' },
      { uid: "front", defId: "pelican-tub-pl-02563-59", x: 20, y: 70, rotation: 0, pelicanCode: 'PL-02563 59"' },
    ];
    const pantry = {
      uid: "pantry", cabinetId: 1, masterCode: "TC2484", description: "Tall pantry", placement: "tall",
      x: 100, y: 0, width: 24, depth: 24, height: 84, rotation: 0, wallId: "right", wallOffset: 72,
    } as PlacedCabinet;
    const room = {
      width: 144,
      depth: 120,
      ceilingHeight: 96,
      persistedEntities: { openings: [], sinks: [], island: null, furniture: staleTubs, ponyWalls: [] },
    } as RoomData;
    const first = restoreSavedDesignerPlan({ room, placed: [pantry], furniture: [tub, toilet] });
    const second = restoreSavedDesignerPlan({
      room: { ...room, persistedEntities: { ...room.persistedEntities!, furniture: first.furniture } },
      placed: first.placed,
      furniture: first.furniture,
    });

    expect(first.furniture.map((item) => item.uid)).toEqual(["tub", "toilet"]);
    expect(first.furniture.find((item) => item.uid === "tub")).toMatchObject({ x: 8, y: 40, rotation: 90 });
    expect(first.placed[0]).toMatchObject({ uid: "pantry", x: 100, y: 0, wallOffset: 72 });
    expect(second.furniture.map((item) => ({ uid: item.uid, x: item.x, y: item.y }))).toEqual(
      first.furniture.map((item) => ({ uid: item.uid, x: item.x, y: item.y })),
    );
    expect(second.placed[0]).toMatchObject({ x: 100, y: 0 });
  });
});
