/**
 * One door color source selector (Tom, Nov 12 2026; docs/rules/DOOR_COLOR_SOURCE_RULE.md).
 * Four mutually exclusive options; Sherwin-Williams and Hex only count after Confirm;
 * the supplier photo is the default and the fallback.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { designerFacePlan, selectedDoorColorFacePlan } from "../client/src/lib/designerFacePlan";
import { resolveCabinetFaceImages } from "./doorFaceRecognition";
import {
  DOOR_COLOR_SOURCE_STORAGE_KEY,
  awaitingConfirm,
  doorColorSourceReducer,
  doorColorSourceSaveMessage,
  effectiveDoorColorSource,
  initialDoorColorSourceDraft,
  parseDoorColorSourceSelection,
  readDoorColorSourceSelection,
  selectionForStyle,
  selectionFromServerFields,
  styleForDoorColorSource,
  writeDoorColorSourceSelection,
  type DoorColorSourceSelection,
  type SherwinWilliamsChoice,
} from "./doorColorSourceSelection";
import { WIZARD_DOOR_FINISH_STORAGE_KEY } from "./walzcraftDesignerPickup";

const NOW = "2026-11-12T18:45:00.000Z";

const VENDOR = {
  id: 920001,
  distributorId: 180001,
  distributorName: "Preston",
  styleCode: "VEND-RP",
  ourName: "Vendor Raised Sage",
  doorStyle: "Raised Panel",
  woodSpecies: "Painted MDF",
  finish: "Sage",
  color: "#9caf88",
  doorSampleImageUrl: "/uploads/vendor-raised-door.jpg",
  drawerSampleImageUrl: "/uploads/vendor-raised-drawer.jpg",
};

const WITH_ACCEPTED = {
  ...VENDOR,
  id: 920002,
  renderHex: "#445566",
  approvedVersionId: 77,
  approvedReferenceImageUrl: "/uploads/accepted-ai-render.png",
};

const SW_STAIN: SherwinWilliamsChoice = {
  finish: "stain",
  code: "SW3532",
  label: "SW 3532 Walnut",
  hex: "#5C4033",
  woodSpecies: "Dark Wood",
  grainDirection: "vertical",
  profileImageUrl: null,
};

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;
afterEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = originalLocalStorage;
});

describe("selector state", () => {
  it("defaults to the supplier photo when nothing is chosen", () => {
    const draft = initialDoorColorSourceDraft(null);
    expect(draft.active).toBe("original-image");
    expect(effectiveDoorColorSource(null).source).toBe("original-image");
  });

  it("Hex only counts after Confirm; until then the door uses the supplier photo", () => {
    let s = initialDoorColorSourceDraft(null);
    s = doorColorSourceReducer(s, { type: "choose", option: "hex", aiAvailable: false, now: NOW });
    expect(s.active).toBe("hex");
    expect(s.stored).toEqual({ source: "original-image", chosenAt: NOW });
    expect(awaitingConfirm(s)).toBe(true);
    s = doorColorSourceReducer(s, { type: "pendingHex", hex: "#ABCDEF" });
    expect(effectiveDoorColorSource(s.stored).source).toBe("original-image");
    s = doorColorSourceReducer(s, { type: "confirm", now: NOW });
    expect(s.stored).toEqual({ source: "hex", confirmed: true, chosenAt: NOW, hex: "#abcdef" });
    expect(awaitingConfirm(s)).toBe(false);
  });

  it("refuses to confirm an invalid hex", () => {
    let s = doorColorSourceReducer(initialDoorColorSourceDraft(null), { type: "choose", option: "hex", aiAvailable: false, now: NOW });
    s = doorColorSourceReducer(s, { type: "pendingHex", hex: "#12" });
    s = doorColorSourceReducer(s, { type: "confirm", now: NOW });
    expect(s.stored?.source).toBe("original-image");
    expect(s.notice).toMatch(/6-digit hex/);
  });

  it("an unconfirmed toggle turns back off when the selector is left", () => {
    let s = doorColorSourceReducer(initialDoorColorSourceDraft(null), { type: "choose", option: "sherwin-williams", aiAvailable: false, now: NOW });
    s = doorColorSourceReducer(s, { type: "pendingSherwin", color: SW_STAIN });
    s = doorColorSourceReducer(s, { type: "abandon" });
    expect(s.active).toBe("original-image");
    expect(s.pendingSherwin).toBeNull();
  });

  it("options are mutually exclusive: switching away from a confirmed Hex turns it off", () => {
    let s = initialDoorColorSourceDraft({ source: "hex", confirmed: true, chosenAt: NOW, hex: "#112233" });
    s = doorColorSourceReducer(s, { type: "choose", option: "sherwin-williams", aiAvailable: false, now: NOW });
    expect(s.stored?.source).toBe("original-image");
    s = doorColorSourceReducer(s, { type: "pendingSherwin", color: SW_STAIN });
    s = doorColorSourceReducer(s, { type: "confirm", now: NOW });
    expect(s.stored).toMatchObject({ source: "sherwin-williams", confirmed: true, color: { code: "SW3532", hex: "#5c4033" } });
  });

  it("re-choosing the confirmed option keeps it", () => {
    const stored: DoorColorSourceSelection = { source: "hex", confirmed: true, chosenAt: NOW, hex: "#112233" };
    const s = doorColorSourceReducer(initialDoorColorSourceDraft(stored), { type: "choose", option: "hex", aiAvailable: false, now: NOW });
    expect(s.stored).toEqual(stored);
  });

  it("Approved AI image with no accepted render says so and keeps the supplier photo", () => {
    const s = doorColorSourceReducer(initialDoorColorSourceDraft(null), { type: "choose", option: "approved-ai-image", aiAvailable: false, now: NOW });
    expect(s.notice).toMatch(/no accepted AI render/i);
    expect(s.stored?.source).toBe("original-image");
    const withAi = doorColorSourceReducer(initialDoorColorSourceDraft(null), { type: "choose", option: "approved-ai-image", aiAvailable: true, now: NOW });
    expect(withAi.stored?.source).toBe("approved-ai-image");
  });
});

describe("storage", () => {
  it("round-trips and never reads an unconfirmed Sherwin-Williams or Hex record", () => {
    const storage = memoryStorage();
    writeDoorColorSourceSelection(5, { source: "hex", confirmed: true, chosenAt: NOW, hex: "#aa0000" }, storage);
    expect(readDoorColorSourceSelection(5, storage)).toMatchObject({ source: "hex", hex: "#aa0000" });
    expect(parseDoorColorSourceSelection({ source: "hex", hex: "#aa0000" })).toBeNull();
    expect(parseDoorColorSourceSelection({ source: "sherwin-williams", color: SW_STAIN })).toBeNull();
    expect(parseDoorColorSourceSelection({ source: "bogus" })).toBeNull();
    writeDoorColorSourceSelection(5, null, storage);
    expect(readDoorColorSourceSelection(5, storage)).toBeNull();
  });
});

describe("color resolution: the explicit choice wins", () => {
  it("Original image strips a typed render hex and an accepted run", () => {
    const stripped = styleForDoorColorSource(WITH_ACCEPTED, { source: "original-image", chosenAt: NOW });
    expect(stripped.renderHex).toBeNull();
    expect(stripped.approvedVersionId).toBeNull();
    const plan = selectedDoorColorFacePlan(WITH_ACCEPTED, "base", { source: "original-image", chosenAt: NOW });
    expect(plan?.doorUrl).toBe("/uploads/vendor-raised-door.jpg");
    expect(plan?.drawerUrl).toBe("/uploads/vendor-raised-drawer.jpg");
  });

  it("Approved AI image uses the accepted render, or the supplier photo when none exists", () => {
    const ai = selectedDoorColorFacePlan(WITH_ACCEPTED, "base", { source: "approved-ai-image", chosenAt: NOW });
    expect(ai?.doorUrl).toBe("/uploads/accepted-ai-render.png");
    const none = selectedDoorColorFacePlan(VENDOR, "base", { source: "approved-ai-image", chosenAt: NOW });
    expect(none).toEqual(resolveCabinetFaceImages(VENDOR, "base"));
  });

  it("a confirmed Hex paints that hex as an opaque solid", () => {
    const plan = selectedDoorColorFacePlan(WITH_ACCEPTED, "base", { source: "hex", confirmed: true, chosenAt: NOW, hex: "#123456" });
    expect(plan?.dlcCrop?.solidColor).toBe("#123456");
    expect(plan?.dlcCrop?.grainUrl ?? null).toBeNull();
  });

  it("a confirmed Sherwin-Williams stain keeps a grain and tints toward the chip", () => {
    const plan = selectedDoorColorFacePlan(VENDOR, "wall", { source: "sherwin-williams", confirmed: true, chosenAt: NOW, color: { ...SW_STAIN, hex: "#5c4033" } });
    expect(plan?.dlcCrop?.solidColor).toBe("#5c4033");
    expect(plan?.drawerUrl).toBeNull();
  });

  it("designerFacePlan: nothing stored leaves the existing order unchanged", () => {
    (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
    expect(designerFacePlan(VENDOR, "base")).toEqual(resolveCabinetFaceImages(VENDOR, "base"));
    expect(designerFacePlan(WITH_ACCEPTED, "base")?.doorUrl).toBe("/uploads/accepted-ai-render.png");
  });

  it("designerFacePlan: a stored Original image choice beats an accepted render and a wizard record", () => {
    (globalThis as { localStorage?: Storage }).localStorage = memoryStorage({
      [DOOR_COLOR_SOURCE_STORAGE_KEY]: JSON.stringify({ [WITH_ACCEPTED.id]: { source: "original-image", chosenAt: NOW } }),
      [WIZARD_DOOR_FINISH_STORAGE_KEY]: JSON.stringify({ [WITH_ACCEPTED.id]: { ...SW_STAIN, finish: "paint", hex: "#ff0000" } }),
    });
    expect(designerFacePlan(WITH_ACCEPTED, "base")?.doorUrl).toBe("/uploads/vendor-raised-door.jpg");
  });

  it("designerFacePlan: a stored confirmed Hex beats a wizard record", () => {
    (globalThis as { localStorage?: Storage }).localStorage = memoryStorage({
      [DOOR_COLOR_SOURCE_STORAGE_KEY]: JSON.stringify({ [VENDOR.id]: { source: "hex", confirmed: true, chosenAt: NOW, hex: "#0a0b0c" } }),
      [WIZARD_DOOR_FINISH_STORAGE_KEY]: JSON.stringify({ [VENDOR.id]: { ...SW_STAIN, finish: "paint", hex: "#ff0000" } }),
    });
    expect(designerFacePlan(VENDOR, "base")?.dlcCrop?.solidColor).toBe("#0a0b0c");
  });
});


describe("server fields, with localStorage as fallback/cache", () => {
  it("selectionFromServerFields reads a confirmed hex, a Sherwin-Williams chip, and image modes", () => {
    expect(selectionFromServerFields({
      doorColorSource: "hex",
      doorColorSourceValue: { hex: "#AABBCC" },
      doorColorSourceUpdatedAt: NOW,
    })).toMatchObject({ source: "hex", confirmed: true, hex: "#aabbcc", chosenAt: NOW });
    expect(selectionFromServerFields({
      doorColorSource: "sherwin-williams",
      doorColorSourceValue: SW_STAIN,
      doorColorSourceUpdatedAt: NOW,
    })?.source).toBe("sherwin-williams");
    expect(selectionFromServerFields({ doorColorSource: "original-image", doorColorSourceUpdatedAt: NOW })?.source).toBe("original-image");
    expect(selectionFromServerFields({ doorColorSource: "approved-ai-image", doorColorSourceValue: null })?.source).toBe("approved-ai-image");
  });

  it("missing, NULL, or malformed server fields return null and never throw", () => {
    expect(selectionFromServerFields(undefined)).toBeNull();
    expect(selectionFromServerFields({})).toBeNull();
    expect(selectionFromServerFields({ doorColorSource: null, doorColorSourceValue: null, doorColorSourceUpdatedAt: null })).toBeNull();
    expect(selectionFromServerFields({ doorColorSource: "hex", doorColorSourceValue: { hex: "nope" } })).toBeNull();
    expect(selectionFromServerFields({ doorColorSource: "not-a-mode" })).toBeNull();
    expect(() => selectionFromServerFields({ doorColorSource: "hex", doorColorSourceValue: { get hex() { throw new Error("boom"); } } })).not.toThrow();
  });

  it("selectionForStyle prefers the server value over a stale localStorage cache", () => {
    const storage = memoryStorage({
      [DOOR_COLOR_SOURCE_STORAGE_KEY]: JSON.stringify({
        [VENDOR.id]: { source: "hex", confirmed: true, chosenAt: NOW, hex: "#111111" },
      }),
    });
    const style = {
      id: VENDOR.id,
      doorColorSource: "original-image" as const,
      doorColorSourceValue: null,
      doorColorSourceUpdatedAt: NOW,
    };
    expect(selectionForStyle(style, storage)?.source).toBe("original-image");
  });

  it("selectionForStyle falls back to localStorage when the server field is absent or NULL", () => {
    const storage = memoryStorage({
      [DOOR_COLOR_SOURCE_STORAGE_KEY]: JSON.stringify({
        [VENDOR.id]: { source: "hex", confirmed: true, chosenAt: NOW, hex: "#0a0b0c" },
      }),
    });
    expect(selectionForStyle({ id: VENDOR.id }, storage)).toMatchObject({ source: "hex", hex: "#0a0b0c" });
    expect(selectionForStyle({ id: VENDOR.id, doorColorSource: null, doorColorSourceValue: null }, storage)).toMatchObject({ source: "hex", hex: "#0a0b0c" });
  });

  it("designerFacePlan uses the server choice even when localStorage is empty", () => {
    (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
    const style = {
      ...VENDOR,
      doorColorSource: "hex" as const,
      doorColorSourceValue: { hex: "#123456" },
      doorColorSourceUpdatedAt: NOW,
    };
    expect(designerFacePlan(style, "base")?.dlcCrop?.solidColor).toBe("#123456");
  });

  it("designerFacePlan with no server fields still honors the localStorage cache", () => {
    (globalThis as { localStorage?: Storage }).localStorage = memoryStorage({
      [DOOR_COLOR_SOURCE_STORAGE_KEY]: JSON.stringify({
        [VENDOR.id]: { source: "hex", confirmed: true, chosenAt: NOW, hex: "#0a0b0c" },
      }),
    });
    expect(designerFacePlan(VENDOR, "base")?.dlcCrop?.solidColor).toBe("#0a0b0c");
  });
});

describe("a save that needs the 0280 SQL", () => {
  it("turns the backend's migration message into an instruction the operator can act on", () => {
    expect(doorColorSourceSaveMessage("Run migration 0280 before saving door color source")).toMatch(/0280 SQL has not been run/);
    expect(doorColorSourceSaveMessage("doorColorSource column missing: run 0280")).toMatch(/0280 SQL has not been run/);
  });

  it("leaves any other message alone, and never returns an empty notice", () => {
    expect(doorColorSourceSaveMessage("Door style name is required")).toBe("Door style name is required");
    expect(doorColorSourceSaveMessage("")).toMatch(/was not saved/);
    expect(doorColorSourceSaveMessage(null)).toMatch(/was not saved/);
  });
});

describe("AI generation is untouched", () => {
  it("the selector and its logic never call the AI image path", () => {
    const root = path.resolve(import.meta.dirname, "..");
    for (const file of ["shared/doorColorSourceSelection.ts", "client/src/components/admin/DoorColorSourceSelector.tsx"]) {
      const source = readFileSync(path.join(root, file), "utf8");
      expect(source).not.toMatch(/trpc|fetch\(|startGeminiImageTest|designPhotoRenders/);
    }
  });
});
