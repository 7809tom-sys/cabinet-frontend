import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { makeShowerPanParts, makeShowerSurroundParts } from "@/components/design/showerFixtureGeometry";
import { verifiedPelicanBathroomFixtureProfile } from "@/lib/pelicanBathroomFixtureProfiles";
import { showerSurroundFinish, showerSurroundPattern } from "@/components/design/showerFinishes";

/**
 * The two defects that made the shower look like a washed-out white box:
 *
 * 1. The geometry builder wrote positions and indices but NO UV coordinates. A
 *    texture map with no UVs samples a single texel, so every finish rendered as
 *    flat colour no matter how good the texture was. That is why adding marble,
 *    subway and stone made no visible difference.
 * 2. Materials were transparent/near-white, so the panels read as a ghost box.
 */
const surround = verifiedPelicanBathroomFixtureProfile("PL-603696 Marble")!;
const pan = verifiedPelicanBathroomFixtureProfile("PL-016036C")!;

const map = new THREE.MeshPhysicalMaterial({ map: null });
const materials = { shell: map, metal: map, panel: map };

describe("shower geometry can carry a texture", () => {
  it("emits UV coordinates on every surround face", () => {
    const parts = makeShowerSurroundParts(surround, materials);
    expect(parts.length).toBeGreaterThan(0);
    for (const { part, mesh } of parts) {
      const uv = mesh.geometry.getAttribute("uv");
      const position = mesh.geometry.getAttribute("position");
      expect(uv, `${part} has no UV attribute`).toBeTruthy();
      // One UV per vertex, or the map cannot be sampled per corner.
      expect(uv.count, `${part} UV/vertex mismatch`).toBe(position.count);
    }
  });

  it("emits UV coordinates on every pan face", () => {
    for (const { part, mesh } of makeShowerPanParts(pan, materials)) {
      const uv = mesh.geometry.getAttribute("uv");
      expect(uv, `${part} has no UV attribute`).toBeTruthy();
      expect(uv.count).toBe(mesh.geometry.getAttribute("position").count);
    }
  });

  it("spreads UVs over a real range, not one repeated texel", () => {
    for (const { part, mesh } of makeShowerSurroundParts(surround, materials)) {
      const uv = mesh.geometry.getAttribute("uv");
      const us: number[] = [];
      const vs: number[] = [];
      for (let i = 0; i < uv.count; i += 1) {
        us.push(uv.getX(i));
        vs.push(uv.getY(i));
      }
      const uSpan = Math.max(...us) - Math.min(...us);
      const vSpan = Math.max(...vs) - Math.min(...vs);
      // A 60" x 36" panel is 5 ft x 3 ft, so at least one axis must span real distance.
      expect(Math.max(uSpan, vSpan), `${part} UVs are degenerate`).toBeGreaterThan(1);
    }
  });
});

describe("each published décor gets its own pattern", () => {
  it("maps Pelican's décor names to a real construction", () => {
    expect(showerSurroundPattern("PL-603696 Marble")).toBe("marble");
    expect(showerSurroundPattern("PL-603096 White Wood")).toBe("subway");
    expect(showerSurroundPattern("PL-603274 Grey Wood")).toBe("stone");
    expect(showerSurroundPattern("PL-603074 Brick")).toBe("subway");
  });

  it("gives the grey stone décor a genuinely darker tone than the white ones", () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return (r! * 0.2126 + g! * 0.7152 + b! * 0.0722) / 255;
    };
    const grey = showerSurroundFinish("PL-603274 Grey Wood");
    const marble = showerSurroundFinish("PL-603696 Marble");
    expect(luminance(grey.color)).toBeLessThan(luminance(marble.color));
    // Grey stone is a mid grey, not a near-white.
    expect(luminance(grey.color)).toBeLessThan(0.62);
  });
});
