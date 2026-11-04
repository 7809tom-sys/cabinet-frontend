/**
 * The Edit button that deep-links from a cabinet in the design view to its door
 * style editor, and back again.
 *
 * Three things have to hold or the button is a trap: the link must name the exact
 * style, it must carry a return path that cannot bounce someone off the site, and
 * it must never render for a shopper or for a cabinet with no style.
 */
import { describe, expect, it } from "vitest";
import {
  DOOR_STYLE_EDIT_FROM_DESIGNER,
  designReturnUrl,
  doorStyleEditUrl,
  readDoorStyleEditRequest,
  safeReturnPath,
  shouldOfferDoorStyleEdit,
} from "./doorStyleEditLink";

describe("the door style edit link", () => {
  it("names the exact style and the editor section", () => {
    const url = doorStyleEditUrl({ styleId: 330021, styleCode: "SH" })!;
    expect(url).toContain("tab=featured");
    expect(url).toContain("editStyle=330021");
    expect(url).toContain(`from=${DOOR_STYLE_EDIT_FROM_DESIGNER}`);
    expect(url.startsWith("/admin?")).toBe(true);
  });

  it("carries the cabinet and the return path so the design comes back to the same spot", () => {
    const url = doorStyleEditUrl({
      styleId: 330021,
      cabinetUid: "cab-7",
      cabinetCode: "SB30",
      returnTo: "/design?styleId=330021&zoom=3d",
    })!;
    expect(url).toContain("cabinet=cab-7");
    expect(url).toContain("cabinetCode=SB30");
    const parsed = new URL(url, "https://x.test");
    expect(parsed.searchParams.get("returnTo")).toBe("/design?styleId=330021&zoom=3d");
  });

  it("never carries an off-site return path", () => {
    expect(safeReturnPath("https://evil.test/steal")).toBeNull();
    expect(safeReturnPath("//evil.test/steal")).toBeNull();
    expect(safeReturnPath("/design?x=1")).toBe("/design?x=1");
    // A dropped return path means the editor falls back to its own default, never
    // to the supplied host.
    const url = doorStyleEditUrl({ styleId: 330021, returnTo: "//evil.test/x" })!;
    expect(url).not.toContain("evil.test");
  });

  it("returns null rather than a dead link when there is no style", () => {
    expect(doorStyleEditUrl({ styleId: null })).toBeNull();
    expect(doorStyleEditUrl({ styleId: 0 })).toBeNull();
    expect(doorStyleEditUrl({ styleId: Number.NaN })).toBeNull();
  });
});

describe("reading the request back", () => {
  it("round-trips a style and its cabinet", () => {
    const url = doorStyleEditUrl({
      styleId: 330021,
      styleCode: "SH",
      styleName: "Shaker Honey",
      cabinetUid: "cab-7",
      cabinetCode: "SB30",
      returnTo: "/design?styleId=330021",
      slot: "A",
    })!;
    const request = readDoorStyleEditRequest(url.split("?")[1])!;
    expect(request).toMatchObject({
      styleId: 330021,
      styleCode: "SH",
      styleName: "Shaker Honey",
      cabinetUid: "cab-7",
      cabinetCode: "SB30",
      returnTo: "/design?styleId=330021",
      slot: "A",
    });
  });

  it("ignores a link that did not come from the designer", () => {
    expect(readDoorStyleEditRequest("?tab=featured&editStyle=330021")).toBeNull();
    expect(readDoorStyleEditRequest("?from=designer-door&editStyle=not-a-number")).toBeNull();
    expect(readDoorStyleEditRequest("")).toBeNull();
    expect(readDoorStyleEditRequest(null)).toBeNull();
  });
});

describe("the return url after save", () => {
  it("reselects the cabinet that was being edited", () => {
    expect(designReturnUrl({ returnTo: "/design?styleId=330021", cabinetUid: "cab-7" }))
      .toBe("/design?styleId=330021&selectCabinet=cab-7");
  });

  it("keeps the design's own query and appends to it", () => {
    const url = designReturnUrl({ returnTo: "/design?a=1&b=2", cabinetUid: "cab-7" });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("a")).toBe("1");
    expect(params.get("b")).toBe("2");
    expect(params.get("selectCabinet")).toBe("cab-7");
  });

  it("falls back to the design page when no return path survived", () => {
    expect(designReturnUrl({ returnTo: "https://evil.test" })).toBe("/design");
    expect(designReturnUrl({ designPath: "/store/acme/design" })).toBe("/store/acme/design");
  });
});

describe("who gets the button", () => {
  it("offers it to an admin on a cabinet with a style", () => {
    expect(shouldOfferDoorStyleEdit({ isAdmin: true, styleId: 330021 })).toBe(true);
  });

  it("never offers it to a shopper", () => {
    expect(shouldOfferDoorStyleEdit({ isAdmin: false, styleId: 330021 })).toBe(false);
  });

  it("does not offer it when there is no style to open", () => {
    expect(shouldOfferDoorStyleEdit({ isAdmin: true, styleId: null })).toBe(false);
    expect(shouldOfferDoorStyleEdit({ isAdmin: true, styleId: 0 })).toBe(false);
  });
});
