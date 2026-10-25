import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const wizardEditSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/lib/peninsulaWizardEdit.ts"), "utf8");

describe("Peninsula Wizard", () => {
  it("creates a straight selected-side run with an optional connected 45-degree end from the active line", () => {
    expect(source).toContain("const [peninsulaWizardOpen, setPeninsulaWizardOpen] = useState(false);");
    expect(source).toContain("const buildPeninsulaWizardLayout = useCallback(() => {");
    expect(source).toContain('turn: 90,');
    expect(source).toContain('label: "Peninsula · straight",');
    expect(source).toContain('parentRunId: run.id,');
    expect(source).toContain('turn: 45,');
    expect(source).toContain('const layoutRuns = angledRun ? [run, angledRun] : [run];');
    expect(source).toContain("countertopSeatingOverhang: draft.seatingOverhang");
    expect(source).toContain("countertopWaterfallEnd: draft.waterfall");
    expect(wizardEditSource).toContain('applianceCode: "none" | "DW-24" | "WINE-24"');
    expect(source).toContain('const spot = firstCollisionFreePeninsulaPlacement(');
    expect(source).toContain('data-testid="build-peninsula-wizard"');
    expect(source).toContain('45° end from the straight run');
  });

  it("uses the cabinet footprint and 1½-inch finished edge for every new Wizard countertop level", () => {
    expect(source).toContain('seatingOverhang: 0,');
    expect(source).toContain('Standard 1½ in. cabinet edge');
    expect(source).toContain('data-testid="peninsula-wizard-front-overhang-warning"');
    expect(source).toContain('cabinet-facing edge stays at 1½ in. maximum');
    expect(source).toContain('countertopRaisedBarOverhang: 15,');
    expect(source).toContain('15-inch outward projection');
    expect(source).toContain('same cabinet footprint and physical 45° miter');
  });

  it("offers drywall behind each peninsula leg instead of requiring a loose outward plan rectangle", () => {
    expect(wizardEditSource).toContain('addPonyWall: boolean;');
    expect(source).toContain('data-testid="peninsula-pony-wall-option"');
    expect(source).toContain('Add drywall behind the peninsula.');
    expect(source).toContain('const builtPonyWalls = draft.addPonyWall');
    expect(source).toContain('makePeninsulaDrywallBackPonyWall(');
    expect(source).toContain('ponyWallFitsRoom(ponyWall, nextRoom)');
    expect(source).toContain('and a drywall back wall');
  });

  it("requires the user’s ordered cabinet sequence on each leg and never auto-fills a cabinet", () => {
    expect(wizardEditSource).toContain('primaryCabinetIds: number[];');
    expect(wizardEditSource).toContain('returnCabinetIds: number[];');
    expect(source).toContain('data-testid="peninsula-wizard-primary-cabinet-add"');
    expect(source).toContain('data-testid="peninsula-wizard-return-cabinet-add"');
    expect(source).toContain('data-testid="peninsula-wizard-primary-sequence-list"');
    expect(source).toContain('selectedPeninsulaCabinetSequencePlan(segment.length, selectedCabinets as PeninsulaWizardCabinet[], selectedLineFillers)');
    expect(source).toContain('The Wizard will not auto-fill it.');
    expect(source).not.toContain('Automatic fit from this line');
  });

  it("derives each leg from the selected cabinet list and shows the dynamic total before building", () => {
    expect(source).toContain('const peninsulaWizardSpacePreview = useMemo(() => {');
    expect(source).toContain('selectedPeninsulaCabinetTotalIn(selectedCabinets)');
    expect(source).toContain('const peninsulaWizardTotalLength = useMemo(() => {');
    expect(source).toContain('data-testid="peninsula-wizard-total-length"');
    expect(source).toContain('Total selected peninsula cabinet length');
    expect(source).toContain('working.filter((cabinet) => cabinetWall(cabinet, nextRoom) !== layoutRun.id)');
    expect(source).toContain('data-testid="peninsula-wizard-space-preview"');
    expect(source).toContain('Cabinet totals &amp; remaining space');
    expect(source).toContain('data-testid={`peninsula-wizard-${leg.id.endsWith("_45_end") ? "return" : "primary"}-cabinet-total`}');
    expect(source).toContain('data-testid={`peninsula-wizard-${leg.id.endsWith("_45_end") ? "return" : "primary"}-remaining-space`}');
    expect(source).toContain('Each leg ends at the last cabinet you add');
    expect(source).toContain('No leg length is entered.');
    expect(source).not.toContain('primaryLength: number;');
    expect(source).not.toContain('endLength: number;');
    expect(source).not.toContain('Straight run length (in)');
    expect(source).not.toContain('45° end length (in)');
    expect(source).toContain('data-testid="peninsula-wizard-start-position"');
    expect(source).toContain('Start from selected wall corner (in)');
    expect(source).toContain('The Wizard seats the peninsula to that wall position');
    expect(source).toContain('Show counter stools on the seating side');
    expect(source).toContain('item.uid.startsWith("peninsula-stool:")');
  });

  it("adds a real mitered filler pair at the 135-degree joint of every Wizard 45-degree return", () => {
    expect(source).toContain('const hasChildFortyFiveReturn = Boolean((nextRoom.peninsulaRuns ?? []).some((candidate) => (');
    expect(source).toContain('const itemsForSegment = hasChildFortyFiveReturn && plan.items.at(-1)?.isFiller');
    expect(source).toContain('const miterRepair = repairMissingAngledWallFillers(working, nextRoom, catalogFillers, makeUid, styleIdRef.current ?? null);');
    expect(source).toContain('The 135° joint needs a matching catalog filler pair on this line. No peninsula was added.');
    expect(source).toContain('At the 135° joint formed by this 45° return, the Wizard adds the required pair of real selected-line filler boards');
  });

  it("offers a regular or 42-inch split-level countertop treatment through the shared peninsula data model", () => {
    expect(source).toContain('type PeninsulaWizardEditDraft');
    expect(wizardEditSource).toContain('countertopTreatment: "regular" | "split-level"');
    expect(source).toContain('countertopTreatment: event.target.value as "regular" | "split-level"');
    expect(source).toContain('data-testid="peninsula-wizard-countertop-treatment"');
    expect(source).toContain("countertopRaisedBar: draft.countertopTreatment === 'split-level'");
    expect(source).toContain('makePeninsulaDrywallBackPonyWall(');
  });

  it("blocks a generated Peninsula Wizard countertop from leaving the measured room shell", () => {
    expect(source).toContain('const escapedCountertop = countertopSurfaces(working, nextRoom).some((surface) => {');
    expect(source).toContain('!countertopSurfaceInsideRoom(surface, nextRoom)');
    expect(source).toContain('This cabinet plan would send a countertop through a room wall.');
  });

  it("replaces only owned Wizard assets and refuses a return topology change that would move an ordinary cabinet", () => {
    expect(source).toContain('placed.filter((cabinet) => cabinet.peninsulaWizardId !== editingPeninsulaWizardRootId)');
    expect(source).toContain('previous.filter((ponyWall) => ponyWall.peninsulaWizardId !== wizardRootId)');
    expect(source).toContain('previous.filter((item) => !item.uid.startsWith(`peninsula-stool:${wizardRootId}:`))');
    expect(source).toContain('const ordinaryCabinetOnExistingReturn = existingFortyFiveReturn && placed.some((cabinet) => (');
    expect(source).toContain('This 45° return has an ordinary cabinet. Keep its turn and direction');
    expect(source).toContain('const ordinarySupportBlock = peninsulaWizardEditBlockReason(room, placed, editingPeninsulaWizardRootId, layoutRuns);');
    expect(source).toContain('if (ordinarySupportBlock) { failWizard(ordinarySupportBlock); return; }');
    expect(source).toContain('Only the Wizard-owned assembly was replaced; ordinary cabinets were kept.');
  });

  it("never first-fits selected cabinets past an obstacle or silently drops unavailable choices", () => {
    expect(source).toContain('let selectedOffset = segment.start;');
    expect(source).toContain('const seatBounds = { start: selectedOffset, end: selectedOffset };');
    expect(source).toContain('selectedOffset += width;');
    expect(source).toContain('resolvePeninsulaWizardSelection(');
    expect(source).toContain('data-testid="peninsula-wizard-missing-items"');
    expect(source).toContain('peninsulaWizardMissingIds.length > 0');
  });

  it("rebinds surviving configured sinks and removes fixtures with deleted cabinet owners", () => {
    expect(source).toContain('reconcilePeninsulaWizardSinks(sinks, placed, working, wizardRootId)');
    expect(source).toContain('setSinks([...retainedWizardSinks, ...seeded]);');
    expect(source).toContain('removeSinksOwnedByCabinets(previous, outgoingCabinets)');
  });

  it("identifies an editable Wizard-built run directly in its Attributes panel", () => {
    expect(source).toContain('data-testid="peninsula-wizard-built-settings"');
    expect(source).toContain('WIZARD-BUILT · EDITABLE');
    expect(source).toContain('Edit its exact cabinet recipe without replacing ordinary cabinets.');
    expect(source).toContain('const editableWizard = editablePeninsulaWizard(room, wallSettingsDraft.wallId);');
  });

  it("opens the exact Wizard recipe from any selected owned cabinet", () => {
    expect(source).toContain('const selectedCabinetWizard = useMemo(() => {');
    expect(source).toContain('return editablePeninsulaWizard(room, selectedCab.peninsulaWizardId);');
    expect(source).toContain('const jumpCabinetToWizard = useCallback((uid: string) => {');
    expect(source).toContain('openPeninsulaWizardForEdit(cabinet.peninsulaWizardId as WallSide);');
    expect(source).toContain('data-testid="selected-cabinet-wizard-status"');
    expect(source).toContain('data-testid="jump-to-peninsula-wizard"');
    expect(source).toContain('wizardBuiltEditable={Boolean(attrCabinetWizard)}');
  });

  it("uses the selected shared wall-run frame for a Continuous Wall Builder attachment", () => {
    expect(source).toContain('const selectedFrame = wallRunFrame(activeWall, room);');
    expect(source).toContain('selectedFrame && selectedFrame.kind !== "peninsula" ? selectedFrame.id : "top"');
    expect(source).toContain('const peninsulaWizardAttachmentWalls = useMemo(() => {');
    expect(source).toContain('The position uses ⅛-inch increments and is applied when you build.');
    expect(source).toContain('const selectedFrame = wallRunFrame(activeWall, room);');
  });
});
