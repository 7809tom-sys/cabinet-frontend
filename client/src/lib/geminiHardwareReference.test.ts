import { describe, expect, it } from "vitest";
import { geminiHardwareReference } from "./geminiHardwareReference";

 describe("Gemini hardware reference", () => {
  it("uses the locked Designer JPEG for the Bar Pulls planning style", () => {
    expect(geminiHardwareReference("bar-pull", ["b12", "w30"], null)).toMatchObject({
      id: "hardware:handles", role: "hardware/handles", label: "Bar Pulls",
      itemIds: ["b12", "w30"], referenceUrl: null,
      referenceSource: "locked-designer-jpeg",
    });
    expect(geminiHardwareReference("bar-pull", ["b12"], null)?.provenanceDetails).toContain("not a catalog SKU");
  });
  it.each(["knob", "cup-pull", "knob-and-pull"] as const)("preserves %s from the locked image without inventing a swatch", (style) => {
    expect(geminiHardwareReference(style, ["b12"], null)?.referenceSource).toBe("locked-designer-jpeg");
  });
  it("retains a real hardware product reference if supplied", () => {
    const url = "https://www.cabinetdealz.com/manus-storage/hardware.jpg";
    expect(geminiHardwareReference("bar-pull", ["b12"], url)).toMatchObject({ referenceSource: "catalog-image", referenceUrl: url });
  });
  it("records an exact selected catalog hardware label with its supplied image", () => {
    const reference = geminiHardwareReference("bar-pull", ["b12"], "/manus-storage/5319BG.jpg", "KEYGRANDE Bar pull · Brushed Gold · 5319BG");
    expect(reference).toMatchObject({ label: "KEYGRANDE Bar pull · Brushed Gold · 5319BG", referenceSource: "catalog-image" });
    expect(reference?.provenanceDetails).toContain("5319BG");
  });
  it("requires no hardware reference for None or an empty layout", () => {
    expect(geminiHardwareReference("none", ["b12"], null)).toBeNull();
    expect(geminiHardwareReference("bar-pull", [], null)).toBeNull();
  });
});
