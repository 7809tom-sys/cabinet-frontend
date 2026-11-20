/**
 * The accepted appearance of a door style, as the kitchen reads it.
 *
 * Owner rule (Tom): the accepted render is the source of truth for a door's
 * color. A nearest paint-chip match is not a measurement of the door and must
 * never paint one.
 *
 * The color and the approved render come from `doorStyles.acceptedAppearance`, a
 * public read in cabinet-backend. Accepting a run writes the run's color and
 * approved image onto the door style, so an approval reaches every kitchen on the
 * next read: no snapshot in the saved design, no cache to clear, no manual step.
 *
 * `approvedVersionId` is the acceptance marker. A color typed into the style
 * editor without accepting a run has no marker, so it is not an accepted render
 * and does not drive a kitchen.
 *
 * When the endpoint is not deployed yet it answers NOT_FOUND. That is expected,
 * not an error: the caller falls back to the pre-paint-match original color (see
 * `PRE_PAINT_MATCH_ORIGINALS` in `shared/doorColorResolve.ts`) — never to the
 * paint-match hex the door was wrongly given.
 *
 * `doorStyleAppearance.ts` next door resolves the door PROFILE and the finish hex;
 * this module answers the narrower question the kitchen render asks, and is the
 * one place that decides whether a color is an accepted render or just a setting.
 */
import {
  PRE_PAINT_MATCH_ORIGINALS,
  hasAcceptedRun,
  resolveDoorColor,
  type AcceptedDoorAppearance,
  type DoorColorDecision,
} from "@shared/doorColorResolve";
import { isDoorImageColorSource } from "@shared/doorColorResolve";
import { aiTilePicture, selectedDoorHex, selectionForStyle, styleWithCheckedDoorImage, styleWithChosenColorHex, uploadedSampleUrl } from "@shared/doorColorSourceSelection";
import { cachedDoorImageHex } from "@/lib/doorImageHexCache";

export type AcceptedDoorStyleInput = {
  id?: number | null;
  styleCode?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  distributorId?: number | null;
  distributorName?: string | null;
  doorStyle?: string | null;
  woodSpecies?: string | null;
  finish?: string | null;
  color?: string | null;
  doorSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
  /** The accepted run's color. Honoured only when `approvedVersionId` is set. */
  renderHex?: string | null;
  /** The accepted run's approved door image. */
  approvedReferenceImageUrl?: string | null;
  /** Non-null only when an admin accepted a door-rendering run. */
  approvedVersionId?: number | null;
  approvedAt?: string | Date | null;
  /** The official AI (Gemini) profile picture (0281). */
  aiProfileImageUrl?: string | null;
  doorColorSource?: string | null;
  doorColorSourceValue?: unknown;
  doorColorSourceUpdatedAt?: string | Date | null;
  doorColorSourceSelection?: unknown;
  checkedDoorSource?: "uploaded-sample" | "ai-image" | "hex" | "sherwin-williams" | null;
  uploadedSampleHex?: string | null;
  aiImageHex?: string | null;
};

/**
 * The style with the checkmarked door source and the colors of its door images
 * (the uploaded sample and the Approved AI picture), read from the browser sample
 * cache. Every Designer color reader goes through this, so the checkmark reaches
 * the finish, the face plan, the plan view and 3D the same way.
 */
export function withCheckedDoorImage<T extends AcceptedDoorStyleInput>(style: T): T {
  return styleWithCheckedDoorImage(style, cachedDoorImageHex);
}

/** The door images whose colors the Designer samples: each style's uploaded sample and Approved AI picture. */
export function doorImageUrlsForStyles(
  styles: readonly (AcceptedDoorStyleInput | null | undefined)[],
  rows: ReadonlyMap<number, AcceptedAppearanceRow> = new Map(),
): string[] {
  const urls = new Set<string>();
  for (const style of styles) {
    if (!style) continue;
    const row = style.id != null ? rows.get(style.id) : undefined;
    const merged = row ? { ...style, approvedVersionId: row.approvedVersionId ?? null, approvedReferenceImageUrl: acceptedRowTextureUrl(row) || null } : style;
    const sample = uploadedSampleUrl(merged);
    const ai = aiTilePicture(merged).url;
    if (sample) urls.add(sample);
    if (ai) urls.add(ai);
  }
  return Array.from(urls);
}

