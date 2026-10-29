import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AffiliateTierCard } from "./AffiliateTierCard";

describe("AffiliateTierCard", () => {
  it("shows an assigned example tier without pretending the placeholder is a discount", () => {
    const html = renderToStaticMarkup(
      <AffiliateTierCard
        tier={{
          assigned: true,
          inactive: false,
          tierName: "Tier 1 (example)",
          summary: "×1.00 of Cabinetdealz cost · example placeholder",
          examplePlaceholder: true,
          volumeLabel: null,
        }}
      />,
    );
    expect(html).toContain("Your pricing tier");
    expect(html).toContain("Tier 1 (example)");
    expect(html).toContain("×1.00 of Cabinetdealz cost");
    expect(html).toContain("Example placeholder");
    expect(html).toContain("40/60");
  });

  it("explains the platform fallback when no tier is assigned", () => {
    const html = renderToStaticMarkup(
      <AffiliateTierCard
        tier={{
          assigned: false,
          inactive: false,
          tierName: null,
          summary: "No pricing tier assigned. Cabinet cost uses the platform affiliate markup until an administrator assigns a tier.",
          examplePlaceholder: false,
          volumeLabel: null,
        }}
      />,
    );
    expect(html).toContain("No pricing tier assigned");
  });
});
