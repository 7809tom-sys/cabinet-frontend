// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DesignerPriceVisibilityProvider } from "./designerPriceVisibility";
import { DesignMaterialsListDialog } from "@/components/design/DesignMaterialsListDialog";
import type { MaterialsListRow } from "./designMaterialsList";

afterEach(cleanup);

const rows: MaterialsListRow[] = [{
  label: "1", section: "cabinet", code: "B24", description: "Base 24", category: "Base", supplier: "Skyline",
  styleColor: "Shaker White", dimensions: "24 x 34.5 x 24", qty: 2, unitPrice: 300, lineTotal: 600, priceStatus: "priced", notes: "",
}];

function dialog() {
  return <DesignMaterialsListDialog open onOpenChange={() => {}} rows={rows} roomLabel="Kitchen" styleName="Shaker White" />;
}

describe("materials & parts list dialog", () => {
  it("shows unit price, line total and the priced total on normal designer routes", () => {
    render(dialog());
    expect(screen.getByText("Unit price")).toBeTruthy();
    expect(document.body.textContent).toContain("$600.00");
    expect(document.body.textContent).toContain("Priced total");
  });

  it("shows no price anywhere in the demo designer", () => {
    render(<DesignerPriceVisibilityProvider hidePrices>{dialog()}</DesignerPriceVisibilityProvider>);
    expect(screen.getByText("B24")).toBeTruthy();
    expect(screen.queryByText("Unit price")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$\s?\d/);
    expect(document.body.textContent).not.toContain("Priced total");
  });
});
