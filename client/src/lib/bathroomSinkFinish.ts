/**
 * A bathroom vanity never gets a kitchen sink.
 *
 * Owner report (Nov 8 2026), with a screenshot: a navy vanity with a white top
 * held a rectangular brushed STAINLESS STEEL kitchen sink with a metal rim and
 * basket drain, beside a toilet. "stainless sinks are for the kitchen."
 *
 * Where it came from. A vanity sink base is seeded with a sink before the
 * shopper picks one, so the base is never empty. That seeded basin carries no
 * catalog product and therefore no `surfaceFinish`, and the 3D sink renderer
 * treated a missing finish as stainless:
 *
 *     const isVitreousChina = sink.surfaceFinish?.startsWith("vitreous-china")
 *     const steel = isVitreousChina ? vitreousChina : isGunmetalBlack
 *                   ? gunmetalSteel : stainlessSteel;
 *
 * So every defaulted vanity sink — Auto Design, the seeded basin on a placed
 * vanity base, and any saved plan still holding an unprofiled vanity sink —
 * drew as a kitchen stainless sink. The finish was only ever set from a
 * *verified* Pelican profile, and the default basin has none.
 *
 * The rule below is the single place that decides this, so the seed, the
 * picker, Auto Design and the renderer cannot drift apart again:
 *
 *   - a bathroom vanity basin is porcelain (vitreous china) unless its own
 *     verified profile says otherwise;
 *   - a stainless/kitchen sink may never resolve onto a vanity base;
 *   - the fallback basin is the source-measured porcelain vanity basin, not an
 *     unprofiled placeholder.
 */
import type { SinkFamily } from "./sinkBaseSelection";

export type SinkSurfaceFinish =
  | "stainless-steel"
  | "gunmetal-black"
  | "vitreous-china"
  | "vitreous-china-black"
  | "vitreous-china-bone"
  | "vitreous-china-grey";

/** Anything that is a kitchen sink rather than a bathroom basin. */
export function isKitchenSinkFinish(finish: string | null | undefined): boolean {
  const value = (finish ?? "").trim().toLowerCase();
  // No finish recorded is the unprofiled default basin. It is porcelain on a
  // vanity and stainless in a kitchen, so callers must use `sinkFinishForFamily`
  // rather than reading this as "stainless".
  if (!value) return false;
  return value === "stainless-steel" || value === "stainless" || value.includes("stainless");
}

/** Porcelain is the bathroom default; stainless is the kitchen default. */
export function sinkFinishForFamily(family: SinkFamily): SinkSurfaceFinish {
  return family === "vanity" ? "vitreous-china" : "stainless-steel";
}

/**
 * The finish a sink must draw with on this family.
 *
 * A vanity basin keeps its own recorded finish when that finish is porcelain
 * (a black, bone or grey bathroom basin is legitimate). A stainless record on a
 * vanity is refused and replaced with porcelain, because it is either a
 * mis-seeded default or a saved design from before this rule.
 */
export function resolveSinkFinish(
  recorded: string | null | undefined,
  family: SinkFamily,
): SinkSurfaceFinish {
  const value = (recorded ?? "").trim().toLowerCase();
  const isPorcelain = value.startsWith("vitreous-china");
  if (family === "vanity") {
    if (isPorcelain) return value as SinkSurfaceFinish;
    // Covers no finish at all and any stainless/gunmetal record.
    return "vitreous-china";
  }
  if (isPorcelain) return value as SinkSurfaceFinish;
  if (value === "gunmetal-black") return "gunmetal-black";
  return "stainless-steel";
}

/**
 * True when this sink fixture is a kitchen sink sitting on a vanity base.
 * Used to catch a saved plan or a stale pick that predates the rule.
 */
export function vanitySinkLooksLikeKitchenSink(
  sink: { surfaceFinish?: string | null; apronFront?: boolean; type?: string | null },
  family: SinkFamily,
): boolean {
  if (family !== "vanity") return false;
  if (sink.apronFront === true || sink.type === "farmhouse") return true;
  return isKitchenSinkFinish(sink.surfaceFinish);
}

/** The porcelain vanity basin the Designer seeds when nothing is chosen. */
export const DEFAULT_VANITY_BASIN_SKU = "PL-3099 White";

/**
 * Repairs sinks in a loaded plan.
 *
 * A design saved before this rule can hold a vanity basin with no recorded
 * finish (the seeded default) or, if it was picked from a stale list, a kitchen
 * stainless basin. Neither may survive a load: the first drew as stainless, the
 * second is simply wrong. The repair changes ONLY the finish and the vanity
 * marker — position, size, setback, faucet and product ids are all preserved, so
 * the sink stays exactly where the customer left it.
 */
export function repairVanitySinkFinishes<
  T extends {
    cabinetUid?: string | null;
    surfaceFinish?: string | null;
    bathroomVanitySink?: boolean;
    apronFront?: boolean;
    type?: string | null;
  },
>(
  sinks: readonly T[],
  vanityCabinetUids: ReadonlySet<string>,
): { sinks: T[]; repairedCount: number } {
  let repairedCount = 0;
  const next = sinks.map((sink) => {
    if (!sink.cabinetUid || !vanityCabinetUids.has(sink.cabinetUid)) return sink;
    const already = sink.bathroomVanitySink === true;
    const kitchenShaped = sink.apronFront === true || sink.type === "farmhouse" || isKitchenSinkFinish(sink.surfaceFinish);
    const missingFinish = !sink.surfaceFinish;
    if (already && !kitchenShaped && !missingFinish) return sink;
    const fixed: T = {
      ...sink,
      surfaceFinish: resolveSinkFinish(kitchenShaped || missingFinish ? undefined : sink.surfaceFinish, "vanity"),
      bathroomVanitySink: true,
    };
    if (kitchenShaped) {
      // A farmhouse apron in a bathroom was never a bathroom basin either.
      fixed.apronFront = false;
      fixed.type = "single";
    }
    repairedCount += 1;
    return fixed;
  });
  return { sinks: repairedCount > 0 ? next : (sinks as T[]), repairedCount };
}
