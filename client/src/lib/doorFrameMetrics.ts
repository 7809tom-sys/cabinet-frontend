export type DoorFrameMetricInput = {
  railWidth?: string | number | null;
  stileWidth?: string | number | null;
  sourceSpecification?: string | null;
  doorStyle?: string | null;
  doorPanelType?: string | null;
};

export type CompleteDoorFrameMetrics = {
  railWidth: number;
  stileWidth: number;
};

export type DesignerFrameCompliance = {
  isCompliant: boolean;
  reason: string | null;
};

/** All Cabinet Dealz Slim Shaker styles use a one-inch rail and stile. */
export const SLIM_SHAKER_FRAME_INCHES = 1;

export function isSlimShakerFrame(input: DoorFrameMetricInput | null | undefined): boolean {
  const style = `${input?.doorStyle ?? ""} ${input?.doorPanelType ?? ""}`.toLowerCase();
  return /(?:slim|skinny|narrow|thin[ -]?frame)/.test(style) && /shaker/.test(style);
}

/**
 * A styled face is only safe to render when its own Door Style record has both
 * frame measurements and an official source citation. A partial or unbound
 * ordinary profile must retain the neutral renderer rather than mixing a real
 * dimension with an inferred companion dimension.
 */
export function completeDoorFrameMetrics(
  input: DoorFrameMetricInput | null | undefined,
): CompleteDoorFrameMetrics | null {
  if (!input?.sourceSpecification?.trim()) return null;
  const railWidth = Number(input?.railWidth);
  const stileWidth = Number(input?.stileWidth);
  if (!Number.isFinite(railWidth) || railWidth <= 0) return null;
  if (!Number.isFinite(stileWidth) || stileWidth <= 0) return null;
  return { railWidth, stileWidth };
}

/**
 * Resolves physical geometry for Designer, elevation, and 3D rendering. Normal
 * profiles remain source-bound. Slim Shaker is the sole construction-family
 * exception: it always renders a one-inch frame even while its citation is
 * still being entered.
 */
export function designerDoorFrameMetrics(
  input: DoorFrameMetricInput | null | undefined,
): CompleteDoorFrameMetrics | null {
  if (isSlimShakerFrame(input)) {
    return { railWidth: SLIM_SHAKER_FRAME_INCHES, stileWidth: SLIM_SHAKER_FRAME_INCHES };
  }
  return completeDoorFrameMetrics(input);
}

/**
 * The Featured Styles interfaces must show the same truth as the Designer:
 * incomplete measurements or an uncited ordinary profile render with the
 * neutral face, so they are not Designer-compliant until the source-bound
 * profile is complete.
 */
export function designerFrameCompliance(
  input: DoorFrameMetricInput | null | undefined,
): DesignerFrameCompliance {
  if (completeDoorFrameMetrics(input)) return { isCompliant: true, reason: null };

  const railWidth = Number(input?.railWidth);
  const stileWidth = Number(input?.stileWidth);
  const hasBothMeasurements = Number.isFinite(railWidth) && railWidth > 0
    && Number.isFinite(stileWidth) && stileWidth > 0;
  const hasCitation = Boolean(input?.sourceSpecification?.trim());
  if (!hasBothMeasurements && !hasCitation) {
    return { isCompliant: false, reason: "Verified rail and stile measurements plus an official source citation are required." };
  }
  if (!hasBothMeasurements) {
    return { isCompliant: false, reason: "Verified rail and stile measurements are required." };
  }
  return { isCompliant: false, reason: "An official source citation is required." };
}
