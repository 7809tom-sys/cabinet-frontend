import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const availabilitySource = readFileSync(resolve(process.cwd(), "client/src/lib/autoDesignAvailability.ts"), "utf8");

/** The More sheet is the only toolbar surface a phone or tablet can reach. */
function moreSheetSource(): string {
  const start = pageSource.indexOf("{/* ── Main \"More\" sheet");
  expect(start).toBeGreaterThan(0);
  const end = pageSource.indexOf("</SheetContent>", start);
  expect(end).toBeGreaterThan(start);
  return pageSource.slice(start, end);
}

describe("Auto-Design moved into the room layout popup (tablet and phone)", () => {
  it("no longer has its own More sheet row, but the tablet-workspace sheet still opens the Room layout popup", () => {
    const sheet = moreSheetSource();
    expect(sheet).not.toContain("more-sheet-auto-design");
    expect(sheet).not.toContain("openAutoDesign");
    expect(sheet).toContain("setLayoutStarterOpen(true)");
  });

  it("keeps the phone/portrait top-actions button, the only route below 1024px", () => {
    expect(pageSource).toContain('data-testid="mobile-auto-design-auto-build"');
    expect(pageSource).toContain("onClick={openAutoDesign}");
  });

  it("the popup opens the same dialog, closing itself first, with the same shared gate and notes", () => {
    const at = pageSource.indexOf("<RoomLayoutPopupPicker");
    expect(at).toBeGreaterThan(0);
    const wiring = pageSource.slice(at, at + 500);
    expect(wiring).toContain("setLayoutStarterOpen(false)");
    expect(wiring).toContain("setTimeout(openAutoDesign, 120)");
    expect(wiring).toContain("enabled: autoDesignControl.enabled");
    expect(wiring).toContain("note: autoDesignBlockedNote");
    expect(wiring).toContain("anchorNote: autoDesignAnchorNote");
    expect(availabilitySource).toContain('AUTO_DESIGN_EMPTY_PLAN_NOTE = "Needs an empty plan"');
    expect(availabilitySource).toContain("AUTO_DESIGN_REFRIGERATOR_ANCHOR_NOTE");
  });

  it("keeps the dialogs on the same kitchen-only gate; one always-on toolbar button, no More row", () => {
    // Tom (owner voice, Nov 24 2026, 12:36 PM CT): one always-visible toolbar Auto-Design button.
    expect(pageSource).toContain('data-testid="admin-auto-design-auto-build"');
    expect(pageSource).not.toContain('data-testid="more-sheet-auto-design"');
    expect(pageSource).not.toContain("autoDesignAudienceAllowed");
    expect(pageSource).toContain('const autoDesignAvailable = roomType === "kitchen";');
    // The toolbar opener can open the popup in any room; it then explains the block inside.
    expect(pageSource).toMatch(/\{\(autoDesignAvailable \|\| autoDesignOpen\) && \(\s*<AutoDesignDialog/);
    expect(pageSource).toContain("seatAutoDesignCornerFromCatalog");
    expect(pageSource).toMatch(/\{autoDesignAvailable && autoDesignCornerStage && \(\s*<AutoDesignCornerDialog/);
  });

  it("only the fullscreen (canvas-only) rail and 3D button still open Auto-Design directly", () => {
    expect(pageSource).toContain("onAutoDesign={autoDesignAvailable && canvasOnly ? openAutoDesign : undefined}");
    expect(pageSource).toContain("floatingAutoDesignAction={canvasOnly ? threeDFloatingAutoDesignAction : undefined}");
  });
});
