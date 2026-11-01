// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InheritedVendorOriginZips } from "@/components/doorStyles/InheritedVendorOriginZips";

afterEach(cleanup);

describe("Inherited vendor shipping origin badges", () => {
  it("renders the vendor coverage as read-only badges instead of a blank list", () => {
    render(<InheritedVendorOriginZips zips={["32256", "30301"]} />);
    expect(screen.getByText("Inherited from vendor: 32256, 30301")).toBeTruthy();
    const badges = screen.getAllByTestId("inherited-vendor-zip");
    expect(badges.map((badge) => badge.textContent)).toEqual(["32256", "30301"]);
    for (const badge of badges) {
      expect(badge.className).toContain("border-dashed");
      expect(badge.querySelector("button")).toBeNull();
    }
    expect(screen.getByTestId("inherited-vendor-zips").querySelector("button")).toBeNull();
    expect(screen.getByText(/not copied onto this style/)).toBeTruthy();
  });

  it("renders nothing when the vendor coverage field is missing", () => {
    const { container } = render(<InheritedVendorOriginZips zips={undefined} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(/Inherited from vendor/)).toBeNull();
  });
});
