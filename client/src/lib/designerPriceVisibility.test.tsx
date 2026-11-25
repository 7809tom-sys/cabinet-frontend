import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesignerPriceVisibilityProvider, createPriceSafeToast, stripPriceText, useDesignerPricesHidden } from "./designerPriceVisibility";
import { ProductPhotoTile } from "@/components/design/ProductPhotoGrid";
import { buildSheetCsv, type BuildSheetArgs } from "@/components/design/DesignActions";
import { materialsListCsv, materialsListPrintHtml, type MaterialsListRow } from "./designMaterialsList";

const PRICE = /\$\s?\d/;

function Probe() {
  return <span>{useDesignerPricesHidden() ? "hidden" : "shown"}</span>;
}

function tile() {
  return <ProductPhotoTile testId="tile" name="Pelican PL-5141 sink" code="PL-5141" price="$412.00" selected={false} onSelect={() => {}} />;
}

describe("designer price visibility context", () => {
  it("shows prices by default (every route except the demo designer)", () => {
    expect(renderToStaticMarkup(<Probe />)).toContain("shown");
    expect(renderToStaticMarkup(<DesignerPriceVisibilityProvider hidePrices={false}><Probe /></DesignerPriceVisibilityProvider>)).toContain("shown");
  });

  it("hides prices only inside a hidePrices provider", () => {
    expect(renderToStaticMarkup(<DesignerPriceVisibilityProvider hidePrices><Probe /></DesignerPriceVisibilityProvider>)).toContain("hidden");
  });

  it("product photo tiles (sinks, faucets, fixtures) drop their price line when hidden", () => {
    const normal = renderToStaticMarkup(tile());
    const demo = renderToStaticMarkup(<DesignerPriceVisibilityProvider hidePrices>{tile()}</DesignerPriceVisibilityProvider>);
    expect(normal).toContain("$412.00");
    expect(demo).toContain("PL-5141");
    expect(demo).not.toMatch(PRICE);
  });
});

const buildArgs: BuildSheetArgs = {
  room: { width: 144, depth: 120 } as BuildSheetArgs["room"],
  styleName: "Shaker White",
  tier: "Homeowner",
  total: 1234.5,
  buildRows: [{ code: "B24", description: "Base 24", widthIn: 24, heightIn: 34.5, depthIn: 24, placement: "base", qty: 2, unitPrice: 300, discountPct: null }],
  extraLines: [{ label: "Crown", detail: "2 pcs" }],
};

describe("build sheet CSV", () => {
  it("keeps prices and the estimated total by default", () => {
    const csv = buildSheetCsv(buildArgs)!;
    expect(csv).toContain("Unit Price");
    expect(csv).toContain("600.00");
    expect(csv).toContain("Estimated Total");
    expect(csv).toContain("Pricing Tier");
  });

  it("leaves out every price column, the tier and the total when hidePrices is set", () => {
    const csv = buildSheetCsv({ ...buildArgs, hidePrices: true })!;
    expect(csv).toContain("B24");
    expect(csv).not.toContain("Unit Price");
    expect(csv).not.toContain("Line Total");
    expect(csv).not.toContain("Estimated Total");
    expect(csv).not.toContain("Pricing Tier");
    expect(csv).not.toContain("300.00");
    expect(csv).not.toContain("600.00");
    expect(csv).not.toContain("1234.50");
  });
});

const rows: MaterialsListRow[] = [{
  label: "1", section: "cabinet", code: "B24", description: "Base 24", category: "Base", supplier: "Skyline",
  styleColor: "Shaker White", dimensions: "24 x 34.5 x 24", qty: 2, unitPrice: 300, lineTotal: 600, priceStatus: "priced", notes: "",
}];

describe("materials list exports", () => {
  it("CSV and print keep prices by default", () => {
    expect(materialsListCsv(rows)).toContain("600.00");
    const html = materialsListPrintHtml({ rows });
    expect(html).toContain("Priced total");
    expect(html).toContain("$600.00");
  });

  it("CSV and print drop prices and the priced total when hidePrices is set", () => {
    const csv = materialsListCsv(rows, { hidePrices: true });
    expect(csv).toContain("B24");
    expect(csv).not.toContain("Unit Price");
    expect(csv).not.toContain("600.00");
    const html = materialsListPrintHtml({ rows, hidePrices: true });
    expect(html).toContain("B24");
    expect(html).not.toContain("Priced total");
    expect(html).not.toContain("Unit price");
    expect(html).not.toMatch(PRICE);
  });
});

