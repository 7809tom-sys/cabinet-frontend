import { describe, expect, it } from "vitest";
import { verifiedSurfaceSpecificationUrl } from "./SurfacesPickerDialog";

describe("verifiedSurfaceSpecificationUrl", () => {
  it("returns the existing official sheet for exact verified kitchen and bathroom fixture variants", () => {
    expect(verifiedSurfaceSpecificationUrl({ pelicanCode: "PL-VS3218 18g" })).toContain("PL-VS3218.pdf");
    expect(verifiedSurfaceSpecificationUrl({ pelicanCode: "PL-8203 BN" })).toContain("PL-8203");
    expect(verifiedSurfaceSpecificationUrl({ pelicanCode: "PL-12044 MB" })).toContain("pl-12044-mb");
  });

  it("does not treat an image, catalog name, or unverified source code as a manufacturer specification sheet", () => {
    expect(verifiedSurfaceSpecificationUrl({ pelicanCode: "PL-FC3318SB White" })).toBeNull();
    expect(verifiedSurfaceSpecificationUrl({ pelicanCode: "PL-UNKNOWN" })).toBeNull();
    expect(verifiedSurfaceSpecificationUrl({ pelicanCode: null })).toBeNull();
  });
});
