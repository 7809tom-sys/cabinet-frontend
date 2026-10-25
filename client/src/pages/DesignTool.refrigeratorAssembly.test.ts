import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

function sourceBetween(startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function refrigeratorTransaction() {
  return sourceBetween(
    "const applyFridgeSurround = useCallback",
    '// ── One-click "Built-in Refrigerator + Pantry End" preset',
  );
}

describe("Design Tool independent refrigerator options", () => {
  it("keeps the selected panel choice and source-part identities", () => {
    const transaction = refrigeratorTransaction();
    expect(transaction).toContain("refrigeratorPanelMode: opts.panels");
    expect(transaction).toContain('refrigeratorAssemblyRole: "bridge"');
    expect(transaction).toContain('refrigeratorAssemblyRole: leftEdge ? "left-panel" : "right-panel"');
    expect(transaction).toContain("refrigeratorAssemblyId: fridge.uid");
  });

  it("replaces only prior parts selected for this refrigerator", () => {
    const transaction = refrigeratorTransaction();
    expect(transaction).toContain("const existingOptionUids = new Set(");
    expect(transaction).toContain("item.refrigeratorAssemblyId === fridge.uid");
    expect(transaction).toContain("const configuredPlaced = placed");
    expect(transaction).toContain("item.uid === fridge.uid ? configuredFridge : item");
    expect(transaction).not.toContain("fitRefrigeratorEnclosurePlacements(");
    expect(transaction).not.toContain("normalizeRefrigeratorBayUppers(previewResult.placed, room)");
  });

  it("uses exact refrigerator run measurements for independently selected options", () => {
    const transaction = refrigeratorTransaction();
    expect(transaction).toContain("const bay = refrigeratorBayRunMetrics(configuredFridge, room)");
    expect(transaction).toContain("const fridgeStart = bay.refrigeratorStart");
    expect(transaction).toContain("const fw = bay.refrigeratorWidth");
    expect(transaction).toContain("const fridgeCenterAlong = fridgeStart + fw / 2");
    expect(transaction).toContain("leftEdge ? bay.openingStart - pThick : bay.openingEnd");
  });

  it("uses source cabinet and panel dimensions while preserving an off-run panel for the shared fitter", () => {
    const transaction = refrigeratorTransaction();
    expect(transaction).toContain("const sourceDimensions = wallCabinetSkuDimensions(chosen.masterCode)");
    expect(transaction).toContain("const aWidth = sourceDimensions?.width");
    expect(transaction).toContain("wallPlacementAtUnbounded(along, pThick, pDepth, side, room)");
    expect(transaction).toContain("wallPlacementAt(along, eachFillerWidth, aDepth, side, room)");
    expect(transaction).not.toContain("? opts.bridgeWidth : fp.w");
  });

  it("keeps panels on their surround geometry and attaches cap fillers to the bridge", () => {
    const transaction = refrigeratorTransaction();
    expect(transaction).toContain("const pHeight = opts.above !== \"none\"");
    expect(transaction).toContain("const bridgeUid = makeUid()");
    expect(transaction).toContain("fillerForCabinetUid: bridgeUid");
  });

  it("fits only the refrigerator and the options selected in this accept action", () => {
    const transaction = refrigeratorTransaction();
    const fit = transaction.indexOf("const fittedOptions = fitExplicitRefrigeratorOptionPlacements(");
    const rejected = transaction.indexOf("if (requiredRejected.length > 0)");
    const commit = transaction.indexOf("const committedPreview = previewResult.placed");
    expect(fit).toBeGreaterThan(-1);
    expect(fit).toBeLessThan(rejected);
    expect(rejected).toBeGreaterThan(-1);
    expect(commit).toBeGreaterThan(rejected);
    expect(transaction.slice(rejected, commit)).toContain("The refrigerator and every existing cabinet remain exactly where they are.");
    expect(transaction.slice(rejected, commit)).toContain("return false;");
    expect(transaction).toContain("const optionalCapFillerUids = new Set(");
    expect(transaction).toContain("The selected refrigerator end panel needs clear space at this corner or wall end.");
    expect(transaction).toContain("Refrigerator and selected parts moved");
    expect(transaction).toContain("Existing cabinets stayed in place.");
  });

  it("keeps refrigerator panel choices in the insertion attributes dialog", () => {
    expect(source).not.toContain("const setRefrigeratorSidePanels = useCallback");
    expect(source).not.toContain("onSetRefrigeratorSidePanels={setRefrigeratorSidePanels}");
    expect(source).not.toContain("pendingRefrigeratorPanelToggle");
    expect(source).toContain("open={!!fridgeDialog}");
  });

  it("opens refrigerator attributes before adding optional source-priced parts", () => {
    const placement = sourceBetween("// Refrigerator dialog", "// Oven tall cabinet dialog");
    expect(placement).toContain("setFridgeDialog({ fridgeUid: finalCab.uid })");
    expect(placement).toContain("customer must\n\t      // choose its real appliance dimensions, cap, and enclosure panels");
    expect(source).not.toContain("autoRefrigeratorBayUid");
  });

  it("preloads source caps and panels into the shared materials price request", () => {
    const pricePairs = sourceBetween("const pricePairs = useMemo", "const { data: priceRows, isFetching");
    expect(source).toContain("const { data: refrigeratorSurroundCatalog } = trpc.design.surroundForFridge.useQuery");
    expect(pricePairs).toContain("...(refrigeratorParts?.deepAbove ?? [])");
    expect(pricePairs).toContain("...(refrigeratorParts?.endPanels ?? [])");
    expect(pricePairs).toContain("refrigeratorSurroundCatalog");
  });

  it("does not auto-add, reconstruct, or normalize refrigerator panels in restored designs", () => {
    expect(source).not.toContain("missingRefrigeratorPanelRoles(placed, candidate, room).length > 0");
    expect(source).not.toContain("refrigeratorPanelRepairAttemptedRef");
  });

  it("moves a refrigerator with only its explicitly configured source parts on plan, nudge, and 3D paths", () => {
    const move = sourceBetween("const moveCabinet = useCallback", "const swingSelected");
    const nudge = sourceBetween("const nudgeSelected = useCallback", "// Raise/lower the selected WALL cabinet");
    const dpad = sourceBetween("const moveCabinetFrom3D = useCallback", "const resetMountHeight");
    expect(move).toContain("commitConfiguredRefrigeratorCandidate(workingPrev, uid, movedCabinet, room)");
    expect(move).not.toContain("commitRefrigeratorAssemblyCandidate");
    expect(nudge).toContain("moveCabinet(");
    expect(dpad).toContain("commitConfiguredRefrigeratorCandidate(prev, uid, candidate, room)");
    expect(dpad).not.toContain("commitRefrigeratorAssemblyCandidate");
  });

  it("deletes only the selected refrigerator and never offers a bay delete action", () => {
    const deletion = sourceBetween("const requestCabinetDeletion = useCallback", "const unlockCornerSnap");
    expect(deletion).toContain("removeCabinetAndReleaseVoid(uid)");
    expect(source).not.toContain('data-testid="refrigerator-delete-dialog"');
    expect(source).not.toContain("Remove complete bay");
  });

  it("selects a refrigerator on one click and opens its options only through explicit Attributes editing", () => {
    const selection = sourceBetween("const selectCabinet = useCallback", "const selectSink = useCallback");
    const editor = sourceBetween("const openAttributes = useCallback", "const openMobileAttributes = useCallback");
    expect(selection).toContain("setSelectedUid(uid)");
    expect(selection).not.toContain("setFridgeDialog(");
    expect(editor).toContain("setFridgeDialog({ fridgeUid: uid })");
    expect(source).toContain("initialChoice={fridgeDialogInitialChoice}");
  });
});
