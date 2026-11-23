/**
 * Paint brand color source: parse, serialize, and hex validation.
 * Old Sherwin-Williams and plain hex rows stay what they were.
 */
import { describe, expect, it } from "vitest";
import { selectedDoorColorFacePlan } from "../client/src/lib/designerFacePlan";
import {
  PAINT_BRANDS,
  doorColorSourceReducer,
  doorColorSourceSelectionForSave,
  initialDoorColorSourceDraft,
  normalizeHex,
  parseDoorColorSourceSelection,
  parsePaintBrandColor,
  selectionForStyle,
  selectionFromServerFields,
  serializePaintBrandColor,
  styleForDoorColorSource,
  type SherwinWilliamsChoice,
} from "./doorColorSourceSelection";

const NOW = "2026-11-22T18:00:00.000Z";

const SW_STAIN: SherwinWilliamsChoice = {
  finish: "stain",
  code: "SW3532",
  label: "SW 3532 Walnut",
  hex: "#5C4033",
  woodSpecies: "Dark Wood",
  grainDirection: "vertical",
  profileImageUrl: null,
};

const ALABASTER = {
  brand: "Sherwin-Williams" as const,
  code: "SW 7012",
  name: "Alabaster",
  hex: "#F2F0EA",
  chosenAt: NOW,
};

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  } as unknown as Storage;
}

