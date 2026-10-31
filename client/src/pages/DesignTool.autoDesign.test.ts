import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/lib/autoDesignLayout.ts"), "utf8");
const dialogSource = readFileSync(resolve(process.cwd(), "client/src/components/design/AutoDesignDialog.tsx"), "utf8");

describe("admin auto-design Designer wiring", () => {
  it("exposes the action for admins and affiliate Designers and disables it on a non-empty plan", () => {
    expect(pageSource).toContain("const autoDesignAvailable = isAdmin || Boolean(affiliateSlug);");
    expect(pageSource).toContain('data-testid="admin-auto-design-auto-build"');
    const buttonAt = pageSource.indexOf('data-testid="admin-auto-design-auto-build"');
    const guardAt = pageSource.lastIndexOf("{autoDesignAvailable && (", buttonAt);
    expect(guardAt).toBeGreaterThan(-1);
    expect(pageSource.slice(guardAt, buttonAt)).not.toContain(")}");
    expect(pageSource).toContain("disabled={!autoDesignControl.enabled}");
    expect(pageSource).toContain("AUTO_DESIGN_REFRIGERATOR_NOTE");
    expect(pageSource).toContain("buildAutoDesignLayout");
    expect(pageSource).toContain("runAutoDesignLayout");
    expect(pageSource).toContain("Auto-Design layout is available in affiliate Designers and for CabinetDealz admins.");
    expect(pageSource).not.toContain("The auto-design build is admin-only");
  });

  it("requires the four measured anchors and explicit layout controls in the popup", () => {
    expect(dialogSource).toContain("layoutType");
    expect(dialogSource).toContain("originCorner");
    expect(dialogSource).toContain("runDirection");
    expect(dialogSource).toContain("sink");
    expect(dialogSource).toContain("stove");
    expect(dialogSource).toContain("dishwasher");
    expect(dialogSource).toContain("refrigerator");
    expect(dialogSource).toContain('data-testid="auto-design-build-submit"');
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

  it("shows the same colored Wall 1–6 map on the Floor Plan only while Auto-Design setup is open", () => {
    expect(pageSource).toContain("buildAutoDesignWallGuides");
    expect(pageSource).toContain("autoDesignWallGuides");
    expect(pageSource).toContain("onWallGuideChange");
    expect(pageSource).toContain("setViewMode(\"plan\")");
  });

  it("keeps the six-wall sample room inside the admin-only empty-plan Auto-Design workflow", () => {
    expect(pageSource).toContain("makeAutoDesignSixWallTrainingRoom");
    expect(pageSource).toContain("loadAutoDesignSixWallTrainingRoom");
    expect(pageSource).toContain("onLoadSixWallTrainingRoom={isAdmin ? loadAutoDesignSixWallTrainingRoom : undefined}");
    expect(pageSource).toContain("The six-wall training room is available only to an unlocked admin kitchen Designer.");
    expect(pageSource).toContain("A training room can only be loaded into an empty Designer");
    expect(dialogSource).toContain("auto-design-load-six-wall-training-room");
  });

  it("keeps the sink-base workflow required but allows an explicitly omitted range, dishwasher, or refrigerator without forcing a palette or refrigerator bay", () => {
    expect(dialogSource).toContain("Do not add Range / stove");
    expect(dialogSource).toContain("Do not add Dishwasher");
    expect(dialogSource).toContain("Do not add Refrigerator");
    expect(layoutSource).toContain('const refrigeratorRequested = plan.plan.anchors.some((anchor) => anchor.kind === "refrigerator")');
    expect(layoutSource).toContain("if (refrigeratorRequested && (!args.refrigeratorCaps.length || !args.refrigeratorEndPanels.length))");
    expect(layoutSource).toContain("if (refrigerator) {");
  });

  it("offers a left or right sink-adjacent dishwasher choice when no exact center is entered", () => {
    expect(dialogSource).toContain("Dishwasher side");
    expect(dialogSource).toContain("Left of sink");
    expect(dialogSource).toContain("Right of sink");
    expect(dialogSource).toContain("Left of sink");
    expect(dialogSource).toContain("Right of sink");
    expect(dialogSource).toContain("dishwasherSide");
    expect(pageSource).toContain("data-testid=\"dishwasher-side-control\"");
    expect(pageSource).toContain("dishwasherSide: dishwasherSidePreference");
    expect(dialogSource).toContain("Optional exact dishwasher center");
  });

  it("collects a selected sink base and documents the selected refrigerator enclosure instead of using generic floor appliances", () => {
    expect(dialogSource).toContain("Sink base size");
    expect(dialogSource).toContain("SB{width}");
    expect(dialogSource).toContain("36″ refrigerator");
    expect(dialogSource).toContain("Two source-priced side panels");
    expect(dialogSource).toContain("Matching source-priced 36″ cabinet above");
    expect(layoutSource).toContain("No source-priced SB${sinkBaseWidth} sink base");
    expect(layoutSource).toContain("makeDefaultSinkForCabinet(sinkBase");
    expect(layoutSource).toContain("buildMandatoryAutoDesignRefrigeratorBay");
  });

  it("collects the requested 30, 36, or 42 inch wall-cabinet height and keeps submit failures visible", () => {
    expect(dialogSource).toContain("Wall-cabinet height");
    expect(dialogSource).toContain("([30, 36, 42] as const)");
    expect(dialogSource).toContain("height}″ wall cabinets");
    expect(dialogSource).toContain("30″, 36″, or 42″");
    expect(dialogSource).toContain("wallCabinetHeightIn");
    expect(dialogSource).toContain('data-testid="auto-design-build-error"');
  });

  it("resolves the selected SB width only to a straight sink base and never fills a wall gap with a corner SKU", () => {
    expect(layoutSource).toContain("const straightBaseCatalog = autoBuildStraightBaseCatalog(pool);");
    // The sink base is chosen by the shared picker: REGULAR by default (never the farmhouse apron-front base,
    // a vanity or a corner sink box) and farmhouse only on an explicit request.
    expect(layoutSource).toContain("pickAutoDesignSinkBase(pool, sinkBaseWidth, sinkBaseKind)");
    expect(layoutSource).toContain('input.sinkBaseKind ?? "regular"');
    // The largest-first fill now runs through the range-aware planner (which calls autoFillSpan with the same strategy and
    // the same straight-base catalog) so a range always gets a 15-inch-or-wider cabinet on each side.
    expect(pageSource).toContain("planAutoDesignBaseSegment({");
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

  it("seats the measured appliances, then places catalog corners automatically before filling the remaining runs", () => {
    expect(pageSource).toContain("seatAutoDesignCornerFromCatalog");
    expect(layoutSource).toContain("autoDesignCornerSlots(input.layoutType, {");
    expect(layoutSource).toContain("wallIds: selectedWalls, room, originCorner: input.originCorner, runDirection: input.runDirection");
    expect(pageSource).toContain("finishAutoDesignLayoutRef.current");
    expect(pageSource).toContain("completeAutoDesignLayout");
    expect(pageSource).not.toContain("AutoDesignCornerDialog");
    expect(pageSource).toContain("autoDesignRunWallIds");
  });

  it("runs aligned source-priced wall cabinets only after required corners and regular base runs", () => {
    const completion = pageSource.slice(pageSource.indexOf("const completeAutoDesignLayout"), pageSource.indexOf("finishAutoDesignLayoutRef.current = completeAutoDesignLayout"));
    const corners = completion.indexOf("for (const slot of stage.slots)");
    const bases = completion.indexOf("planAutoDesignBaseSegment({");
    const seams = completion.indexOf("fillAutoDesignLowerSeams({");
    const walls = completion.indexOf("buildAutoDesignWallCabinets({");
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