/**
 * One row of `doorStyles.acceptedAppearance`. `colorHex` is the color derived
 * from the accepted render; `textureUrl` is that render, which the kitchen draws
 * on the door. A row with no `approvedVersionId` means "nothing accepted".
 */
export type AcceptedAppearanceRow = AcceptedDoorAppearance & {
  styleId?: number | null;
  /**
   * cabinet-backend answers the accepted color as `renderHex` and the approved image
   * as `approvedReferenceImageUrl` (live, Nov 20 2026), not `colorHex` / `textureUrl`.
   * Both spellings are read; reading only the old ones dropped every acceptance.
   */
  renderHex?: string | null;
  approvedReferenceImageUrl?: string | null;
};

/** The accepted color of a row, whichever spelling the backend used. */
export function acceptedRowColorHex(row: AcceptedAppearanceRow | null | undefined): string {
  return ((row?.colorHex ?? "").trim() || (row?.renderHex ?? "").trim());
}

/** The accepted image of a row, whichever spelling the backend used. */
export function acceptedRowTextureUrl(row: AcceptedAppearanceRow | null | undefined): string {
  return ((row?.textureUrl ?? "").trim() || (row?.approvedReferenceImageUrl ?? "").trim());
}

const HEX = /^#?[0-9a-f]{6}$/i;

/** True when this style has an ACCEPTED door-rendering run behind its color. */
export function hasAcceptedDoorAppearance(style: AcceptedDoorStyleInput | null | undefined): boolean {
  return Boolean(style && style.approvedVersionId != null && HEX.test((style.renderHex ?? "").trim()));
}

/**
 * The input the shared resolver should see.
 *
 * Drops `renderHex` and the approved image when no run was accepted, so a color
 * typed into the style editor can never masquerade as an approved render.
 */
export function doorColorInputFor(style: AcceptedDoorStyleInput | null | undefined): AcceptedDoorStyleInput {
  if (!style) return {};
  const accepted = hasAcceptedDoorAppearance(style);
  return {
    ...style,
    // The door's own recorded colour always counts; the catalog colour must never
    // stand in for it (Tom, Nov 13 2026). Only the approved IMAGE is gated on an
    // accepted run, so a typed colour can never claim to be an approved render.
    renderHex: style.renderHex ?? null,
    approvedReferenceImageUrl: accepted ? style.approvedReferenceImageUrl ?? null : null,
  };
}

/** The one color a kitchen renders for this style, and where it came from. */
export function resolveKitchenDoorColor(style: AcceptedDoorStyleInput | null | undefined): DoorColorDecision {
  // A confirmed Sherwin-Williams or hex choice is the render hex, so the finish
  // follows the same pick the door face is painted with.
  return resolveDoorColor(doorColorInputFor(style ? withCheckedDoorImage(styleWithChosenColorHex(style)) : style));
}

/**
 * The hex the Designer's color gate checks the lit door against.
 *
 * The gate's flat patch goes through the tone map, which cannot reach most mid-tone
 * colors (a plain #3a6ea5 lands at delta E 10), and a gate that cannot reach its target
 * blocks Gemini photo renders. An explicit, confirmed Sherwin-Williams or hex pick is
 * painted exactly (the paint face plan uses the picked hex with the room light
 * compensation), so there is nothing for the gate to correct and it must never block:
 * those picks return null, which the gate treats as a pass. An accepted render or a
 * hand-set render hex keeps feeding the gate as before.
 */
export function designerGateRenderHex(
  decision: Pick<DoorColorDecision, "candidateSource" | "candidateHex">,
  style: AcceptedDoorStyleInput | null | undefined,
): string | null {
  if (style && selectedDoorHex(selectionForStyle(style as never))) return null;
  // A door image's own color (checkmarked, uploaded sample or AI image) is the
  // door: the gate has nothing to correct and must never adjust or block it.
  if (isDoorImageColorSource(decision.candidateSource)) return null;
  return decision.candidateSource === "accepted-render" || decision.candidateSource === "render-hex"
    ? decision.candidateHex
    : null;
}

/**
 * The door image a kitchen should draw this style's faces from.
 *
 * The accepted run's approved render wins, because that is the image an admin
 * signed off on. A style with no accepted run returns null and the caller keeps
 * the style's own sample photo.
 */
export function kitchenAcceptedFaceImage(style: AcceptedDoorStyleInput | null | undefined): string | null {
  if (!style || !hasAcceptedDoorAppearance(style)) return null;
  return (style.approvedReferenceImageUrl ?? "").trim() || null;
}

