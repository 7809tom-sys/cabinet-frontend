/**
 * Regression for Nov 12 2026: after #388/#389 merged, the Designer showed no door
 * colors. The live cause was the backend (doorStyles.list failed with a 500 because
 * the 0280 columns were not in the database yet, so the Designer had no styles).
 * These tests pin the frontend half: once a style arrives, every door color source
 * mode, and an unset door, resolves to a real face and color in the stated order.
 */
import { afterEach, describe, expect, it } from "vitest";
import { designerFacePlan, type DesignerFaceStyle } from "../client/src/lib/designerFacePlan";
import { resolveDoorColor } from "./doorColorResolve";
import {
  DOOR_COLOR_SOURCE_STORAGE_KEY,
  readDoorColorSourceSelection,
  selectionForStyle,
  styleForDoorColorSource,
  type DoorColorSourceSelection,
} from "./doorColorSourceSelection";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

const storage = new MemoryStorage();
(globalThis as { localStorage?: unknown }).localStorage = storage;
afterEach(() => storage.clear());

/** The shape doorStyles.list returns, including the new 0280 fields left NULL. */
const LISTED: DesignerFaceStyle = {
  id: 920001,
  distributorId: 180001,
  styleCode: "VEND-SL",
  ourName: "Vendor Slab Walnut",
  doorStyle: "Slab",
  woodSpecies: "Walnut",
  finish: "Natural",
  color: "#6b4a2f",
  renderHex: null,
  approvedReferenceImageUrl: null,
  approvedVersionId: null,
  doorSampleImageUrl: "/uploads/vendor-slab-door.jpg",
  drawerSampleImageUrl: "/uploads/vendor-slab-drawer.jpg",
  thumbnailImageUrl: "/uploads/vendor-slab-thumb.jpg",
  ...({ doorColorSource: null, doorColorSourceValue: null, doorColorSourceUpdatedAt: null } as Record<string, null>),
} as DesignerFaceStyle;

const APPROVED: DesignerFaceStyle = {
  ...LISTED,
  id: 920002,
  renderHex: "#5a3d26",
  approvedVersionId: 77,
  approvedReferenceImageUrl: "/uploads/accepted-render.png",
} as DesignerFaceStyle;

function choose(styleId: number, selection: DoorColorSourceSelection) {
  storage.setItem(DOOR_COLOR_SOURCE_STORAGE_KEY, JSON.stringify({ [String(styleId)]: selection }));
}

describe("door color lookup after #388 / #389", () => {
  it("unset door: keeps the #388 order and shows the supplier image with a color", () => {
    expect(readDoorColorSourceSelection(LISTED.id)).toBeNull();
    const plan = designerFacePlan(LISTED, "base");
    expect(plan).not.toBeNull();
    expect(plan?.doorUrl).toBe("/uploads/vendor-slab-door.jpg");
    expect(resolveDoorColor(LISTED).appliedHex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("unset door with an accepted render: the accepted render still leads (unchanged #388 order)", () => {
    const plan = designerFacePlan(APPROVED, "base");
    expect(plan?.doorUrl).toBeTruthy();
    expect(resolveDoorColor(APPROVED).appliedHex.toLowerCase()).toBe("#5a3d26");
  });

  it("original-image: supplier photo, render hex and accepted run stripped", () => {
    const selection: DoorColorSourceSelection = { source: "original-image", chosenAt: "2026-11-12T19:00:00.000Z" };
    choose(APPROVED.id as number, selection);
    const plan = designerFacePlan(APPROVED, "base");
    expect(plan?.doorUrl).toBe("/uploads/vendor-slab-door.jpg");
    const stripped = styleForDoorColorSource(APPROVED, selection);
    expect(stripped.renderHex).toBeNull();
    expect(resolveDoorColor(stripped).appliedHex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("approved-ai-image: the accepted render; falls back to the supplier photo when none", () => {
    choose(APPROVED.id as number, { source: "approved-ai-image", chosenAt: "2026-11-12T19:00:00.000Z" });
    expect(designerFacePlan(APPROVED, "base")?.doorUrl).toBeTruthy();
    choose(LISTED.id as number, { source: "approved-ai-image", chosenAt: "2026-11-12T19:00:00.000Z" });
    expect(designerFacePlan(LISTED, "base")?.doorUrl).toBe("/uploads/vendor-slab-door.jpg");
  });

  it("confirmed hex: a face plan comes back and the style paints that hex", () => {
    const selection: DoorColorSourceSelection = { source: "hex", hex: "#224466", chosenAt: "2026-11-12T19:00:00.000Z" } as DoorColorSourceSelection;
    choose(LISTED.id as number, selection);
    expect(designerFacePlan(LISTED, "base")).not.toBeNull();
    expect(resolveDoorColor(styleForDoorColorSource(LISTED, selection)).appliedHex.toLowerCase()).toBe("#224466");
  });

  it("confirmed Sherwin-Williams: a face plan comes back and the style paints the chip hex", () => {
    const selection = {
      source: "sherwin-williams",
      chosenAt: "2026-11-12T19:00:00.000Z",
      color: { finish: "paint", code: "SW 7008", label: "Alabaster", hex: "#edeae0", woodSpecies: null, grainDirection: "none", profileImageUrl: null },
    } as DoorColorSourceSelection;
    choose(LISTED.id as number, selection);
    expect(designerFacePlan(LISTED, "base")).not.toBeNull();
    expect(resolveDoorColor(styleForDoorColorSource(LISTED, selection)).appliedHex.toLowerCase()).toBe("#edeae0");
  });

  it("no style at all (doorStyles.list failed) is the only way to get no face: designerFacePlan(null)", () => {
    expect(designerFacePlan(null, "base")).toBeNull();
  });

  it("server-saved choice (#391 fields from doorStyles.list) resolves with no localStorage", () => {
    const fromServer = {
      ...LISTED,
      doorColorSource: "hex",
      doorColorSourceValue: { hex: "#224466" },
      doorColorSourceUpdatedAt: "2026-11-12T19:00:00.000Z",
    } as DesignerFaceStyle;
    const selection = selectionForStyle(fromServer);
    expect(selection?.source).toBe("hex");
    expect(designerFacePlan(fromServer, "base")).not.toBeNull();
  });

  it("server fields NULL (0280 not run, or nothing chosen): unset door order, supplier image", () => {
    expect(selectionForStyle(LISTED)).toBeNull();
    expect(designerFacePlan(LISTED, "base")?.doorUrl).toBe("/uploads/vendor-slab-door.jpg");
  });
});
