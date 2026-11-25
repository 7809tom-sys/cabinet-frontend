import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { PELICAN_CAD_ASSETS } from "./pelicanCadCatalog";
import {
  designerPelicanCadModel,
  pelicanCadDownloads,
  resolvePelicanCadCode,
} from "./pelicanCadModels";
import { orientManufacturerSink } from "./pelicanCadSinkMesh";

describe("Pelican CAD catalog mapping", () => {
  it("maps filename differences onto the catalog SKU and the corner or ADA variant", () => {
    expect(resolvePelicanCadCode("PL-HA108 R0 16g")).toEqual({ sku: "PL-HA108", variant: "r0" });
    expect(resolvePelicanCadCode("PL-HA108 R15 18g")).toEqual({ sku: "PL-HA108", variant: "r15" });
    expect(resolvePelicanCadCode("PL-HA109 ADA R0 18g")).toEqual({ sku: "PL-HA109", variant: "ada" });
    expect(resolvePelicanCadCode("HA108-0R")).toBeNull();
    expect(resolvePelicanCadCode('PL-VS3018 8" Deep')).toEqual({ sku: "PL-VS3018-8", variant: "standard" });
    expect(resolvePelicanCadCode("PL-VS3018 18g")?.sku).toBe("PL-VS3018");
  });

  it("selects the drawing that matches the placed sink and refuses a bad ADA mesh", () => {
    expect(designerPelicanCadModel({
      pelicanCode: "PL-HA108 R0 16g",
      pelicanProfileId: "pelican-pl-ha108-r0-stainless-undermount",
    })?.slug).toBe("pl-ha108-r0");
    expect(designerPelicanCadModel({
      pelicanProfileId: "pelican-pl-ha128-r15-stainless-double-bowl-farmhouse",
    })?.slug).toBe("pl-ha128-r15");
    expect(designerPelicanCadModel({
      pelicanProfileId: "pelican-pl-vs3218-stainless-undermount",
    })).toBeNull();
    expect(pelicanCadDownloads("PL-VS3218 18g").some((file) => file.cadUrl.endsWith(".dwg"))).toBe(true);
    expect(designerPelicanCadModel({ pelicanCode: "PL-100 Alpina" })?.slug).toBe("pl-100");
    expect(designerPelicanCadModel({
      pelicanCode: "PL-HA109 ADA",
      pelicanProfileId: "pelican-pl-ha109-ada-stainless-undermount",
    })?.variant).toBe("ada");
    expect(designerPelicanCadModel({ pelicanCode: "PL-VT3322-1 ADA" })).toBeNull();
    expect(designerPelicanCadModel({ pelicanCode: "PL-HA135 R0 16g" })).toBeNull();
    expect(designerPelicanCadModel({ pelicanCode: "PL-VS3018 8\" Deep" })).toBeNull();
    expect(pelicanCadDownloads("PL-VS3018 8\" Deep").map((file) => file.slug)).toEqual(["pl-vs3018-8"]);
  });

  it("lists the manufacturer files for a product and records which catalog SKUs have no row", () => {
    const downloads = pelicanCadDownloads("PL-HA108 R0 18g").map((file) => file.variant).sort();
    expect(downloads).toEqual(["ada", "r0", "r15"]);
    const missing = [...new Set(PELICAN_CAD_ASSETS.filter((asset) => asset.catalogCodes.length === 0).map((asset) => asset.sku))];
    expect(missing.sort()).toEqual(["PL-WS2819", "PL-WS3319", "WS-STRAINER"]);
    expect(PELICAN_CAD_ASSETS.find((asset) => asset.slug === "pl-vt3322-1-ada")?.designerReady).toBe(false);
    expect(PELICAN_CAD_ASSETS.filter((asset) => asset.designerReady && asset.glbUrl).length).toBeGreaterThan(30);
    expect(PELICAN_CAD_ASSETS.filter((asset) => asset.fileType === "dwg" && asset.designerReady)).toHaveLength(0);
  });
});

describe("manufacturer sink orientation", () => {
  function orientedSize(widthIn: number, depthIn: number, heightIn: number, up: "x" | "y" | "z") {
    const geometry = up === "y"
      ? new THREE.BoxGeometry(widthIn, heightIn, depthIn)
      : up === "z"
        ? new THREE.BoxGeometry(widthIn, depthIn, heightIn)
        : new THREE.BoxGeometry(heightIn, widthIn, depthIn);
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry));
    orientManufacturerSink(root, 1);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    return {
      widthIn: size.x * 12,
      depthIn: size.z * 12,
      heightIn: size.y * 12,
      top: bounds.max.y,
      centerX: (bounds.min.x + bounds.max.x) / 2,
    };
  }

  it.each([
    ["z", 32, 18, 9],
    ["y", 16, 18, 8],
    ["x", 32, 18, 9],
  ] as const)("stands a %s-up drawing on the counter with the long axis across the cabinet", (up, width, depth, height) => {
    const size = orientedSize(width, depth, height, up);
    expect(size.widthIn).toBeCloseTo(Math.max(width, depth), 4);
    expect(size.depthIn).toBeCloseTo(Math.min(width, depth), 4);
    expect(size.heightIn).toBeCloseTo(height, 4);
    expect(size.top).toBeCloseTo(0, 5);
    expect(size.centerX).toBeCloseTo(0, 5);
  });
});
