/**
 * The four door color source slots shown side by side (original image, approved
 * AI / Gemini, Sherwin-Williams, hex), and the one the 3D renderer uses.
 *
 * Pure logic only. The editor's confirmed choice (`stored`) is the live truth for
 * which slot is checked. Slot VALUES come from two places:
 *
 *   - the editor itself: the supplier photo, the approved AI picture, and the
 *     confirmed choice when it is a Sherwin-Williams chip or a hex;
 *   - `doorStyles.listDoorColorSources` (backend 0283 table), which keeps every
 *     slot's value at once. Before that backend is deployed the call is absent or
 *     answers { available: false }, and only the current choice's slot is filled
 *     (the single 0280 column cannot hold more than one).
 *
 * Checking a slot never writes anything here: the caller dispatches the returned
 * selection, and the editor's existing persist path (adminUpdateDoorStyle
 * `doorColorSourceSelection`) saves it.
 */
import {
  DOOR_COLOR_SOURCES,
  DOOR_COLOR_SOURCE_LABELS,
  effectiveDoorColorSource,
  normalizeHex,
  parseDoorColorSourceSelection,
  type DoorColorSourceOption,
  type DoorColorSourceSelection,
} from "@shared/doorColorSourceSelection";

export type DoorColorSourcesListing = {
  available?: boolean;
  activeSource?: string | null;
  sources?: Array<{ source: string; value?: Record<string, unknown> | null; isActive?: boolean }>;
} | null | undefined;

export type FourSlot = {
  source: DoorColorSourceOption;
  label: string;
  /** Picture for the original and AI slots. */
  imageUrl: string | null;
  /** Swatch for the Sherwin-Williams and hex slots. */
  hex: string | null;
  /** Small text under the picture: the chip name, the hex, or why the slot is empty. */
  caption: string;
  /** What checking this slot stores. Null when the slot cannot be used yet. */
  selection: DoorColorSourceSelection | null;
  checkable: boolean;
  /** This is the slot the 3D renderer uses right now. */
  checked: boolean;
  /** True when the slot has a picture or color to show. */
  filled: boolean;
};

export type FourSlotInput = {
  supplierPhotoUrl?: string | null;
  /** Accepted render picture, else the official AI profile picture. */
  aiImageUrl?: string | null;
  /** True only when an accepted AI render exists: otherwise 3D cannot use the AI slot. */
  aiAvailable: boolean;
  /** The editor's confirmed choice (null: nothing chosen, the supplier photo is used). */
  stored: DoorColorSourceSelection | null;
  listing?: DoorColorSourcesListing;
  now: string;
};

const trimmed = (value: string | null | undefined): string => (value ?? "").trim();

function rowFor(listing: DoorColorSourcesListing, source: DoorColorSourceOption) {
  if (!listing?.available) return null;
  return listing.sources?.find((row) => row.source === source) ?? null;
}

function sherwinSelection(value: unknown, now: string): DoorColorSourceSelection | null {
  return parseDoorColorSourceSelection({ source: "sherwin-williams", confirmed: true, chosenAt: now, color: value });
}

function hexSelection(value: unknown, now: string): DoorColorSourceSelection | null {
  const hex = value && typeof value === "object" ? (value as { hex?: unknown }).hex : undefined;
  return parseDoorColorSourceSelection({ source: "hex", confirmed: true, chosenAt: now, hex });
}

/** The source the 3D renderer actually uses: an AI choice with no accepted render falls back to Original. */
export function activeFourSlotSource(input: Pick<FourSlotInput, "stored" | "aiAvailable" | "aiImageUrl">): DoorColorSourceOption {
  return effectiveDoorColorSource(
    input.stored,
    input.aiAvailable ? { approvedVersionId: 1, approvedReferenceImageUrl: trimmed(input.aiImageUrl) || "accepted" } : null,
  ).source;
}

export function buildFourSlots(input: FourSlotInput): FourSlot[] {
  const active = activeFourSlotSource(input);
  const { stored, listing, now } = input;

  return DOOR_COLOR_SOURCES.map((source): FourSlot => {
    const label = DOOR_COLOR_SOURCE_LABELS[source];
    const checked = active === source;

    if (source === "original-image") {
      const url = trimmed(input.supplierPhotoUrl) || trimmed(rowFor(listing, source)?.value?.imageUrl as string | undefined);
      return {
        source, label, checked,
        imageUrl: url || null, hex: null,
        caption: url ? "Supplier photo (default)" : "No supplier photo uploaded",
        // Explicit original is always allowed: the supplier photo is the default and the truth.
        selection: { source: "original-image", chosenAt: now },
        checkable: true,
        filled: Boolean(url),
      };
    }

    if (source === "approved-ai-image") {
      const url = trimmed(input.aiImageUrl) || trimmed(rowFor(listing, source)?.value?.imageUrl as string | undefined);
      const caption = !url
        ? "No approved AI picture yet"
        : input.aiAvailable
          ? "Approved AI (Gemini) render"
          : "Saved, but not an accepted render yet: 3D keeps the supplier photo";
      return {
        source, label, checked,
        imageUrl: url || null, hex: null, caption,
        selection: url && input.aiAvailable ? { source: "approved-ai-image", chosenAt: now } : null,
        checkable: Boolean(url && input.aiAvailable),
        filled: Boolean(url),
      };
    }

    if (source === "sherwin-williams") {
      const fromStored = stored?.source === "sherwin-williams" ? stored : null;
      const fromRow = fromStored ? null : sherwinSelection(rowFor(listing, source)?.value, now);
      const selection = fromStored ?? fromRow;
      const color = selection?.source === "sherwin-williams" ? selection.color : null;
      return {
        source, label, checked,
        imageUrl: null,
        hex: color ? normalizeHex(color.hex) : null,
        caption: color ? `${color.label || color.code} · ${color.hex}` : "No Sherwin-Williams color confirmed",
        selection: selection ?? null,
        checkable: Boolean(selection),
        filled: Boolean(color),
      };
    }

    const fromStored = stored?.source === "hex" ? stored : null;
    const fromRow = fromStored ? null : hexSelection(rowFor(listing, source)?.value, now);
    const selection = fromStored ?? fromRow;
    const hex = selection?.source === "hex" ? selection.hex : null;
    return {
      source, label, checked,
      imageUrl: null,
      hex: hex ? normalizeHex(hex) : null,
      caption: hex ? hex : "No hex color confirmed",
      selection: selection ?? null,
      checkable: Boolean(selection),
      filled: Boolean(hex),
    };
  });
}

/**
 * What the live preview paints for the checked slot. Photo slots paint their
 * picture on the door; color slots paint the exact hex with no photo.
 */
export type FourSlotPaint =
  | { kind: "photo"; url: string | null }
  | { kind: "hex"; hex: string };

export function paintForSlot(slot: FourSlot | undefined): FourSlotPaint {
  if (!slot) return { kind: "photo", url: null };
  if ((slot.source === "hex" || slot.source === "sherwin-williams") && slot.hex) return { kind: "hex", hex: slot.hex };
  return { kind: "photo", url: slot.imageUrl };
}

/** True when the backend answered that the sources table exists. */
export function listingIsAvailable(listing: DoorColorSourcesListing): boolean {
  return Boolean(listing?.available);
}
