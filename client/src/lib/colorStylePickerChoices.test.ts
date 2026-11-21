import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  cabinetDoorSampleUrlsFromFacePlans,
  ensureSelectedColorStyleChoice,
  resolvedCatalogDoorSampleUrl,
  uniqueColorStylesForPicker,
} from "./colorStylePickerChoices";

const forestRust = {
  id: 330011,
  ourName: "Rustic Hickory",
  aliasName: "Forest Rust (Ashford)",
  distributorId: 210001,
  doorSampleImageUrl: "/uploads/forest-rust-door.jpg",
  styleVerified: true,
};
const otherLine = {
  id: 540005,
  ourName: "Luxe Classic",
  distributorId: 990001,
  doorSampleImageUrl: "/uploads/luxe.jpg",
  styleVerified: true,
};
const unverified = {
  id: 330099,
  ourName: "Draft Finish",
  distributorId: 210001,
  styleVerified: false,
};
const nameOf = (style: { aliasName?: string | null; ourName?: string | null; id: number }) =>
  style.aliasName || style.ourName || String(style.id);

describe("uniqueColorStylesForPicker", () => {
  it("keeps the selected Forest Rust style even when the catalog is scoped to another line", () => {
    const choices = uniqueColorStylesForPicker({
      styles: [forestRust, otherLine],
      selectedStyleIds: [330011],
      scopeDistributorId: 990001,
      nameOf,
    });
    expect(choices.map((style) => style.id)).toEqual([330011, 540005]);
  });

  it("still lists an unverified style when it is the one on the plan", () => {
    const choices = uniqueColorStylesForPicker({
      styles: [forestRust, unverified],
      selectedStyleIds: [330099],
      scopeDistributorId: 210001,
      nameOf,
    });
    expect(choices.map((style) => style.id)).toEqual([330099, 330011]);
  });

  it("hides unverified and out-of-scope styles that are not selected", () => {
    const choices = uniqueColorStylesForPicker({
      styles: [forestRust, otherLine, unverified],
      selectedStyleIds: [],
      scopeDistributorId: 210001,
      nameOf,
    });
    expect(choices.map((style) => style.id)).toEqual([330011]);
  });
});

describe("ensureSelectedColorStyleChoice", () => {
  it("adds the plan's selected style so the 3D picker does not show No color styles", () => {
    const choices = ensureSelectedColorStyleChoice([], [
      { id: 330011, name: "Forest Rust (Ashford)" },
    ]);
    expect(choices).toEqual([{ id: 330011, name: "Forest Rust (Ashford)" }]);
  });

  it("does not duplicate a style already in the list", () => {
    const choices = ensureSelectedColorStyleChoice(
      [{ id: 330011, name: "Forest Rust (Ashford)" }],
      [{ id: 330011, name: "Forest Rust (Ashford)" }],
    );
    expect(choices).toHaveLength(1);
  });
});

describe("resolvedCatalogDoorSampleUrl", () => {
  it("prefers the face-plan door image, then the 2D finish swatch", () => {
    expect(resolvedCatalogDoorSampleUrl("/faces/forest-rust.jpg", "/swatch/forest-rust.jpg"))
      .toBe("/faces/forest-rust.jpg");
    expect(resolvedCatalogDoorSampleUrl("  ", "/swatch/forest-rust.jpg"))
      .toBe("/swatch/forest-rust.jpg");
  });

  it("returns null when neither source has an image, so a catalog billboard may still appear", () => {
    expect(resolvedCatalogDoorSampleUrl(null, "  ")).toBeNull();
    expect(resolvedCatalogDoorSampleUrl(undefined, undefined)).toBeNull();
  });
});

describe("cabinetDoorSampleUrlsFromFacePlans", () => {
  it("gives an ordinary wall cabinet the design sample when its face plan has no doorUrl", () => {
    const urls = cabinetDoorSampleUrlsFromFacePlans(
      [
        ["w3330", { doorUrl: "/faces/w3330.jpg" }],
        ["over-dw", { doorUrl: null }],
      ],
      "/swatch/forest-rust.jpg",
    );
    expect(urls).toEqual({
      w3330: "/faces/w3330.jpg",
      "over-dw": "/swatch/forest-rust.jpg",
    });
  });

  it("omits a cabinet when there is no face image and no design fallback", () => {
    expect(cabinetDoorSampleUrlsFromFacePlans([["over-dw", { doorUrl: "" }]], null)).toEqual({});
  });
});

describe("DesignTool wiring", () => {
  const designTool = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");

  it("builds the toolbar and 3D picker lists from the helper so a selected plan style is included", () => {
    expect(designTool).toContain("uniqueColorStylesForPicker");
    expect(designTool).toContain("ensureSelectedColorStyleChoice");
    expect(designTool).toContain("colorStyleQuickChoices");
    expect(designTool).toContain("doorStyleChoices={colorStyleQuickChoices}");
    expect(designTool).toContain("<ColorStyleQuickPicker\n          styles={colorStyleQuickChoices}");
  });

  it("passes a resolved door sample, with a finish-swatch fallback, into the 3D view", () => {
    expect(designTool).toContain("resolvedCatalogDoorSampleUrl");
    expect(designTool).toContain("cabinetDoorSampleUrlsFromFacePlans");
    expect(designTool).toContain("catalogDoorSampleUrl={design3DDoorSampleUrl}");
  });
});
