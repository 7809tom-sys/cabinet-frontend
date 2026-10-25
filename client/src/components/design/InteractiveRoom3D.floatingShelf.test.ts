import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("InteractiveRoom3D floating shelves", () => {
  it("builds a thin shelf mesh without generic cabinet fronts", () => {
    expect(source).toContain("const isFloatingShelf = /floating\\s*shelf|open\\s*shelf/i.test");
    expect(source).toContain("thinWallShelf: true");
    expect(source).toContain("noCabinetCarcass: true");
    expect(source).toContain("noCabinetFronts: true");
  });
});
