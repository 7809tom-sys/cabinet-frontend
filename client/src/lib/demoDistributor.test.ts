import { describe, expect, it } from "vitest";
import {
  DEMO_BRAND_NAME,
  DEMO_CATALOG,
  DEMO_DESIGNER_LABEL,
  DEMO_DISTRIBUTOR,
  DEMO_FAUCETS,
  DEMO_LINES,
  DEMO_ORDERS,
  DEMO_SINKS,
  DEMO_TYPE_GROUPS,
  DISTRIBUTOR_COMMISSION_RANGE,
  demoCommissionCents,
  demoDesignerPath,
  demoSinkBaseCompatibility,
  demoTypeGroupFor,
  filterCatalogForDistributor,
  formatPercent,
  groupLineProducts,
  isDistributorPreviewSection,
  productsForLine,
  summarizeDemoOrders,
} from "./demoDistributor";
import { verifiedPelicanSinkProfile } from "./pelicanFixtureProfiles";
import { DEMO_CATALOG_SOURCE_ROWS, DEMO_FIXTURE_SOURCE_ROWS } from "./demoDistributorCatalog.generated";

describe("demo distributor data", () => {
  it("uses the Cabinet Deals Demo Distributor branding and designer label", () => {
    expect(DEMO_DISTRIBUTOR.name).toBe("Cabinet Deals Demo Distributor");
    expect(DEMO_BRAND_NAME).toBe(DEMO_DISTRIBUTOR.name);
    expect(DEMO_DESIGNER_LABEL).toBe("Demo Distributor Designer");
  });

  it("has exactly three lines: white shaker, gray shaker and raised panel", () => {
    expect(DEMO_LINES.map((l) => l.id)).toEqual(["white-shaker", "gray-shaker", "raised-panel"]);
  });

  it("gives every line the full derived catalog, with no code dropped", () => {
    expect(DEMO_CATALOG_SOURCE_ROWS.length).toBeGreaterThan(400);
    const sourceCodes = DEMO_CATALOG_SOURCE_ROWS.map((r) => r.code).sort();
    for (const line of DEMO_LINES) {
      const codes = productsForLine(line.id).map((p) => p.sku).sort();
      expect(codes).toEqual(sourceCodes);
    }
  });

  it("includes the core USCD code families", () => {
    const codes = new Set(DEMO_CATALOG_SOURCE_ROWS.map((r) => r.code));
    for (const code of ["B12", "B24", "B36", "SB30", "SB33", "SB36", "FSB36", "3DB12", "3DB18", "3DB24", "LSB36", "BBC42", "W0930", "W3030", "W3630", "W3012", "W3015", "W2442", "WBC2730", "U188424", "O308424", "MB30", "MB33", "MO3036", "OE630", "CM8", "F342"]) {
      expect(codes.has(code), code).toBe(true);
    }
  });

  it("puts every product in exactly one of Bases, Walls, Talls or Specialties", () => {
    expect(DEMO_TYPE_GROUPS).toEqual(["Bases", "Walls", "Talls", "Specialties"]);
    for (const line of DEMO_LINES) {
      const products = productsForLine(line.id);
      const sections = groupLineProducts(products);
      expect(sections.map((s) => s.group)).toEqual([...DEMO_TYPE_GROUPS]);
      const placed = sections.flatMap((s) => s.subTypes.flatMap((sub) => sub.products));
      expect(placed.length).toBe(products.length);
      expect(new Set(placed.map((p) => p.sku)).size).toBe(products.length);
      expect(sections.every((s) => s.count > 0)).toBe(true);
    }
  });

  it("maps vanities and accessories to Specialties, walls to Walls and talls to Talls", () => {
    expect(demoTypeGroupFor({ kind: "base", category: "Vanity", subCategory: "Vanity Sink" })).toBe("Specialties");
    expect(demoTypeGroupFor({ kind: "base", category: "Base", subCategory: "Sink Base" })).toBe("Bases");
    expect(demoTypeGroupFor({ kind: "wall", category: "Wall", subCategory: "Bridge / Stacker" })).toBe("Walls");
    expect(demoTypeGroupFor({ kind: "tall", category: "Tall", subCategory: "Pantry" })).toBe("Talls");
    expect(demoTypeGroupFor({ kind: "accessory", category: "Molding", subCategory: "Crown Moulding" })).toBe("Specialties");
    expect(demoTypeGroupFor({ kind: "accessory", category: "Wall", subCategory: "Standard Wall" })).toBe("Walls");
  });

  it("prices each line with its own demo multiplier", () => {
    const white = productsForLine("white-shaker").find((p) => p.sku === "B24")!;
    const raised = productsForLine("raised-panel").find((p) => p.sku === "B24")!;
    expect(raised.priceCents).toBeGreaterThan(white.priceCents);
  });

  it("filters other suppliers' products out of the storefront", () => {
    const own = filterCatalogForDistributor(DEMO_CATALOG, DEMO_DISTRIBUTOR.id);
    expect(own.length).toBeLessThan(DEMO_CATALOG.length);
    expect(own.every((p) => p.distributorId === DEMO_DISTRIBUTOR.id)).toBe(true);
  });

  it("derives sinks and faucets from the existing sink and faucet catalog snapshot", () => {
    expect(DEMO_SINKS.length).toBe(DEMO_FIXTURE_SOURCE_ROWS.filter((r) => r.subCategory === "Sinks").length);
    expect(DEMO_FAUCETS.length).toBe(DEMO_FIXTURE_SOURCE_ROWS.filter((r) => r.subCategory === "Faucets").length);
    expect(DEMO_FAUCETS.length).toBeGreaterThan(0);
    expect(DEMO_FAUCETS.every((f) => f.category === "Sinks & Faucets" && f.subCategory === "Faucets")).toBe(true);
  });

  it("matches sinks and faucets to sink bases through the designer's sink-base rules", () => {
    const rows = demoSinkBaseCompatibility();
    const sb36 = rows.find((r) => r.baseCode === "SB36")!;
    expect(sb36.sinks.length).toBeGreaterThan(0);
    expect(sb36.faucets.length).toBeGreaterThan(0);
    expect(sb36.defaultSink).not.toBeNull();
    expect(sb36.defaultFaucet).not.toBeNull();
    // Farmhouse bases only take apron-front sinks.
    const fsb36 = rows.find((r) => r.baseCode === "FSB36")!;
    expect(fsb36.sinks.length).toBeGreaterThan(0);
    expect(fsb36.sinks.every((s) => {
      const profile = verifiedPelicanSinkProfile(s.pelicanCode);
      return profile?.sinkType === "farmhouse" || profile?.apronFront === true;
    })).toBe(true);
  });

  it("charges commission only on designer-assisted orders, never on direct CSV orders", () => {
    expect(demoCommissionCents(100_000, "designer", 0.03)).toBe(3_000);
    expect(demoCommissionCents(100_000, "designer", 0.04)).toBe(4_000);
    expect(demoCommissionCents(100_000, "csv", 0.04)).toBe(0);
    expect(DISTRIBUTOR_COMMISSION_RANGE).toEqual({ min: 0.03, max: 0.04 });
    expect(demoCommissionCents(100_000, "designer", 0.1)).toBe(4_000);
    expect(`${formatPercent(0.03)}–${formatPercent(0.04)}`).toBe("3%–4%");
    const summary = summarizeDemoOrders(DEMO_ORDERS, 0.04);
    expect(summary.totalCents).toBe(summary.designerCents + summary.csvCents);
  });

  it("keeps the designer inside the demo distributor context, never the sales demo store", () => {
    expect(demoDesignerPath()).toBe("/distributor-preview/design");
    expect(demoDesignerPath("gray-shaker")).toBe("/distributor-preview/design?line=gray-shaker&style=360001");
    expect(demoDesignerPath()).not.toContain("sales-demo");
  });

  it("validates preview sections", () => {
    expect(isDistributorPreviewSection("dashboard")).toBe(true);
    expect(isDistributorPreviewSection("admin")).toBe(false);
    expect(isDistributorPreviewSection(undefined)).toBe(false);
  });
});

