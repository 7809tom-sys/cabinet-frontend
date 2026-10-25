import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/design/SurfacesPickerDialog.tsx"),
  "utf8",
);

describe("Surfaces picker final material contract", () => {
  it("explains that flooring and backsplash replacements apply to the final kitchen", () => {
    expect(source).toContain("A new flooring or backsplash choice replaces the prior material everywhere in the final kitchen.");
  });

  it("marks the selected backsplash as final rather than offering a second retained quote material", () => {
    expect(source).toContain('"Final 3D wall material"');
    expect(source).toContain("disabled={isActiveThreeDBacksplash}");
  });
});
