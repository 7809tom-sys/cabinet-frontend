/**
 * Door edit button cleanup (Tom, Nov 19 2026): a pencil on the Color style control, the
 * selected-cabinet Edit on mobile, return to the view the person left, and a price review
 * when one cabinet's finish changes. DesignTool is wired through tRPC, so like the other
 * DesignTool guards these read the source.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ColorStyleQuickPicker } from "@/components/design/ColorStyleQuickPicker";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const styles = [{ id: 390009, name: "Treasure Chest" }, { id: 390001, name: "Shaker White" }];

function between(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("pencil on the Color style control", () => {
  it("shows a pencil link to the door editor when an edit link is given and a style is chosen", () => {
    const html = renderToStaticMarkup(createElement(ColorStyleQuickPicker, { styles, value: 390009, onChange: () => {}, editHref: "/admin?editStyle=390009" }));
    expect(html).toContain('data-testid="color-style-quick-picker-edit"');
    expect(html).toContain('href="/admin?editStyle=390009"');
  });

  it("shows no pencil for a shopper (no link) or when no style is chosen", () => {
    expect(renderToStaticMarkup(createElement(ColorStyleQuickPicker, { styles, value: 390009, onChange: () => {} }))).not.toContain("-edit");
    expect(renderToStaticMarkup(createElement(ColorStyleQuickPicker, { styles, value: null, onChange: () => {}, editHref: "/admin?editStyle=1" }))).not.toContain("-edit");
  });

  it("the Designer passes the link only to an admin, with the return path", () => {
    const toolbar = between("<ColorStyleQuickPicker", "<ApproveDoorButton");
    expect(toolbar).toContain("editHref={isAdmin");
    expect(toolbar).toContain("returnTo: designerEditReturnUrl");
  });
});

describe("selected-cabinet Edit on mobile", () => {
  it("renders the same Edit button inside the mobile cabinet sheet, which is gated on isMobile", () => {
    const sheet = between("{isMobile && selectedCab && !drawMode && !measureMode && (", "</SheetHeader>");
    expect(sheet).toContain("<DoorStyleEditButton");
    expect(sheet).toContain('testId="selected-cabinet-edit-door-style-mobile"');
    expect(sheet).toContain("returnTo={designerEditReturnUrl}");
  });

  it("keeps the desktop Edit button where it was", () => {
    expect(source).toContain('testId="selected-cabinet-edit-door-style"');
  });
});

describe("return to the view the person left", () => {
  it("puts the current view in the return link", () => {
    const url = between("const designerEditReturnUrl = useMemo", "const threeDCabinetFinishPreviewOptions");
    expect(url).toContain("designWorkspaceViewParam(viewMode)");
    expect(url).toContain("[search, viewMode]");
  });

  it("no longer forces 3D when the person comes back", () => {
    const back = between("const uid = new URLSearchParams(search).get(\"selectCabinet\")", "publishDesignerMobileCartCount");
    expect(back).not.toContain('setViewMode("threeD")');
    expect(back).toContain("setViewMode(initialDesignWorkspaceView(search))");
  });
});

describe("price review when one cabinet's finish changes", () => {
  it("setCabinetStyle opens the same price review dialog as setSlotStyle, for that cabinet only", () => {
    const fn = between("const setCabinetStyle = useCallback", "// Change the DESIGN DEFAULT finish");
    expect(fn).toContain("planStyleReviewCandidates([cabinet]");
    expect(fn).toContain("setPendingPlanStyleSwitch({");
    expect(fn).toContain("cabinet: { uid: selectedUid, styleId: newStyleId }");
    // Nothing is written until the review is approved: the direct write is only the fallback.
    expect(fn.indexOf("setPendingPlanStyleSwitch")).toBeLessThan(fn.indexOf("setPlaced("));
  });

  it("the review looks at just that cabinet and approving writes just that cabinet's finish", () => {
    const review = between("const planSwitchReviewCabinets = useMemo", "const planSwitchNeedsPricingReview");
    expect(review).toContain("pendingPlanStyleSwitch.cabinet");
    const commit = between("const commitPendingStyleSwitch = useCallback", "const approvePlanSwitch = useCallback");
    expect(commit).toContain("cabinet.uid === oneCabinet.uid ? { ...cabinet, styleId: oneCabinet.styleId }");
    // Every approve path goes through it, none straight to the slot commit.
    expect(source.match(/commitPlanStyleSwitch\(pending\.slot/g) ?? []).toHaveLength(1);
  });
});