describe("demo shop grouping fixes", () => {
  it("puts universal rollout trays and other organizers in Specialties › Organizers & Rollout Trays, never with corners", async () => {
    const { groupLineProducts, productsForLine, ORGANIZERS_SUBTYPE, CORNER_BASE_SUBTYPE, isDemoCornerBase } = await import("./demoDistributor");
    const sections = groupLineProducts(productsForLine("white-shaker"));
    const specialties = sections.find((s) => s.group === "Specialties")!;
    const organizers = specialties.subTypes.find((t) => t.name === ORGANIZERS_SUBTYPE)!;
    const orgCodes = organizers.products.map((p) => p.sku);
    for (const w of [15, 18, 21, 24, 27, 30, 33, 36]) expect(orgCodes).toContain(`UNIV-ROT${w}`);
    for (const code of ["RS24-TYPEA", "CHROME-TRAY33", "WOOD TRAY"]) expect(orgCodes).toContain(code);

    // Every item in any corner sub-group is a corner cabinet from the source data.
    const byCode = new Map(DEMO_CATALOG_SOURCE_ROWS.map((r) => [r.code, r]));
    for (const section of sections) {
      for (const sub of section.subTypes.filter((t) => /corner/i.test(t.name))) {
        for (const p of sub.products) {
          const row = byCode.get(p.sku)!;
          expect(row.kind, `${p.sku} in ${sub.name}`).not.toBe("accessory");
          if (sub.name === CORNER_BASE_SUBTYPE) expect(isDemoCornerBase(row), p.sku).toBe(true);
        }
      }
    }
  });

  it("moves wall end panels and skins listed under Wall out of the wall boxes", async () => {
    const { groupLineProducts, productsForLine } = await import("./demoDistributor");
    const sections = groupLineProducts(productsForLine("gray-shaker"));
    const walls = sections.find((s) => s.group === "Walls")!.subTypes.flatMap((t) => t.products.map((p) => p.sku));
    for (const code of ["WDEP42", "WDEP1212", "WEP1542", "WS1542"]) expect(walls).not.toContain(code);
    const panels = sections.find((s) => s.group === "Specialties")!.subTypes.find((t) => t.name === "Panels")!.products.map((p) => p.sku);
    for (const code of ["WDEP42", "WEP1542", "WS1542"]) expect(panels).toContain(code);
  });
});
