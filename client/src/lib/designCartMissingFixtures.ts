import { fixtureBelongsToCabinet, isSinkBaseCabinet, type PlacedCabinet, type SinkFixture } from "./design";
import { isAutoFilledFaucet } from "./autoDesignFaucet";
import { surfaceRole } from "./pelican";
import { sinkFamilyForBase } from "./sinkBaseSelection";

/**
 * Owner rule (Tom, Nov 23 2026): a customer designing a kitchen chooses the sink,
 * the faucet and the countertop from the catalog, and those go in the cart.
 *
 * The Designer draws a stand-in bowl, a filled-in faucet and a colour-only
 * countertop so the room looks finished, but none of those is a chosen product,
 * so none of them is billed (a filled-in faucet is never billed). This lists what
 * the customer still has to choose before those three can reach the cart.
 *
 * Appliances (range, fridge, dishwasher, microwave, ...) are designer-only and are
 * never listed. A sink base used for a range top is not asked for a sink.
 * Bathrooms and vanity sink bases keep their own checklist and are not listed here.
 */
export type MissingCartFixtureKind = "sink" | "faucet" | "countertop";

export type MissingCartFixture = {
  kind: MissingCartFixtureKind;
  /** Sink base (or other cabinet) the missing sink or faucet belongs to. */
  cabinetUid?: string | null;
  /** Placed sink whose faucet is not chosen. */
  sinkUid?: string | null;
};

type SelectedInput = { id: number; category?: string | null; subCategory?: string | null; name?: string | null };

const RANGE_TOP_TYPES = new Set(["gas", "electric", "induction", "smooth-top"]);

function isApplianceCabinet(cabinet: { placement?: string | null }): boolean {
  return cabinet.placement === "appliance";
}

function sinkWasChosen(sink: SinkFixture, selected: readonly SelectedInput[]): boolean {
  const id = sink.pelicanProductId;
  if (id == null) return false;
  return selected.some((surface) => surface.id === id);
}

function faucetWasChosen(sink: SinkFixture, selected: readonly SelectedInput[]): boolean {
  const id = sink.pelicanFaucetProductId;
  if (id == null || isAutoFilledFaucet(sink)) return false;
  return selected.some((surface) => surface.id === id);
}

export function designCartMissingFixtures(input: {
  roomType?: string | null;
  placed: readonly PlacedCabinet[];
  sinks: readonly SinkFixture[];
  selectedSurfaces: readonly SelectedInput[];
  /** True when the countertop is turned on in the design. */
  countertopOn: boolean;
}): MissingCartFixture[] {
  if (input.roomType === "bathroom") return [];
  const missing: MissingCartFixture[] = [];
  const cabinets = input.placed;
  const ownerOf = (sink: SinkFixture) =>
    cabinets.find((cabinet) => sink.cabinetUid === cabinet.uid)
    ?? cabinets.find((cabinet) => !isApplianceCabinet(cabinet) && fixtureBelongsToCabinet(sink, cabinet))
    ?? null;
  const isVanity = (cabinet: PlacedCabinet | null) => cabinet != null && sinkFamilyForBase(cabinet, input.roomType) === "vanity";

  for (const cabinet of cabinets) {
    if (isApplianceCabinet(cabinet) || cabinet.placement !== "base") continue;
    if (!isSinkBaseCabinet(cabinet) || isVanity(cabinet)) continue;
    if (cabinet.sinkTopType && RANGE_TOP_TYPES.has(cabinet.sinkTopType)) continue;
    const own = input.sinks.filter((sink) => fixtureBelongsToCabinet(sink, cabinet));
    if (!own.some((sink) => sinkWasChosen(sink, input.selectedSurfaces))) {
      missing.push({ kind: "sink", cabinetUid: cabinet.uid, sinkUid: own[0]?.uid ?? null });
    }
  }

  for (const sink of input.sinks) {
    const owner = ownerOf(sink);
    if (owner && (isApplianceCabinet(owner) || isVanity(owner))) continue;
    if (owner?.sinkTopType && RANGE_TOP_TYPES.has(owner.sinkTopType)) continue;
    if (!faucetWasChosen(sink, input.selectedSurfaces)) {
      missing.push({ kind: "faucet", cabinetUid: owner?.uid ?? sink.cabinetUid ?? null, sinkUid: sink.uid });
    }
  }

  if (input.countertopOn && !input.selectedSurfaces.some((surface) => surfaceRole(surface) === "countertop")) {
    missing.push({ kind: "countertop" });
  }
  return missing;
}

const ORDER: MissingCartFixtureKind[] = ["sink", "faucet", "countertop"];

/** The missing kinds, once each, in sink · faucet · countertop order. */
export function missingCartFixtureKinds(missing: readonly MissingCartFixture[]): MissingCartFixtureKind[] {
  return ORDER.filter((kind) => missing.some((item) => item.kind === kind));
}

/** "Not in cart yet: sink · faucet · countertop" with only the missing words, or null. */
export function missingCartFixturesLabel(missing: readonly MissingCartFixture[]): string | null {
  const kinds = missingCartFixtureKinds(missing);
  return kinds.length > 0 ? `Not in cart yet: ${kinds.join(" · ")}` : null;
}
