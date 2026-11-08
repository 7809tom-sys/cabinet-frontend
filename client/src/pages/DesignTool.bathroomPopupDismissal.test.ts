import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

/** The JSX for one top-level Designer dialog, from `<Dialog open={...}` to its close. */
function dialogBlock(anchor: string): string {
  const start = source.indexOf(anchor);
  expect(start, `dialog anchored on ${anchor} should exist`).toBeGreaterThan(-1);
  const end = source.indexOf("</Dialog>", start);
  return source.slice(start, end);
}

describe("Every bathroom Designer popup can be closed", () => {
  it("never refuses a controlled dialog's close signal", () => {
    // A handler of the shape `(open) => { if (open) setOpen(true) }` accepts
    // "open" and silently drops "closed", so X, Escape and an outside tap all do
    // nothing. That was the vendor / door-style gate, which is opened
    // automatically and covers the whole Designer: the popup the owner could not
    // dismiss, and which left the page pointer-events:none behind it.
    const refusing = /onOpenChange=\{\(open\)\s*=>\s*\{\s*if\s*\(open\)\s*set[A-Za-z]+\(true\);\s*\}\}/.test(source);
    expect(refusing).toBe(false);
    expect(source).toContain("<Dialog open={catalogSetupOpen} onOpenChange={setCatalogSetupOpen}>");
  });

  it("gives the vendor gate its own visible close control", () => {
    const gate = dialogBlock("<Dialog open={catalogSetupOpen}");
    // A modal gate over the whole workspace must never depend on the user
    // noticing the corner X or knowing Escape.
    expect(gate).toContain("Continue to cabinet catalog");
    expect(gate).toContain("setCatalogSetupOpen(false)");
  });

  it("wires the sink/faucet picker to one close path that resets its step", () => {
    const picker = dialogBlock("<DraggableOverlayDialog");
    expect(picker).toContain("onBackdropClick={closeSinkBaseDialog}");
    // Every "Skip" is the same reset, so a dismissed popup cannot reopen mid-step.
    expect(picker).not.toContain('onClick={() => { setSinkBaseDialog(null); setRangeTopStep("choose"); }}');
    expect(picker).toContain("setPendingSinkProduct(null);");
    expect(picker).toContain("setPendingBottomGrid(null);");
  });

  it("keeps a Delete and a Close action inside the modal selected-item panel", () => {
    // On a tablet, selecting a cabinet opens this modal sheet, which locks the
    // page and covers the bottom strip's Delete. The panel has to carry both.
    expect(source).toContain('data-testid="mobile-selected-cabinet-delete"');
    expect(source).toContain('data-testid="mobile-selected-cabinet-close"');
    expect(source).toContain("deleteCabinet(selectedCab.uid);");
    expect(source).toContain("onClick={() => setCabEditSheetOpen(false)}");
  });

  it("closes the sink dialog and disarms the countertop when the last cabinet goes", () => {
    expect(source).toContain("if (!planSupportsCountertop(next, nextIsland ?? island)) {");
    expect(source).toContain("setSinkOptionsOpen(false);");
    expect(source).toContain("setSinkBaseDialog(null);");
  });
});
