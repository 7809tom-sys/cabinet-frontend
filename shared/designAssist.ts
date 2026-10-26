export type DesignSnapshot = {
  name: string;
  roomData: unknown;
  placedCabinets: unknown;
  selectedSurfaces: unknown;
  threeDPresentation: unknown;
  selectedStyleId: number | null;
  selectedDistributorId: number | null;
  projectName: string | null;
  roomLabel: string | null;
  roomType: string | null;
};

export function snapshotDesign(row: DesignSnapshot): DesignSnapshot {
  return {
    name: row.name,
    roomData: row.roomData ?? null,
    placedCabinets: row.placedCabinets ?? null,
    selectedSurfaces: row.selectedSurfaces ?? null,
    threeDPresentation: row.threeDPresentation ?? null,
    selectedStyleId: row.selectedStyleId ?? null,
    selectedDistributorId: row.selectedDistributorId ?? null,
    projectName: row.projectName ?? null,
    roomLabel: row.roomLabel ?? null,
    roomType: row.roomType ?? null,
  };
}

export type AssistPlan =
  | {
      mode: "revision";
      deletesDesign: false;
      preservesPrevious: true;
      snapshot: DesignSnapshot;
      live: DesignSnapshot;
      authorLabel: string;
      assistLabel: string;
    }
  | {
      mode: "suggestion";
      deletesDesign: false;
      updatesOriginal: false;
      original: DesignSnapshot;
      copy: DesignSnapshot & { recordKind: "suggested"; suggestionOfDesignId: number; assistLabel: string };
      authorLabel: string;
    };

export function planAssistedRevision(previous: DesignSnapshot, next: DesignSnapshot, storeName: string): AssistPlan {
  const authorLabel = `Edited by ${storeName}`;
  return {
    mode: "revision",
    deletesDesign: false,
    preservesPrevious: true,
    snapshot: snapshotDesign(previous),
    live: snapshotDesign(next),
    authorLabel,
    assistLabel: authorLabel,
  };
}

export function planSuggestedCopy(original: DesignSnapshot, next: DesignSnapshot, designId: number): AssistPlan {
  return {
    mode: "suggestion",
    deletesDesign: false,
    updatesOriginal: false,
    original: snapshotDesign(original),
    copy: {
      ...snapshotDesign(next),
      recordKind: "suggested",
      suggestionOfDesignId: designId,
      assistLabel: "Suggested by your designer",
    },
    authorLabel: "Suggested by your designer",
  };
}

export function planRevert(current: DesignSnapshot, previous: DesignSnapshot): { live: DesignSnapshot; preservedCurrent: DesignSnapshot; deletesDesign: false } {
  return {
    live: snapshotDesign(previous),
    preservedCurrent: snapshotDesign(current),
    deletesDesign: false,
  };
}
