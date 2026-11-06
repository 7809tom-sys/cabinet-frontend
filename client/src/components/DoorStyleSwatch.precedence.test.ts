import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveSwatch } from "./DoorStyleSwatch";

const source = readFileSync(resolve(process.cwd(), "client/src/components/DoorStyleSwatch.tsx"), "utf8");

describe("DoorStyleSwatch picture precedence", () => {
  it("uses the approved render first, then the door sample, then the thumbnail", () => {
    // Order is asserted on the exact expression because the component renders
    // an <img> for it; a reordered fallback shows a different door than the
    // Designer's face and material list for the same style.
    expect(source).toContain(
      "approvedDoorPhotoUrl(style) || style.doorSampleImageUrl || style.thumbnailImageUrl",
    );
    expect(source).not.toContain("style.thumbnailImageUrl || style.doorSampleImageUrl");
  });

  it("accepts an approved render only when a run was accepted", () => {
    expect(source).toContain("if (style.approvedVersionId == null) return null;");
  });

  it("keeps the finish swatch color resolution unchanged", () => {
    expect(resolveSwatch({ color: "#B8C8D0", ourName: "Oxford Mist" }).face).toBe("#b8c8d0");
    expect(resolveSwatch({ ourName: "Forest Rust" }).face).toBe("#b5603a");
  });
});
