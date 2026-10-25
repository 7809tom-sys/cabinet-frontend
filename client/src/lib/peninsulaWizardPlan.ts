import { catalogFillerForGap, isCatalogFiller, type CatalogFillerCandidate } from "./catalogFiller";

/**
 * Selected-cabinet planning for the Peninsula Wizard.
 *
 * The Wizard receives the exact real selected-line base cabinet sequence that
 * the user wants on a leg. It never repeats, substitutes, or best-fits boxes
 * on the user's behalf. A real catalog filler may close only a small remainder.
 */
export type PeninsulaWizardCabinet = CatalogFillerCandidate & {
  id: number;
  placement?: string | null;
  category?: string | null;
  subCategory?: string | null;
};

export type PeninsulaWizardPlanItem = {
  cabinet: PeninsulaWizardCabinet;
  width: number;
  isFiller: boolean;
};

export type PeninsulaWizardSelectedPlan = {
  items: PeninsulaWizardPlanItem[];
  remainderIn: number;
  message: string | null;
};

const EPSILON = 0.001;

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function eighth(value: number): number {
  return Math.round(value * 8) / 8;
}

/**
 * The Wizard must report the user's own ordered cabinet total before it builds.
 * This intentionally never adds a best-fit cabinet or a filler: it is only the
 * sum of the selected catalog records so the dialog and the build path speak
 * about the same dimensions.
 */
export function selectedPeninsulaCabinetTotalIn(
  selectedCabinets: readonly PeninsulaWizardCabinet[],
): number {
  return eighth(selectedCabinets.reduce((total, cabinet) => total + Math.max(0, numeric(cabinet.width)), 0));
}

export function wizardEligibleBaseCabinets(
  candidates: readonly PeninsulaWizardCabinet[],
): PeninsulaWizardCabinet[] {
  return candidates.filter((candidate) => {
    const width = numeric(candidate.width);
    const height = numeric(candidate.height);
    const depth = numeric(candidate.depth);
    const classification = `${candidate.category ?? ""} ${candidate.subCategory ?? ""} ${candidate.description ?? ""}`.toLowerCase();
    // A kitchen peninsula only accepts kitchen bases. Bathroom vanities and ADA
    // vanity sinks may share a base-like size, but are never a Wizard choice.
    const isVanity = /\bvanity\b|\bbath(?:room)?\b/.test(classification);
    return !isCatalogFiller(candidate)
      && !isVanity
      && width >= 9
      && height >= 30
      && height <= 36
      && depth >= 20
      && depth <= 30;
  });
}

/**
 * Uses only the cabinet sequence selected by the user. A leftover from 1/8–6
 * in is filled only by an active, real selected-line filler. A larger leftover
 * stays open and is returned to the user rather than being auto-filled.
 */
export function selectedPeninsulaCabinetSequencePlan(
  clearLengthIn: number,
  selectedCabinets: readonly PeninsulaWizardCabinet[],
  fillerCandidates: readonly PeninsulaWizardCabinet[],
): PeninsulaWizardSelectedPlan {
  if (selectedCabinets.length === 0) {
    return {
      items: [],
      remainderIn: eighth(Math.max(0, clearLengthIn)),
      message: "Choose every cabinet for this peninsula leg before building it.",
    };
  }

  const items: PeninsulaWizardPlanItem[] = [];
  let used = 0;
  for (const selectedCabinet of selectedCabinets) {
    const width = numeric(selectedCabinet.width);
    if (width <= 0) {
      return {
        items: [],
        remainderIn: eighth(Math.max(0, clearLengthIn - used)),
        message: `${selectedCabinet.masterCode} does not have a valid catalog width for this peninsula leg.`,
      };
    }
    if (used + width > clearLengthIn + EPSILON) {
      return {
        items: [],
        remainderIn: eighth(Math.max(0, clearLengthIn - used)),
        message: `${selectedCabinet.masterCode} does not fit after the cabinets you selected on this ${eighth(clearLengthIn)} in clear peninsula span.`,
      };
    }
    items.push({ cabinet: selectedCabinet, width, isFiller: false });
    used += width;
  }
  const remainder = eighth(Math.max(0, clearLengthIn - used));

  if (remainder < 0.125) return { items, remainderIn: 0, message: null };
  if (remainder > 6 + EPSILON) {
    return {
      items: [],
      remainderIn: remainder,
      message: `Your selected cabinet sequence leaves ${remainder} in open. Add or change a selected cabinet, or change the run length.`,
    };
  }

  const filler = catalogFillerForGap(fillerCandidates, remainder, "base") as PeninsulaWizardCabinet | null;
  if (!filler) {
    return {
      items: [],
      remainderIn: remainder,
      message: `Your selected cabinet sequence leaves ${remainder} in open, and this line has no matching catalog filler.`,
    };
  }
  items.push({ cabinet: filler, width: remainder, isFiller: true });
  return { items, remainderIn: remainder, message: null };
}
