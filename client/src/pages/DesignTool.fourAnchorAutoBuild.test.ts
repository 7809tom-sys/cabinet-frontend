import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const dialogSource = readFileSync(resolve(process.cwd(), "client/src/components/design/FourAnchorAutoBuildDialog.tsx"), "utf8");

describe("admin four-anchor Designer wiring", () => {
  it("exposes the action only for admins and disables it on a non-empty plan", () => {
    expect(pageSource).toContain("{isAdmin && (");
    expect(pageSource).toContain('data-testid="admin-four-anchor-auto-build"');
    expect(pageSource).toContain("disabled={placed.length > 0 || layoutLocked}");
    expect(pageSource).toContain("buildFourAnchorAutoLayout");
  });

  it("requires the four measured anchors and explicit layout controls in the popup", () => {
    expect(dialogSource).toContain("layoutType");
    expect(dialogSource).toContain("originCorner");
    expect(dialogSource).toContain("runDirection");
    expect(dialogSource).toContain("sink");
    expect(dialogSource).toContain("stove");
    expect(dialogSource).toContain("dishwasher");
    expect(dialogSource).toContain("refrigerator");
    expect(dialogSource).toContain('data-testid="four-anchor-build-submit"');
  });

  it("makes the wall choice and its measurement datum explicit for every appliance row", () => {
    expect(dialogSource).toContain("Place on wall");
    expect(dialogSource).toContain("Center from selected wall start (in.)");
    expect(dialogSource).toContain("Choose from up to six real room walls for each appliance");
    expect(dialogSource).toContain("Sink base — place on wall");
    expect(dialogSource).toContain("Refrigerator — place on wall");
    expect(dialogSource).not.toContain("RUN / X");
    expect(dialogSource).not.toContain("DEPTH / Y");
  });

  it("shows the same colored Wall 1–6 map on the Floor Plan only while Four-Anchor setup is open", () => {
    expect(pageSource).toContain("buildFourAnchorWallGuides");
    expect(pageSource).toContain("fourAnchorWallGuides");
    expect(pageSource).toContain("onWallGuideChange");
    expect(pageSource).toContain("setViewMode(\"plan\")");
  });

  it("keeps the six-wall sample room inside the admin-only empty-plan Four-Anchor workflow", () => {
    expect(pageSource).toContain("makeFourAnchorSixWallTrainingRoom");
    expect(pageSource).toContain("loadFourAnchorSixWallTrainingRoom");
    expect(pageSource).toContain("onLoadSixWallTrainingRoom={loadFourAnchorSixWallTrainingRoom}");
    expect(pageSource).toContain("A training room can only be loaded into an empty Designer");
    expect(dialogSource).toContain("four-anchor-load-six-wall-training-room");
  });

  it("keeps the sink-base workflow required but allows an explicitly omitted range, dishwasher, or refrigerator without forcing a palette or refrigerator bay", () => {
    expect(dialogSource).toContain("Do not add Range / stove");
    expect(dialogSource).toContain("Do not add Dishwasher");
    expect(dialogSource).toContain("Do not add Refrigerator");
    expect(pageSource).toContain('const refrigeratorRequested = result.plan.anchors.some((anchor) => anchor.kind === "refrigerator")');
    expect(pageSource).toContain("if (refrigeratorRequested && (!fridgeParts?.deepAbove?.length || !fridgeParts.endPanels?.length))");
    expect(pageSource).toContain("if (refrigerator) {");
  });

  it("offers a left or right sink-adjacent dishwasher choice when no exact center is entered", () => {
    expect(dialogSource).toContain("Dishwasher position");
    expect(dialogSource).toContain("Left of sink");
    expect(dialogSource).toContain("Right of sink");
    expect(dialogSource).toContain("dishwasherSide");
    expect(dialogSource).toContain("Optional exact dishwasher center");
  });

  it("collects a selected sink base and documents the selected refrigerator enclosure instead of using generic floor appliances", () => {
    expect(dialogSource).toContain("Sink base size");
    expect(dialogSource).toContain("SB{width}");
    expect(dialogSource).toContain("36″ refrigerator");
    expect(dialogSource).toContain("Two source-priced side panels");
    expect(dialogSource).toContain("Matching source-priced 36″ cabinet above");
    expect(pageSource).toContain("No source-priced SB${sinkBaseWidth} sink base");
    expect(pageSource).toContain("makeDefaultSinkForCabinet(sinkBase");
    expect(pageSource).toContain("buildMandatoryFourAnchorRefrigeratorBay");
  });

  it("collects the requested 30, 36, or 42 inch wall-cabinet height and keeps submit failures visible", () => {
    expect(dialogSource).toContain("Wall-cabinet height");
    expect(dialogSource).toContain("([30, 36, 42] as const)");
    expect(dialogSource).toContain("height}″ wall cabinets");
    expect(dialogSource).toContain("30″, 36″, or 42″");
    expect(dialogSource).toContain("wallCabinetHeightIn");
    expect(dialogSource).toContain('data-testid="four-anchor-build-error"');
  });

  it("resolves the selected SB width only to a straight sink base and never fills a wall gap with a corner SKU", () => {
    expect(pageSource).toContain("const straightBaseCatalog = autoBuildStraightBaseCatalog(pool);");
    // The sink base is chosen by the shared picker: REGULAR by default (never the farmhouse apron-front base,
    // a vanity or a corner sink box) and farmhouse only on an explicit request.
    expect(pageSource).toContain("pickFourAnchorSinkBase(pool, sinkBaseWidth, sinkBaseKind)");
    expect(pageSource).toContain('input.sinkBaseKind ?? "regular"');
    // The largest-first fill now runs through the range-aware planner (which calls autoFillSpan with the same strategy and
    // the same straight-base catalog) so a range always gets a 15-inch-or-wider cabinet on each side.
    expect(pageSource).toContain("planFourAnchorBaseSegment({");
    expect(pageSource).toContain("catalog: stage.straightBaseCatalog");
    expect(pageSource).not.toContain('autoFillSpan(segment.length, "kitchen", pool)');
  });

  it("uses the existing wall and collision engines for selected-wall fill, never a hard-coded bottom-wall run", () => {
    expect(pageSource).toContain("freeSegmentsOnWall(");
    expect(pageSource).toContain("wallPlacementAt(along, width, depth, wallId, room)");
    expect(pageSource).toContain("appendCollisionFreePlacements(working, [candidate], room)");
    expect(pageSource).toContain("subtractAnchorRunReservations");
    expect(pageSource).toContain("refrigeratorReservation.start");
    expect(pageSource).toContain("refrigeratorReservation.end");
    expect(pageSource).not.toContain("y: room.depth - STD.BASE_DEPTH");
  });

  it("seats the measured appliances before prompting for catalog-backed room corners and filling the remaining runs", () => {
    expect(pageSource).toContain("setFourAnchorCornerStage");
    expect(pageSource).toContain("FourAnchorCornerSelectionDialog");
    expect(pageSource).toContain("fourAnchorCornerSlots(input.layoutType, {");
    expect(pageSource).toContain("wallIds: selectedWalls, room, originCorner: input.originCorner, runDirection: input.runDirection");
    expect(pageSource).toContain("nextAvailableRoomCornerPlacement");
    expect(pageSource).toContain("completeFourAnchorAutoLayout");
    expect(pageSource).toContain("A corner cabinet is required at every Four-anchor L/U corner");
  });

  it("runs aligned source-priced wall cabinets only after required corners and regular base runs", () => {
    const completion = pageSource.slice(pageSource.indexOf("const completeFourAnchorAutoLayout"), pageSource.indexOf("const cancelFourAnchorCornerStage"));
    const corners = completion.indexOf("for (const slot of stage.slots)");
    const bases = completion.indexOf("planFourAnchorBaseSegment({");
    const seams = completion.indexOf("fillFourAnchorLowerSeams({");
    const walls = completion.indexOf("buildFourAnchorWallCabinets({");
    const commit = completion.indexOf("setPlaced(working)");
    expect(corners).toBeGreaterThanOrEqual(0);
    expect(bases).toBeGreaterThan(corners);
    // Gap-closing filler comes after the base runs and before the wall boxes are matched to the finished lower runs.
    expect(seams).toBeGreaterThan(bases);
    expect(walls).toBeGreaterThan(seams);
    expect(completion).toContain("closeSeams: true");
    expect(commit).toBeGreaterThan(walls);
    expect(completion).toContain("catalog: stage.wallPool");
    expect(completion).toContain("wallCabinetHeightIn: stage.input.wallCabinetHeightIn ?? 30");
    expect(completion).toContain("upperResult.skipped");
  });
});
