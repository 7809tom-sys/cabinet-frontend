import { awaitingConfirm, type DoorColorSourceDraft } from "@shared/doorColorSourceSelection";

/**
 * True when the door color selector's stored choice is a real, settled choice that
 * should be written to the door style now: a confirmed Sherwin-Williams or Hex pick,
 * an Original or Approved AI tile that was clicked, or null (a cleared choice).
 *
 * A Sherwin-Williams or Hex tile that is still waiting for Confirm is not settled. Clicking
 * it only turns the saved choice off locally (the reducer parks the door on Original
 * image), and sending that would overwrite the saved choice with the supplier photo.
 */
export function shouldPersistColorSource(draft: Pick<DoorColorSourceDraft, "active" | "stored">): boolean {
  return !awaitingConfirm(draft as DoorColorSourceDraft);
}

/**
 * The description the editor opens with: the style's own saved profile description,
 * else the official AI profile text chosen earlier (aiProfileText, 0281), else empty.
 */
export function initialProfileDescription(
  style: { profileDescription?: string | null; aiProfileText?: string | null } | null | undefined,
): string {
  const own = (style?.profileDescription ?? "").trim();
  if (own) return style!.profileDescription ?? "";
  return style?.aiProfileText?.trim() ? style.aiProfileText : "";
}
