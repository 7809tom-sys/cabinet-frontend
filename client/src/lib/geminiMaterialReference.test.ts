import { describe, expect, it } from "vitest";
import { geminiMaterialReference, geminiInferredMaterialLabels } from "./geminiMaterialReference";
const smoothTop = { id: "appliance:sb36:cooktop", role: "appliance", label: "CATALOG-APPLIANCE-smooth-top — Smooth-glass cooktop layout visual", itemIds: ["sb36:cooktop"], referenceUrl: null };
describe("Gemini material reference rule", () => {
  it("automatically predicts the screenshot’s no-swatch cooktop without inventing a swatch", () => {
    const reference = geminiMaterialReference(smoothTop);
    expect(reference).toMatchObject({ ...smoothTop, referenceSource: "locked-designer-jpeg" });
    expect(reference.provenanceDetails).toContain("Automatically render from the locked Designer image");
    expect(reference.provenanceDetails).toContain("Inferred appearance");
  });
  it.each(["cabinet door/finish", "countertop", "flooring", "backsplash", "sink", "faucet", "appliance"])("does not block missing %s", role => {
    expect(geminiMaterialReference({ ...smoothTop, role, referenceUrl: undefined }).referenceSource).toBe("locked-designer-jpeg");
  });
  it("preserves the exact supplied product URL, label and cabinet mappings", () => {
    const url = "https://www.cabinetdealz.com/manus-storage/exact.jpg";
    expect(geminiMaterialReference({ ...smoothTop, referenceUrl: url })).toMatchObject({ referenceUrl: url, referenceSource: "catalog-image", itemIds: smoothTop.itemIds });
  });
  it("keeps provenance bounded and treats blank swatches as absent", () => {
    const entry = geminiMaterialReference({ ...smoothTop, label: "Long label ".repeat(40), referenceUrl: "   " });
    expect(entry.provenance.length).toBeLessThanOrEqual(160);
    expect(entry.referenceUrl).toBeNull();
  });
  it("lists predictions once without mislabeling exact product samples", () => {
    const fallback = geminiMaterialReference(smoothTop);
    const exact = geminiMaterialReference({ ...smoothTop, label: "Exact product", referenceUrl: "https://www.cabinetdealz.com/exact.jpg" });
    expect(geminiInferredMaterialLabels([fallback, fallback, exact])).toEqual([smoothTop.label]);
    expect(geminiInferredMaterialLabels(null)).toEqual([]);
  });
});
