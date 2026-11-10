import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CABINET_DEALS_RESTOCKING_FEE,
  CABINET_DEALS_RETURN_RULES,
  DISTRIBUTOR_LEGAL_SEEDS,
  LEGAL_REPO_REFERENCES,
  PASTE_DISTRIBUTOR_TERMS,
  capturedSectionText,
  distributorTextContainsCabinetDealsFee,
  resolveDistributorSection,
  resolveLegalSection,
  splitCabinetDealsReturnRules,
} from "./distributorLegalTerms";

const sql = readFileSync(resolve(process.cwd(), "docs/sql/0274_distributor_legal_terms.tidb.sql"), "utf8");
const tabs = readFileSync(resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"), "utf8");
const adminPage = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");

describe("distributor legal terms", () => {
  it("lists the five distributors with U.S. Cabinet Depot first and Faircrest as Clark and Son", () => {
    expect(DISTRIBUTOR_LEGAL_SEEDS.map((seed) => seed.key)).toEqual([
      "us-cabinet-depot",
      "skyline",
      "faircrest",
      "milestone",
      "pelican",
    ]);
    expect(DISTRIBUTOR_LEGAL_SEEDS[0]?.name).toBe("U.S. Cabinet Depot");
    expect(DISTRIBUTOR_LEGAL_SEEDS.find((seed) => seed.key === "faircrest")?.legalName).toBe("Clark and Son");
    expect(DISTRIBUTOR_LEGAL_SEEDS.find((seed) => seed.key === "pelican")?.name).toBe("Pelican");
  });

  it("uses Tom's warranty badges and leaves the distributor warranty text alone", () => {
    const badge = (key: string) => DISTRIBUTOR_LEGAL_SEEDS.find((seed) => seed.key === key);
    expect(badge("us-cabinet-depot")?.warrantyBadge).toBe("Lifetime");
    expect(badge("skyline")?.warrantyBadge).toBe("One year");
    expect(badge("milestone")?.warrantyBadge).toBe("12 months");
    expect(badge("faircrest")?.warrantyBadge).toBeNull();
    expect(badge("pelican")?.warrantyBadge).toBeNull();

    const uscd = badge("us-cabinet-depot")!;
    const warranty = capturedSectionText(uscd.sections.warranty);
    expect(warranty).toContain("Limited Lifetime Warranty");
    expect(warranty).toContain("Brothers Global Inc, warrants");
    expect(warranty).not.toContain(CABINET_DEALS_RESTOCKING_FEE);
    expect(warranty).not.toContain("Return Merchandise Authorizations");
  });

  it("keeps U.S. Cabinet Depot shipping, returns, and warranty as separate captures", () => {
    const uscd = DISTRIBUTOR_LEGAL_SEEDS[0]!;
    const shipping = capturedSectionText(uscd.sections.shipping);
    const returns = capturedSectionText(uscd.sections.returns);
    expect(shipping).toContain("Shipped orders, with the exception of small parcel orders");
    expect(shipping).toContain("Cancellations made after an order has been loaded onto a carrier’s truck");
    expect(returns).toContain("All returns must be authorized by US Cabinet Depot prior to return shipment.");
    expect(returns).toContain("Qualifying returns will incur a 20% restocking fee.");
    expect(returns).not.toContain("Brothers Global Inc, warrants");
    expect(shipping).not.toContain("Return Merchandise Authorizations (RMA)");
    expect(uscd.sections.shipping[0]?.sourceUrl).toBe("https://www.uscabinetdepot.com/terms-and-conditions");
    expect(uscd.sections.returns[0]?.sourceUrl).toBe("https://www.uscabinetdepot.com/terms-and-conditions");
    expect(uscd.sections.warranty[0]?.sourceUrl).toBe("https://www.uscabinetdepot.com/warranty");
    expect(uscd.sections.warranty[0]?.capturedOn).toBe("2026-11-10");
  });

  it("does not put Cabinet Deals' spelled-out fee or the two return rules inside any distributor section", () => {
    for (const seed of DISTRIBUTOR_LEGAL_SEEDS) {
      for (const section of ["shipping", "returns", "warranty"] as const) {
        const text = capturedSectionText(seed.sections[section]);
        expect(distributorTextContainsCabinetDealsFee(text)).toBe(false);
        for (const rule of CABINET_DEALS_RETURN_RULES) {
          expect(text).not.toContain(rule);
        }
      }
    }
  });

  it("splits the shared Cabinet Deals rules so the restocking fee is its own line", () => {
    const split = splitCabinetDealsReturnRules(
      [...CABINET_DEALS_RETURN_RULES, CABINET_DEALS_RESTOCKING_FEE].join("\n"),
    );
    expect(split.rules).toEqual([...CABINET_DEALS_RETURN_RULES]);
    expect(split.restockingFee).toBe(CABINET_DEALS_RESTOCKING_FEE);
    expect(CABINET_DEALS_RESTOCKING_FEE).toContain("thirty percent (30%)");
  });

  it("shows the paste prompt when a section has no captured wording and no saved text", () => {
    expect(PASTE_DISTRIBUTOR_TERMS).toBe("paste distributor terms here");
    const resolved = resolveLegalSection("", undefined);
    expect(resolved.empty).toBe(true);
    expect(resolved.text).toBe("");
    expect(resolved.edited).toBe(false);
  });

  it("keeps an admin paste on that section only, with who updated it", () => {
    const uscd = DISTRIBUTOR_LEGAL_SEEDS[0]!;
    const rows = [{
      distributorKey: "us-cabinet-depot",
      sectionKey: "returns",
      bodyText: "Pasted return wording from the distributor.",
      updatedByName: "Tom",
      updatedAt: "2026-11-10T15:00:00.000Z",
    }];
    const returns = resolveDistributorSection(uscd, "returns", rows);
    const shipping = resolveDistributorSection(uscd, "shipping", rows);
    expect(returns.text).toBe("Pasted return wording from the distributor.");
    expect(returns.updatedByName).toBe("Tom");
    expect(returns.edited).toBe(true);
    expect(shipping.text).toContain("Shipped orders, with the exception of small parcel orders");
    expect(shipping.edited).toBe(false);
  });

  it("records where existing repo terms were found and does not treat them as the capture", () => {
    expect(LEGAL_REPO_REFERENCES.map((item) => item.path)).toEqual([
      "client/src/pages/ShippingPolicy.tsx",
      "client/src/pages/ReturnPolicy.tsx",
      "client/src/pages/Terms.tsx",
      "client/src/lib/pelicanSinkCatalogDescriptions.ts",
      "shared/pelicanComparablePackaging.ts",
    ]);
    const faircrestShipping = capturedSectionText(DISTRIBUTOR_LEGAL_SEEDS.find((seed) => seed.key === "faircrest")!.sections.shipping);
    expect(faircrestShipping).toContain("We can ship to virtually any address in the world.");
    expect(faircrestShipping).toContain("Most orders will be shipped on a pallet via LTL (Less Than Truck Load) carrier.");
    const faircrest = capturedSectionText(DISTRIBUTOR_LEGAL_SEEDS.find((seed) => seed.key === "faircrest")!.sections.returns);
    expect(faircrest).toContain("Clark and Son will deny your claim");
    expect(faircrest).toContain("effective 08/01/2022");
  });

  it("keeps Pelican's own 30% line inside Pelican's published paragraph and out of the Cabinet Deals spelling", () => {
    const pelican = DISTRIBUTOR_LEGAL_SEEDS.find((seed) => seed.key === "pelican")!;
    const returns = capturedSectionText(pelican.sections.returns);
    expect(returns).toContain("The product must be unopened and in good condition.");
    expect(returns).toContain("10 day return policy with a 30% restocking fee");
    expect(returns).not.toContain("thirty percent (30%)");
    expect(capturedSectionText(pelican.sections.warranty)).toContain("limited lifetime warranty for most of our products");
    expect(capturedSectionText(pelican.sections.shipping)).toContain("Products are delivered to the address provided by you");
  });

  it("adds the Legal tab only on the full admin panel", () => {
    expect(tabs).toContain('{ value: "legal", label: "Legal" }');
    expect(tabs).toContain('<TabsContent value="legal" className="mt-6"><AdminTabErrorBoundary tabName="Legal"><AdminTabHelp tab="legal" /><LegalAdmin /></AdminTabErrorBoundary></TabsContent>');
    const salesWorkspace = adminPage.slice(adminPage.indexOf("if (isSalesRep)"), adminPage.indexOf("if (isDesigner)"));
    const designerStart = adminPage.indexOf("if (isDesigner)");
    const designerWorkspace = adminPage.slice(designerStart, adminPage.indexOf("<AdminGroupedTabs"));
    expect(salesWorkspace).not.toContain("LegalAdmin");
    expect(salesWorkspace).not.toContain('value="legal"');
    expect(designerWorkspace).not.toContain("LegalAdmin");
    expect(designerWorkspace).not.toContain('value="legal"');
  });

  it("only adds rows in the TiDB file", () => {
    expect(sql).toContain("CREATE TABLE cabinet_dealz.distributor_legal_terms");
    expect(sql).toContain("INSERT IGNORE INTO cabinet_dealz.distributor_legal_terms");
    const statements = sql.replace(/--.*$/gm, "").replace(/ON UPDATE CURRENT_TIMESTAMP/gi, "");
    expect(statements).not.toMatch(/\b(DELETE|DROP|TRUNCATE|UPDATE)\b/i);
    for (const seed of DISTRIBUTOR_LEGAL_SEEDS) {
      expect(sql).toContain(`'${seed.key}'`);
      for (const section of ["shipping", "returns", "warranty"] as const) {
        expect(sql).toContain(`'${seed.key}', '${section}'`);
      }
    }
    expect(sql).toContain("'cabinet-deals', 'return-rules'");
  });
});