describe("only the Demo Distributor Designer route hides prices", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const designTool = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");

  it("App.tsx passes hidePrices on exactly one DesignTool, inside /distributor-preview/design", () => {
    const mounts = app.match(/<DesignTool\b[^>]*\/>/g) ?? [];
    expect(mounts.length).toBeGreaterThan(1);
    const hidden = mounts.filter((mount) => /\bhidePrices\b/.test(mount));
    expect(hidden).toEqual(["<DesignTool catalogFilter={demoDesignerCatalogFilter} hidePrices />"]);
    const route = app.indexOf('<Route path="/distributor-preview/design">');
    const nextRoute = app.indexOf("<Route", route + 1);
    const at = app.indexOf(hidden[0]);
    expect(at).toBeGreaterThan(route);
    expect(at).toBeLessThan(nextRoute);
  });

  it("DesignTool defaults hidePrices to false and shares it through the provider", () => {
    expect(designTool).toContain("export default function DesignTool({ hidePrices = false, ...props }");
    expect(designTool).toContain("<DesignerPriceVisibilityProvider hidePrices={hidePrices}>");
  });

  it("the 3D view gets no order summary or line prices when prices are hidden", () => {
    expect(designTool.match(/orderSummary=\{hidePrices \? undefined : interactive3dOrderSummary\}/g)).toHaveLength(2);
    expect(designTool).not.toMatch(/orderSummary=\{interactive3dOrderSummary\}/);
    expect(designTool).toContain("const unitPrice = hidePrices || line.unitPrice == null");
  });

  it("designer toasts and Auto Design review text go through the price scrubber", () => {
    expect(designTool).toContain('import { toast as sonnerToast } from "sonner";');
    expect(designTool).toContain("const toast = createPriceSafeToast(sonnerToast, () => designerToastHidesPrices);");
    expect(designTool).not.toMatch(/import \{ toast \} from "sonner"/);
    expect(designTool).toContain("title: stripPriceText(finding.title), detail: stripPriceText(finding.detail)");
  });

  it("the running total, side-list line prices and the estimated total sit behind hidePrices", () => {
    expect(designTool).toContain('hidePrices ? <>Cabinet list</> : <>Price &amp; cart <span data-testid="tablet-running-total"');
    expect(designTool).toContain('{!hidePrices && <span className="font-serif text-2xl font-bold text-foreground">${total.toFixed(2)}</span>}');
    expect(designTool).toContain('{!hidePrices && <div className="text-right">');
    expect(designTool).toContain("if (sub <= 0 || hidePrices) return null;");
  });
});

describe("stripPriceText", () => {
  it("leaves sentences without amounts alone", () => {
    expect(stripPriceText("Wall cabinets placed on Wall 1.")).toBe("Wall cabinets placed on Wall 1.");
  });

  it("removes dollar amounts from Auto Design notes and toasts", () => {
    expect(stripPriceText("Budget friendly: the faucet was picked for you, no question asked: Pelican Pull-Down (PL-8369), $412.00, the lowest-priced faucet."))
      .toBe("Budget friendly: the faucet was picked for you, no question asked: Pelican Pull-Down (PL-8369), the lowest-priced faucet.");
    expect(stripPriceText("B24 replaced with priced B21 ($312.50). Placement re-run.")).toBe("B24 replaced with priced B21. Placement re-run.");
    expect(stripPriceText("3 connected MasterTrac bays · 9 exact SKU boards · $1,204.10 March 2022 List reference")).toBe("3 connected MasterTrac bays · 9 exact SKU boards March 2022 List reference");
    expect(stripPriceText("Both pieces are price-locked at $40.00 + $40.00; both supported.")).toBe("Both pieces are price-locked; both supported.");
    expect(stripPriceText("Custom +$75")).not.toMatch(PRICE);
  });

  it("price-safe toast scrubs only while hidden", () => {
    const calls: unknown[][] = [];
    const base = Object.assign((...args: unknown[]) => { calls.push(["toast", ...args]); }, {
      success: (...args: unknown[]) => { calls.push(["success", ...args]); },
      dismiss: () => "dismissed",
    });
    let hidden = false;
    const toast = createPriceSafeToast(base, () => hidden);
    toast.success("Swapped ($12.00).", { description: "Was $20.00 each" });
    hidden = true;
    toast.success("Swapped ($12.00).", { description: "Was $20.00 each" });
    toast("Total $99.00");
    expect(calls[0]).toEqual(["success", "Swapped ($12.00).", { description: "Was $20.00 each" }]);
    expect(calls[1]).toEqual(["success", "Swapped.", { description: "Was" }]);
    expect(calls[2]).toEqual(["toast", "Total"]);
    expect(toast.dismiss()).toBe("dismissed");
  });
});
