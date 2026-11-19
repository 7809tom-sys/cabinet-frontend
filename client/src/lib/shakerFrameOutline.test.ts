import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  attachShakerFrameOutline,
  getShakerOutlinePolicy,
  liveShakerOutlineCount,
  outlineEdges,
  setShakerOutlinePolicy,
  shakerFrameFrontZ,
  shakerFrameOutlinePositions,
  shakerFrameEdgeColor,
  shakerOutlineColor,
  shakerOutlineStyle,
} from "./shakerFrameOutline";

const FRAME = { faceWidth: 1.5, faceHeight: 2.5, rail: 0.19, stile: 0.19, color: "#3a6ea5", proud: true };

afterEach(() => {
  setShakerOutlinePolicy({ enabled: true, tier: "high" });
});

describe("shaker generic image outline geometry", () => {
  it("is the outer rectangle plus the opening rectangle: 8 segments, 16 points", () => {
    const positions = shakerFrameOutlinePositions({ ...FRAME, z: 0.02 });
    expect(positions).toHaveLength(8 * 2 * 3);
    const xs = positions.filter((_, index) => index % 3 === 0).map(Math.abs);
    expect(Math.max(...xs)).toBeCloseTo(0.75, 6);
    expect(xs.filter((x) => Math.abs(x - (1.5 - 0.38) / 2) < 1e-6)).toHaveLength(8);
  });

  it("the phone tier draws the opening only", () => {
    const style = shakerOutlineStyle("mobile");
    expect(style).toMatchObject({ outer: false, opening: true });
    expect(shakerFrameOutlinePositions({ ...FRAME, z: 0, outer: style.outer, opening: style.opening })).toHaveLength(4 * 2 * 3);
    expect(shakerOutlineStyle("mobile").opacity).toBeLessThan(shakerOutlineStyle("high").opacity);
  });

  it("skips an opening that has closed up", () => {
    expect(shakerFrameOutlinePositions({ ...FRAME, faceWidth: 0.3, stile: 0.15, z: 0 })).toHaveLength(4 * 2 * 3);
  });

  it("sits in front of the rails' front plane for both rail depths", () => {
    expect(shakerFrameFrontZ(true)).toBeGreaterThan(0.031 / 2 + 0.0026 - 0.0001);
    expect(shakerFrameFrontZ(false)).toBeCloseTo(0.026 / 2 + 0.0006, 6);
    expect(shakerFrameFrontZ(true)).toBeGreaterThan(shakerFrameFrontZ(false));
  });
});

describe("shaker generic image outline color", () => {
  it("is darker than the paint, and lighter when the paint is already dark", () => {
    const paint = new THREE.Color("#d1c7b7");
    expect(shakerOutlineColor("#d1c7b7").r).toBeLessThan(paint.r);
    const dark = new THREE.Color("#101820");
    expect(shakerOutlineColor("#101820").r).toBeGreaterThan(dark.r);
  });
});

describe("frame edge color (Designer)", () => {
  it("is clearly darker than the paint on a light, a mid and a bright paint", () => {
    for (const hex of ["#d1c7b7", "#3a6ea5", "#f7f4ee"]) {
      const paint = new THREE.Color(hex);
      const edge = shakerFrameEdgeColor(hex, 0.45);
      expect(edge.r).toBeLessThan(paint.r);
      expect(edge.g).toBeLessThan(paint.g);
      expect(edge.b).toBeLessThan(paint.b);
    }
  });

  it("is lighter than a dark paint, and the phone tier is gentler than the desktop tier", () => {
    expect(shakerFrameEdgeColor("#101820", 0.45).r).toBeGreaterThan(new THREE.Color("#101820").r);
    expect(shakerOutlineStyle("mobile").darken).toBeGreaterThan(shakerOutlineStyle("high").darken);
  });
});

describe("attachShakerFrameOutline", () => {
  it("adds ONE merged line object to the frame, drawn as its own color with the tone map off", () => {
    const group = new THREE.Group();
    const lines = attachShakerFrameOutline(group, FRAME)!;
    expect(group.children).toEqual([lines]);
    expect(lines).toBeInstanceOf(THREE.LineSegments);
    const material = lines.material as THREE.LineBasicMaterial;
    expect(material.toneMapped).toBe(false);
    expect(material.transparent).toBe(true);
    expect(lines.userData.shakerFrameOutline).toBe(true);
  });

  it("owns its geometry and material: nothing is shared between frames", () => {
    const a = attachShakerFrameOutline(new THREE.Group(), FRAME)!;
    const b = attachShakerFrameOutline(new THREE.Group(), FRAME)!;
    expect(a.geometry).not.toBe(b.geometry);
    expect(a.material).not.toBe(b.material);
  });

  it("the toggle hides and shows outlines that are already built, with no rebuild", () => {
    const lines = attachShakerFrameOutline(new THREE.Group(), FRAME)!;
    expect(lines.visible).toBe(true);
    setShakerOutlinePolicy({ enabled: false });
    expect(lines.visible).toBe(false);
    const built = attachShakerFrameOutline(new THREE.Group(), FRAME)!;
    expect(built.visible).toBe(false);
    setShakerOutlinePolicy({ enabled: true });
    expect(lines.visible).toBe(true);
    expect(built.visible).toBe(true);
  });

  it("disposing the geometry (the Designer's disposeObject) forgets the outline", () => {
    const before = liveShakerOutlineCount();
    const lines = attachShakerFrameOutline(new THREE.Group(), FRAME)!;
    expect(liveShakerOutlineCount()).toBe(before + 1);
    lines.geometry.dispose();
    expect(liveShakerOutlineCount()).toBe(before);
  });

  it("follows the tier at build time", () => {
    setShakerOutlinePolicy({ tier: "mobile" });
    const phone = attachShakerFrameOutline(new THREE.Group(), FRAME)!;
    setShakerOutlinePolicy({ tier: "high" });
    const desktop = attachShakerFrameOutline(new THREE.Group(), FRAME)!;
    expect(phone.geometry.getAttribute("position").count).toBe(8);
    expect(desktop.geometry.getAttribute("position").count).toBe(16);
    expect(getShakerOutlinePolicy().tier).toBe("high");
  });
});

describe("outlineEdges (door audit and cabinet preview)", () => {
  it("is the per-piece edge overlay the audit always drew", () => {
    const lines = outlineEdges(new THREE.BoxGeometry(1, 1, 0.1), "#efe6cf");
    expect(lines.userData.shakerOutline).toBe(true);
    expect((lines.material as THREE.LineBasicMaterial).opacity).toBeCloseTo(0.85, 6);
  });
});
