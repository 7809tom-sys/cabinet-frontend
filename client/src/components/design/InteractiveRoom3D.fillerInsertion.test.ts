import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("InteractiveRoom3D filler insertion transition", () => {
  it("animates only a safely inserted filler group and respects reduced motion", () => {
    expect(source).toContain("fillerInsertionTransition?: { uids: string[]; key: number } | null");
    expect(source).toContain("requested.has(String(node.userData.placedUid))");
    expect(source).toContain('window.matchMedia?.("(prefers-reduced-motion: reduce)").matches');
    expect(source).toContain("const durationMs = 280");
    expect(source).toContain("target.position.set(position.x, position.y - 0.045, position.z)");
    expect(source).toContain("target.scale.set(scale.x * 0.9, scale.y * 0.9, scale.z * 0.9)");
    expect(source).toContain("}, [fillerInsertionTransition?.key]);");
  });
});
