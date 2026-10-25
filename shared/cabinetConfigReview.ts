export type CabinetConfigReviewCandidate = {
  isActive: boolean | null | undefined;
  configVerified: boolean | null | undefined;
  hasPositivePublishedPrice?: boolean | number | string | null | undefined;
};

export const CABINET_ATTENTION_SEARCH_PLACEHOLDER = "Search cabinet name or SKU…";

/** True when a cabinet needs an administrator configuration review. */
export function needsCabinetConfigAttention(candidate: CabinetConfigReviewCandidate): boolean {
  // Missing-price records are handled exclusively by Admin → Unpriced Items.
  // Do not duplicate them in Cabinet Attention, even when price hiding made
  // the record inactive; that queue is for real configuration review only.
  if (isMissingPositivePublishedPrice(candidate.hasPositivePublishedPrice)) return false;
  return candidate.isActive === false || candidate.configVerified !== true;
}

/** Status labels for the review queue. A cabinet may require both corrections. */
export function cabinetConfigAttentionReasons(candidate: CabinetConfigReviewCandidate): Array<"Inactive" | "Unverified"> {
  if (isMissingPositivePublishedPrice(candidate.hasPositivePublishedPrice)) return [];
  const reasons: Array<"Inactive" | "Unverified"> = [];
  if (candidate.isActive === false) reasons.push("Inactive");
  if (candidate.configVerified !== true) reasons.push("Unverified");
  return reasons;
}

/** MySQL `EXISTS` fields can be returned as 0/1 rather than booleans. */
function isMissingPositivePublishedPrice(value: CabinetConfigReviewCandidate["hasPositivePublishedPrice"]): boolean {
  return value === false || value === 0 || value === "0";
}

/** Deep link that opens the exact cabinet record in the existing Cabinet Config editor. */
export function cabinetConfigQuickEditUrl(cabinetId: number): string {
  return `/admin?tab=cabinet-config&cabinetId=${cabinetId}`;
}

/** Opens the full front-end cabinet editor with an exact record ID for non-catalog entry points. */
export function cabinetFrontEndQuickEditUrl(masterCode: string, cabinetId: number): string {
  return `/catalog/${encodeURIComponent(masterCode)}?edit=1&cabinetId=${cabinetId}&from=cabinet-attention`;
}

export const CABINET_ATTENTION_RETURN_URL = "/admin?tab=cabinet-attention";
export const DESIGNER_COVERAGE_RETURN_URL = "/admin?tab=coverage&gapsOnly=1";

/**
 * Opens the exact missing cabinet/style connection from the Designer Coverage
 * matrix. The editor still creates only a pending connection; it never infers
 * a supplier SKU, price, or publication state.
 */
export function cabinetDesignerCoverageGapEditUrl(
  masterCode: string,
  cabinetId: number,
  styleId: number,
  distributorId: number,
): string {
  const params = new URLSearchParams({
    edit: "1",
    cabinetId: String(cabinetId),
    style: String(styleId),
    distributorId: String(distributorId),
    from: "designer-coverage",
  });
  return `/catalog/${encodeURIComponent(masterCode)}?${params.toString()}`;
}

/** Only administrators who entered from Cabinet Attention should see or trigger admin return navigation. */
export function shouldShowCabinetAttentionReturn(
  isAdministrator: boolean,
  source: string | null | undefined,
): boolean {
  return isAdministrator && source === "cabinet-attention";
}

/** Only administrators who entered from Designer Coverage should see its return navigation. */
export function shouldShowDesignerCoverageReturn(
  isAdministrator: boolean,
  source: string | null | undefined,
): boolean {
  return isAdministrator && source === "designer-coverage";
}

export const CABINET_ATTENTION_EDITOR_LINK_ATTRIBUTES = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

export const DISTRIBUTOR_CONNECTION_REQUIRED_MESSAGE =
  "Connect a distributor line and enter its supplier SKU before marking this cabinet verified.";

export function canFinalizeCabinetConfiguration(distributorConnectionCount: number | null | undefined): boolean {
  return Number(distributorConnectionCount ?? 0) > 0;
}

/** Converts the database's compact distributor-line list into stable display labels. */
export function distributorLineLabels(distributorNames: string | null | undefined): string[] {
  return Array.from(
    new Set(
      (distributorNames ?? "")
        .split("|")
        .map((name) => name.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

/** Converts a dropdown selection to a safe distributor-line identifier. */
export function selectedDistributorLineId(value: string): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}
