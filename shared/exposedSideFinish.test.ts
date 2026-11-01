import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canHaveSkins } from "./canHaveSkins";
import { framelessExposedSidesMatchDoorFace } from "../client/src/lib/framelessExposedFinish";
import {
  CABINET_SIDE_PLACEHOLDER,
  doorPanelMedianHex,
  exposedSideSolidHex,
} from "./exposedSideFinish";

type CatalogStyle = {
  id: number;
  styleCode?: string;
  ourName?: string;
  aliasName?: string;
  name?: string;
  color?: string;
  renderHex?: string;
  woodSpecies?: string;
  boxConstruction?: string;
  overlayType?: string;
  finish?: string;
  doorStyle?: string;
  distributorId?: number;
};

const catalog = JSON.parse(readFileSync(new URL("./fixtures/doorStyleSideCatalog.json", import.meta.url), "utf8")) as CatalogStyle[];

function paint(width: number, height: number, rgb: [number, number, number], border: [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
      const [r, g, b] = edge ? border : rgb;
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return data;
}

describe("door panel color", () => {
  it("uses the center panel and ignores a pale frame", () => {
    const hex = doorPanelMedianHex(20, 30, paint(20, 30, [0x5e, 0x44, 0x28], [0xf4, 0xf1, 0xea]));
    expect(hex).toBe("#5e4428");
  });
});

describe("exposed sides for every catalog finish", () => {
  it("paints every non-skin style with the door color, not the catalog hex or the cream placeholder", () => {
    expect(catalog.length).toBeGreaterThan(100);
    const door = "#345678";
    for (const style of catalog) {
      const skins = canHaveSkins(style);
      const photoSides = framelessExposedSidesMatchDoorFace(style);
      if (skins || photoSides) continue;
      const side = exposedSideSolidHex({
        catalogHex: style.color ?? style.renderHex ?? "#998877",
        doorPanelHex: door,
        useDoorPhotoOnSides: false,
      });
      expect(side, style.ourName ?? style.aliasName).toBe(door);
      expect(side).not.toBe(CABINET_SIDE_PLACEHOLDER);
      expect(side).not.toBe("#ffffff");
      expect(side?.toLowerCase()).not.toBe((style.color ?? "").toLowerCase());
    }
  });

  it("leaves US Cabinet Depot photo sides and hickory frameless skins on their own paths", () => {
    const photo = catalog.filter((style) => framelessExposedSidesMatchDoorFace(style));
    const skins = catalog.filter((style) => canHaveSkins(style));
    for (const style of photo) {
      expect(exposedSideSolidHex({
        catalogHex: "#112233",
        doorPanelHex: "#345678",
        useDoorPhotoOnSides: true,
      })).toBeNull();
    }
    for (const style of skins) {
      expect(canHaveSkins(style)).toBe(true);
    }
    expect(skins.every((style) => /hickory/i.test(`${style.ourName ?? ""} ${style.aliasName ?? ""} ${style.woodSpecies ?? ""}`) || /hickory/i.test(style.finish ?? ""))).toBe(true);
  });

  it("does not flag Nimbus Gray, Natural Maple, or the reported Ashford finishes for skins", () => {
    const names = [
      "Nimbus",
      "Natural Maple",
      "Natura Maple",
      "Zenith Sage",
      "Villa Blanc",
      "Terra Shaker",
      "Sterling Pulse",
      "Slate Echo",
      "Silva Shaker",
      "Onyx Shadow",
      "Aura Cream",
    ];
    for (const name of names) {
      const style = catalog.find((entry) => `${entry.aliasName ?? ""} ${entry.ourName ?? ""}`.includes(name));
      expect(style, name).toBeTruthy();
      expect(canHaveSkins(style), name).toBe(false);
      expect(framelessExposedSidesMatchDoorFace(style), name).toBe(false);
      expect(exposedSideSolidHex({
        catalogHex: style?.color ?? "#c6b9a7",
        doorPanelHex: "#667788",
        useDoorPhotoOnSides: false,
      })).toBe("#667788");
    }
  });
});
