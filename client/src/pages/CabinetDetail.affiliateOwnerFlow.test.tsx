import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { affiliateCabinetDetailHref } from "@/lib/affiliateCabinetDetailRoute";
import { PriceCard, resolveCabinetDetailViewerRole } from "./CabinetDetail";

const pricedAffiliateRow = {
  styleId: 330005,
  styleCode: "FS",
  name: "Fresh Sage",
  doorStyle: "Shaker",
  finish: "Fresh Sage",
  color: "#9AAE97",
  doorSampleImageUrl: null,
  roomSceneImageUrl: null,
  thumbnailImageUrl: null,
  listPrice: "753.39",
  adjustedListPrice: "372.93",
  wholesalePrice: null,
  contractorPrice: null,
  homeownerPrice: "372.93",
  yourCost: null,
  affiliateCost: "237.32",
  platformSku: "FS-W1230",
  leadTimeDays: 7,
  distributorId: 210001,
};

describe("affiliate owner cabinet-detail flow", () => {
  it("carries an exact card target into an affiliate owner price panel without exposing Administration cost", () => {
    const href = affiliateCabinetDetailHref({
      slug: "reaves-way-cabinet-shop",
      masterCode: "W-12-30",
      styleId: 330005,
      cabinetId: 9360055,
    });
    const viewerRole = resolveCabinetDetailViewerRole(false, pricedAffiliateRow.affiliateCost);
    const markup = renderToStaticMarkup(<PriceCard row={pricedAffiliateRow} tier="homeowner" viewerRole={viewerRole} />);

    expect(href).toBe("/store/reaves-way-cabinet-shop/catalog/W-12-30?style=330005&cabinetId=9360055");
    expect(viewerRole).toBe("affiliate-owner");
    expect(markup).toContain("Affiliate Cost");
    expect(markup).toContain("Sells At");
    expect(markup).toContain("Margin");
    expect(markup).not.toContain("My Cost");
  });

  it("keeps a dashed SKU in the same owner-only price flow", () => {
    const href = affiliateCabinetDetailHref({
      slug: "reaves-way-cabinet-shop",
      masterCode: "W-12-30",
      styleId: 330005,
    });
    const viewerRole = resolveCabinetDetailViewerRole(false, pricedAffiliateRow.affiliateCost);

    expect(href).toContain("/store/reaves-way-cabinet-shop/catalog/W-12-30?");
    expect(viewerRole).toBe("affiliate-owner");
  });
});
