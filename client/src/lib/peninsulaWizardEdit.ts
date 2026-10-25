import {
  peninsulaRootRunId,
  type PeninsulaCabinetSide,
  type PeninsulaDirection,
  type PeninsulaRun,
  type RoomData,
} from "./design";

/**
 * The persisted input contract for a Peninsula Wizard. It is intentionally
 * catalog-ID based so an edit reuses exactly what the customer selected rather
 * than deriving a new best-fit cabinet list from geometry.
 */
export type PeninsulaWizardEditDraft = {
  parentWall: string;
  startOffset: number;
  endTurn: "none" | 45;
  endDirection: PeninsulaDirection;
  cabinetSide: PeninsulaCabinetSide;
  applianceCode: "none" | "DW-24" | "WINE-24";
  seatingOverhang: 0 | 10 | 12 | 15;
  waterfall: boolean;
  corbels?: boolean;
  addPonyWall: boolean;
  ponyWallLength: number;
  ponyWallHeight: number;
  primaryCabinetIds: number[];
  returnCabinetIds: number[];
  countertopTreatment: "regular" | "split-level";
  showBarStools: boolean;
};

export type EditablePeninsulaWizard = {
  rootRunId: string;
  draft: PeninsulaWizardEditDraft;
};

function asParentWall(value: unknown): PeninsulaWizardEditDraft["parentWall"] {
  return typeof value === "string" && value.trim() ? value : "top";
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rootRunFor(room: Pick<RoomData, "peninsulaRuns">, runId: string): PeninsulaRun | null {
  const selected = room.peninsulaRuns?.find((run) => run.id === runId);
  if (!selected) return null;
  const rootId = peninsulaRootRunId(selected, room);
  return room.peninsulaRuns?.find((run) => run.id === rootId) ?? null;
}

function recipeDraft(root: PeninsulaRun): PeninsulaWizardEditDraft | null {
  const recipe = root.wizardRecipe;
  if (!recipe || recipe.schemaVersion !== 1) return null;
  return {
    // Attachment movement is a shared physical-wall operation. Reopening the
    // Wizard must honor the current run position, rather than overwriting a
    // later drag with the original build-time recipe position.
    parentWall: asParentWall(root.parentWall ?? recipe.parentWall),
    startOffset: numberValue(root.startOffset, numberValue(recipe.startOffset, 0)),
    endTurn: recipe.endTurn === 45 ? 45 : "none",
    endDirection: recipe.endDirection === "left" ? "left" : "right",
    cabinetSide: recipe.cabinetSide === "right" ? "right" : "left",
    applianceCode: recipe.applianceCode === "DW-24" || recipe.applianceCode === "WINE-24" ? recipe.applianceCode : "none",
    seatingOverhang: recipe.seatingOverhang === 10 || recipe.seatingOverhang === 12 || recipe.seatingOverhang === 15 ? recipe.seatingOverhang : 0,
    waterfall: Boolean(recipe.waterfall),
    ...(recipe.corbels !== undefined ? { corbels: recipe.corbels === true } : {}),
    addPonyWall: Boolean(recipe.addPonyWall),
    ponyWallLength: numberValue(recipe.ponyWallLength, 36),
    ponyWallHeight: numberValue(recipe.ponyWallHeight, 34.5),
    primaryCabinetIds: [...recipe.primaryCabinetIds],
    returnCabinetIds: [...recipe.returnCabinetIds],
    countertopTreatment: recipe.countertopTreatment === "split-level" ? "split-level" : "regular",
    showBarStools: recipe.showBarStools !== false,
  };
}

/**
 * Returns the reusable Wizard recipe for a selected peninsula run.
 *
 * New layouts carry their exact user choices in `wizardRecipe`. Earlier Wizard
 * layouts do not have an ownership record, so they deliberately cannot enter
 * this path: guessing which cabinets should be replaced could remove a later
 * ordinary cabinet on the same peninsula. Ordinary peninsula runs also never
 * enter this path.
 */
export function editablePeninsulaWizard(
  room: RoomData,
  requestedRunId: string | null | undefined,
): EditablePeninsulaWizard | null {
  if (!requestedRunId) return null;
  const root = rootRunFor(room, requestedRunId);
  if (!root) return null;

  const stored = recipeDraft(root);
  return stored ? { rootRunId: root.id, draft: stored } : null;
}

/** Returns every run belonging to a root assembly, including nested returns. */
export function peninsulaWizardAssemblyRunIds(room: Pick<RoomData, "peninsulaRuns">, rootRunId: string): Set<string> {
  const ids = new Set<string>([rootRunId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const run of room.peninsulaRuns ?? []) {
      if (run.parentRunId && ids.has(run.parentRunId) && !ids.has(run.id)) {
        ids.add(run.id);
        changed = true;
      }
    }
  }
  return ids;
}