/**
 * The door style's own sample photo, or null. Used as the face image when no run
 * has been accepted, and as the floor of the image preference.
 */
export function styleSampleFaceImage(style: AcceptedDoorStyleInput | null | undefined): string | null {
  if (!style) return null;
  return (style.doorSampleImageUrl ?? "").trim()
    || (style.thumbnailImageUrl ?? "").trim()
    || null;
}

/** Every style id a design references, so one query can cover a whole plan. */
export function designStyleIds(input: {
  designStyleId?: number | null;
  cabinetStyleIds?: readonly (number | null | undefined)[];
}): number[] {
  const ids = new Set<number>();
  if (input.designStyleId != null && input.designStyleId > 0) ids.add(input.designStyleId);
  for (const id of input.cabinetStyleIds ?? []) if (id != null && id > 0) ids.add(id);
  return Array.from(ids).sort((left, right) => left - right);
}

/**
 * The color a style falls back to when no accepted render is available.
 *
 * The pre-paint-match original wins, because it is what the door rendered in
 * before a nearest paint-chip match overwrote its saved color. Shaker Honey is
 * the case that exposed this: `#c8a040` was the paint match, and Tom confirmed
 * it was never the door's color. Only when a style was never paint-matched does
 * the normal precedence decide (saved catalog color, then the tables).
 *
 * This is the function that makes a NOT_FOUND endpoint safe: the kitchen still
 * renders the door's real pre-paint-match color, never the paint match.
 */
export function doorColorFallbackHex(style: AcceptedDoorStyleInput | null | undefined): string | null {
  if (!style) return null;
  const original = style.id != null ? PRE_PAINT_MATCH_ORIGINALS[style.id] : undefined;
  if (original) return original.hex;
  return resolveKitchenDoorColor(style).appliedHex;
}

/**
 * Merge one `acceptedAppearance` row into the style row the resolver reads.
 *
 * Deliberately additive: when the endpoint answers NOT_FOUND there is no row, and
 * the style is passed through untouched so the resolver falls back to the
 * pre-paint-match original rather than the paint match.
 */
export function withAcceptedAppearance(
  style: AcceptedDoorStyleInput | null | undefined,
  row: AcceptedAppearanceRow | null | undefined,
): AcceptedDoorStyleInput | null {
  if (!style) return style ?? null;
  if (!row || !hasAcceptedAppearanceRow(row)) return withCheckedDoorImage(style);
  const colorHex = acceptedRowColorHex(row);
  return withCheckedDoorImage({
    ...style,
    ...(HEX.test(colorHex) ? { renderHex: colorHex } : {}),
    approvedVersionId: row.approvedVersionId ?? style.approvedVersionId ?? null,
    approvedReferenceImageUrl: acceptedRowTextureUrl(row) || (style.approvedReferenceImageUrl ?? null),
  });
}

/** True when a row carries a real acceptance (a version id and a color). */
export function hasAcceptedAppearanceRow(row: AcceptedAppearanceRow | null | undefined): boolean {
  return Boolean(row && row.approvedVersionId != null && HEX.test(acceptedRowColorHex(row)));
}

/**
 * True when the acceptedAppearance query failed because the procedure is not
 * deployed yet. A tRPC NOT_FOUND code, or a bare 404, both mean "not there yet";
 * anything else is a real failure and the caller should surface it.
 */
export function acceptedAppearanceUnavailable(error: unknown): boolean {
  if (!error) return false;
  const record = typeof error === "object" ? (error as { data?: { code?: string }; code?: string; message?: string; shape?: { data?: { code?: string } } }) : {};
  const code = record.shape?.data?.code ?? record.data?.code ?? record.code;
  if (code === "NOT_FOUND") return true;
  const message = (record.message ?? "").toLowerCase();
  return message.includes("not found") || message.includes("no procedure");
}

/** True when an accepted-appearance query should be retried. A missing route is not. */
export function shouldRetryAcceptedAppearance(failureCount: number, error: unknown): boolean {
  if (acceptedAppearanceUnavailable(error)) return false;
  return failureCount < 2;
}

/** Whether a style's color is currently an accepted render or a fallback. */
export function doorColorProvenance(style: AcceptedDoorStyleInput | null | undefined): "accepted-render" | "fallback" {
  return style && hasAcceptedRun({ approvedVersionId: style.approvedVersionId ?? null }) ? "accepted-render" : "fallback";
}
