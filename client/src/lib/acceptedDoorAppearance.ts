/**
 * PRIORITY: the accepted appearance of a door style, as the kitchen reads it.
 *
 * Owner rule: any approved render becomes the kitchen's color.
 *
 * Accepting a door-rendering run writes the run's color and approved door image
 * onto the door style (`syncAcceptedAppearanceToStyle` in cabinet-backend). The
 * Designer reads them from its door-style data, so an approval reaches every
 * kitchen on the next read: no snapshot in the saved design, no cache to clear,
 * no manual step.
 *
 * `renderHex` alone is not proof of an acceptance: an admin can type a color into
 * the style editor without ever accepting a run. `approvedVersionId` is the signal
 * that a run was actually accepted, so only that combination may drive a kitchen.
 * Without it the resolver falls back to the style's own saved catalog color, then
 * to the measured tables.
 *
 * `doorStyleAppearance.ts` next door resolves the door PROFILE and the finish hex;
 * this module answers the narrower question the kitchen render asks, and is the
 * one place that decides whether a color is an accepted render or just a setting.
 */
import { resolveDoorColor, type DoorColorDecision } from "@shared/doorColorResolve";

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
};

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
    renderHex: accepted ? style.renderHex : null,
    approvedReferenceImageUrl: accepted ? style.approvedReferenceImageUrl ?? null : null,
  };
}

/** The one color a kitchen renders for this style, and where it came from. */
export function resolveKitchenDoorColor(style: AcceptedDoorStyleInput | null | undefined): DoorColorDecision {
  return resolveDoorColor(doorColorInputFor(style));
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
