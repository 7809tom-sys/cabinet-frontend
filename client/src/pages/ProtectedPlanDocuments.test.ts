import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const presentation = readFileSync(new URL("./DesignPresentation.tsx", import.meta.url), "utf8");
const fabricator = readFileSync(new URL("./FabricatorSheet.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../components/design/DesignActions.tsx", import.meta.url), "utf8");

describe("protected customer plan documents", () => {
  it("defaults a presentation to a protected visual proposal until the server authorizes the exact saved plan", () => {
    expect(presentation).toContain("trpc.design.documentAccess.useQuery");
    expect(presentation).toContain("savedDesignId !== null");
    expect(presentation).toContain("const hasFullDocumentAccess = documentAccess.data?.level === \"full\"");
    expect(presentation).toContain("Visual proposal only — detailed measurements and pricing unlock after purchase.");
    expect(presentation).toContain("autoDimensions={hasFullDocumentAccess}");
    expect(presentation).toContain("showProductCodes={hasFullDocumentAccess}");
    expect(presentation).toContain("{hasFullDocumentAccess && <div className=\"presentation-section mb-8 print-page-break\">");
  });

  it("keeps supplier-ready countertop sheets unavailable without full server-authorized access", () => {
    expect(fabricator).toContain("trpc.design.documentAccess.useQuery");
    expect(fabricator).toContain("if (!hasFullDocumentAccess)");
    expect(fabricator).toContain("Fabricator sheet protected");
  });

  it("passes the exact saved-plan identity to protected document routes and blocks pre-purchase build-sheet export", () => {
    expect(actions).toContain("const documentAccess = trpc.design.documentAccess.useQuery");
    expect(actions).toContain("Detailed build sheets unlock after purchase");
    expect(actions).toContain("/design/presentation${search}");
    expect(actions).toContain("/design/fabricator-sheet${search}");
    expect(actions).toContain("Administrators and authorized affiliate teams retain full access.");
  });
});