describe("paint brand parse and serialize", () => {
  it("offers exactly the six colorimeter brands", () => {
    expect([...PAINT_BRANDS]).toEqual([
      "Sherwin-Williams",
      "Behr",
      "Benjamin Moore",
      "Valspar",
      "PPG",
      "Clark + Kensington",
    ]);
  });

  it("serializes a confirmed brand color and lowercases the hex", () => {
    const stored = serializePaintBrandColor(ALABASTER);
    expect(stored).toEqual({
      source: "paint-brand",
      confirmed: true,
      chosenAt: NOW,
      kind: "paint-brand",
      brand: "Sherwin-Williams",
      code: "SW 7012",
      name: "Alabaster",
      hex: "#f2f0ea",
    });
    expect(parseDoorColorSourceSelection(stored)).toEqual(stored);
  });

  it("rejects a hex that is not #RRGGBB, an unknown brand, and a blank code or name", () => {
    expect(normalizeHex("#F2F0EA")).toBe("#f2f0ea");
    expect(normalizeHex("F2F0EA")).toBeNull();
    expect(normalizeHex("#fff")).toBeNull();
    expect(normalizeHex("#f2f0eagg")).toBeNull();
    expect(serializePaintBrandColor({ ...ALABASTER, hex: "f2f0ea" })).toBeNull();
    expect(serializePaintBrandColor({ ...ALABASTER, hex: "#xyzxyz" })).toBeNull();
    expect(serializePaintBrandColor({ ...ALABASTER, brand: "Glidden" })).toBeNull();
    expect(serializePaintBrandColor({ ...ALABASTER, code: "  " })).toBeNull();
    expect(serializePaintBrandColor({ ...ALABASTER, name: "" })).toBeNull();
    expect(serializePaintBrandColor({ ...ALABASTER, code: "C".repeat(33) })).toBeNull();
    expect(serializePaintBrandColor({ ...ALABASTER, name: "N".repeat(65) })).toBeNull();
    expect(serializePaintBrandColor({ ...ALABASTER, code: "C".repeat(32), name: "N".repeat(64) })?.code).toHaveLength(32);
    expect(parsePaintBrandColor({ kind: "other", brand: "Behr", code: "MQ3-07", name: "Alabaster", hex: "#f2f0ea", confirmed: true })).toBeNull();
  });

  it("saves a paint brand as a confirmed hex plus the brand record", () => {
    const stored = serializePaintBrandColor(ALABASTER)!;
    expect(doorColorSourceSelectionForSave(stored)).toEqual({
      source: "hex",
      confirmed: true,
      chosenAt: NOW,
      kind: "paint-brand",
      brand: "Sherwin-Williams",
      code: "SW 7012",
      name: "Alabaster",
      hex: "#f2f0ea",
    });
  });

  it("keeps a plain hex and an old Sherwin-Williams row unchanged", () => {
    expect(parseDoorColorSourceSelection({ source: "hex", confirmed: true, chosenAt: NOW, hex: "#AABBCC" })).toEqual({
      source: "hex",
      confirmed: true,
      chosenAt: NOW,
      hex: "#aabbcc",
    });
    const sw = parseDoorColorSourceSelection({ source: "sherwin-williams", confirmed: true, chosenAt: NOW, color: SW_STAIN });
    expect(sw).toMatchObject({ source: "sherwin-williams", color: { code: "SW3532", hex: "#5c4033", label: "SW 3532 Walnut" } });
    expect(doorColorSourceSelectionForSave(sw!)).toBe(sw);
  });

  it("reads a paint brand back from the color source columns, and still reads old rows", () => {
    expect(selectionFromServerFields({
      doorColorSource: "hex",
      doorColorSourceValue: { kind: "paint-brand", brand: "Behr", code: "MQ3-07", name: "Ultra Pure White", hex: "#F4F1EA" },
      doorColorSourceUpdatedAt: NOW,
    })).toMatchObject({
      source: "paint-brand",
      brand: "Behr",
      code: "MQ3-07",
      name: "Ultra Pure White",
      hex: "#f4f1ea",
    });
    expect(selectionFromServerFields({
      doorColorSource: "paint-brand",
      doorColorSourceValue: { kind: "paint-brand", brand: "PPG", code: "PPG1001-1", name: "Delicate White", hex: "#f3f0e7" },
      doorColorSourceUpdatedAt: NOW,
    })?.source).toBe("paint-brand");
    expect(selectionFromServerFields({
      doorColorSource: "hex",
      doorColorSourceValue: { hex: "#224466" },
      doorColorSourceUpdatedAt: NOW,
    })).toMatchObject({ source: "hex", hex: "#224466" });
    expect(selectionFromServerFields({
      doorColorSource: "sherwin-williams",
      doorColorSourceValue: SW_STAIN,
      doorColorSourceUpdatedAt: NOW,
    })?.source).toBe("sherwin-williams");
  });

  it("restores brand, code and name on reload when the server only kept the matching hex", () => {
    const storage = memoryStorage({
      "doorColorSourceSelection.v1": JSON.stringify({
        9: serializePaintBrandColor({ ...ALABASTER, brand: "Benjamin Moore", code: "OC-23", name: "Classic Gray" }),
      }),
    });
    expect(selectionForStyle({
      id: 9,
      doorColorSource: "hex",
      doorColorSourceValue: { hex: "#f2f0ea" },
      doorColorSourceUpdatedAt: NOW,
    }, storage)).toMatchObject({ source: "paint-brand", brand: "Benjamin Moore", code: "OC-23", name: "Classic Gray", hex: "#f2f0ea" });
    expect(selectionForStyle({
      id: 9,
      doorColorSource: "hex",
      doorColorSourceValue: { hex: "#112233" },
      doorColorSourceUpdatedAt: NOW,
    }, storage)).toMatchObject({ source: "hex", hex: "#112233" });
    expect(selectionForStyle({
      id: 9,
      doorColorSource: "sherwin-williams",
      doorColorSourceValue: SW_STAIN,
      doorColorSourceUpdatedAt: NOW,
    }, storage)?.source).toBe("sherwin-williams");
  });

  it("confirms only a complete paint brand, and that hex becomes the render hex", () => {
    let draft = doorColorSourceReducer(initialDoorColorSourceDraft(null), {
      type: "choose",
      option: "paint-brand",
      aiAvailable: false,
      now: NOW,
      hexSeed: "#f2f0ea",
    });
    expect(draft.stored).toEqual({ source: "original-image", chosenAt: NOW });
    expect(draft.pendingPaint?.hex).toBe("#f2f0ea");
    draft = doorColorSourceReducer(draft, { type: "confirm", now: NOW });
    expect(draft.stored?.source).toBe("original-image");
    draft = doorColorSourceReducer(draft, { type: "pendingPaint", patch: { brand: "Valspar", code: "7002-16", name: "Du Jour" } });
    draft = doorColorSourceReducer(draft, { type: "confirm", now: NOW });
    expect(draft.stored).toMatchObject({
      source: "paint-brand",
      kind: "paint-brand",
      brand: "Valspar",
      code: "7002-16",
      name: "Du Jour",
      hex: "#f2f0ea",
    });
    expect(styleForDoorColorSource({ id: 3, renderHex: "#000000", approvedVersionId: 4 }, draft.stored)).toMatchObject({
      renderHex: "#f2f0ea",
      approvedVersionId: null,
    });
    const plan = selectedDoorColorFacePlan(
      { id: 3, ourName: "Shaker", doorStyle: "Shaker", doorSampleImageUrl: "/uploads/door.jpg" },
      "base",
      draft.stored!,
    );
    expect(plan?.dlcCrop?.solidColor).toBe("#f2f0ea");
  });
});
