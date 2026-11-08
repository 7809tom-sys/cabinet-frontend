/**
 * The sink's place in a run, and the basin's place on its own base.
 *
 * Two owner rules live here, and both are decided from the finished plan rather
 * than guessed at pick time:
 *
 *  1. LANDING. A sink base is never the last floor box at the end of a run that
 *     butts a tall cabinet (pantry, oven tower) or a refrigerator. At least one
 *     real base cabinet stands between the basin and that tall unit, so there is
 *     counter to land on beside the sink. The build slides the sink base — never
 *     the tall unit — by the smallest amount that opens the landing, and when no
 *     slide can do it the tall pick is reported instead of being seated against
 *     the sink.
 *
 *  2. SEAT. The basin is centered on the sink base it belongs to and sits
 *     2"–2½" back from the finished countertop front edge. `design.ts` already
 *     builds that geometry (`nonApronSinkDeckPlacement`); this module is the one
 *     predicate the build uses to check the finished fixtures.
 */
import {
  COLLISION_EPSILON_IN,
  NON_APRON_SINK_FRONT_SETBACK,
  cabinetPlacementCollisionDetail,
  cabinetWall,
  isRefrigerator,
  placedFootprint,
  isSinkBaseCabinet,
  wallRunFrame,
  wallRunOffset,
  wallRunSpan,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
} from "./design";
import { kitchenRuleNumber } from "./kitchenRuleParameters";

/** The landing a sink base keeps between itself and a tall unit, in inches. */
export function sinkTallLandingIn(): number {
  return Math.max(0, kitchenRuleNumber("sink_tall_landing_in"));
}

/** The approved front setback, clamped to the 2"–2½" range the model allows. */
export function sinkFrontSetbackIn(): number {
  const value = kitchenRuleNumber("sink_front_setback_in");
  if (!Number.isFinite(value)) return NON_APRON_SINK_FRONT_SETBACK.defaultIn;
  return Math.min(NON_APRON_SINK_FRONT_SETBACK.maximumIn, Math.max(NON_APRON_SINK_FRONT_SETBACK.minimumIn, value));
}

/** A full-height floor box the sink needs counter between itself and. */
export function isSinkLandingBlocker(item: PlacedCabinet): boolean {
  if (isRefrigerator(item)) return true;
  if (item.placement !== "tall") return false;
  return !/filler|panel|skin|moulding|molding|crown|valance|sample|touch.?up/i.test(
    `${item.masterCode} ${item.description ?? ""} ${item.subCategory ?? ""}`,
  );
}

export type SinkLandingGap = {
  /** The sink base that is jammed. */
  sinkUid: string;
  sinkCode: string;
  /** The tall unit or refrigerator it is jammed against. */
  blockerUid: string;
  blockerCode: string;
  wallId: string;
  /** Clear inches between the sink base and that blocker; negative means they overlap. */
  gapIn: number;
  /** Which side of the sink base the blocker stands on, along the run. */
  side: "start" | "end";
};

/**
 * Every tall unit or refrigerator standing against a sink base on the same run
 * with less than the required landing between them. Empty means every sink base
 * in the plan keeps its landing.
 */
export function sinkLandingGaps(
  placed: readonly PlacedCabinet[],
  room: RoomData,
  landingIn = sinkTallLandingIn(),
): SinkLandingGap[] {
  const gaps: SinkLandingGap[] = [];
  for (const sink of placed.filter((item) => isSinkBaseCabinet(item))) {
    const wall = cabinetWall(sink, room);
    if (!wall) continue;
    const start = wallRunOffset(sink, wall, room);
    const end = start + wallRunSpan(sink, wall, room);
    for (const other of placed) {
      if (other.uid === sink.uid) continue;
      if (!isSinkLandingBlocker(other)) continue;
      if (cabinetWall(other, room) !== wall) continue;
      const otherStart = wallRunOffset(other, wall, room);
      const otherEnd = otherStart + wallRunSpan(other, wall, room);
      // The blocker stands clear of the sink base: on one side of it or the other.
      const afterSink = otherStart >= end - COLLISION_EPSILON_IN;
      if (!afterSink && otherEnd > start + COLLISION_EPSILON_IN) continue;
      const gap = afterSink ? otherStart - end : start - otherEnd;
      if (gap + COLLISION_EPSILON_IN >= landingIn) continue;
      gaps.push({
        sinkUid: sink.uid,
        sinkCode: sink.masterCode,
        blockerUid: other.uid,
        blockerCode: other.masterCode,
        wallId: wall,
        gapIn: Math.round(gap * 1000) / 1000,
        side: afterSink ? "end" : "start",
      });
    }
  }
  return gaps;
}

export type SinkSlideOption = {
  /** Inches to move the sink base along the run; positive runs toward the wall end. */
  deltaIn: number;
  /** The new along-run start of the sink base. */
  startIn: number;
  /** The smallest landing the slide leaves, in inches. */
  landingIn: number;
};

/**
 * The slides that would open the landing for one sink base, cheapest first.
 *
 * A sink base is a measured anchor: it may move within `sink_shift_limit_in` and
 * no further. A slide is offered only when the whole base still fits its run and
 * collides with nothing already on the plan, so a "fix" can never create a
 * second defect.
 */
export function planSinkLandingSlides(input: {
  sink: PlacedCabinet;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  /** Largest legal slide, normally the sink shift cap. */
  limitIn?: number;
  landingIn?: number;
}): SinkSlideOption[] {
  const { sink, room } = input;
  const wall = cabinetWall(sink, room);
  if (!wall) return [];
  const frame = wallRunFrame(wall, room);
  if (!frame) return [];
  const landingIn = input.landingIn ?? sinkTallLandingIn();
  const limit = Math.max(0, input.limitIn ?? kitchenRuleNumber("sink_shift_limit_in"));
  if (limit <= 0) return [];
  const start = wallRunOffset(sink, wall, room);
  const span = wallRunSpan(sink, wall, room);
  const others = input.placed.filter((item) => item.uid !== sink.uid);
  const step = 1 / 8;
  const steps = Math.max(1, Math.round(limit / step));
  const options: SinkSlideOption[] = [];
  const seen = new Set<number>();
  for (let index = 1; index <= steps; index += 1) {
    for (const delta of [index * step, -index * step]) {
      const nextStart = Math.round((start + delta) * 8) / 8;
      if (seen.has(nextStart)) continue;
      seen.add(nextStart);
      if (nextStart < frame.runStart - COLLISION_EPSILON_IN) continue;
      if (nextStart + span > frame.runEnd + COLLISION_EPSILON_IN) continue;
      const moved = { ...sink, wallOffset: nextStart };
      if (cabinetPlacementCollisionDetail(moved, others, room)) continue;
      const gaps = sinkLandingGaps([moved, ...others], room, landingIn);
      if (gaps.length > 0) continue;
      options.push({
        deltaIn: Math.round((nextStart - start) * 8) / 8,
        startIn: nextStart,
        landingIn,
      });
    }
  }
  return options.sort((left, right) => Math.abs(left.deltaIn) - Math.abs(right.deltaIn));
}

export type SinkSeatCheck = {
  ok: boolean;
  /** Along-run offset of the basin's center from the base's center. */
  centerOffsetIn: number;
  /** Front setback the fixture records. */
  setbackIn: number | null;
  /** True when the basin belongs to this sink base at all. */
  owned: boolean;
  reason: string | null;
};

/**
 * True when a sink fixture is seated the way the owner requires: centered on the
 * sink base that owns it, and 2"–2½" back from the finished countertop front.
 * An apron-front farmhouse sink is flush with the cabinet front by design, so
 * the setback check does not apply to it.
 */
export function sinkSeatCheck(sink: SinkFixture, base: PlacedCabinet, room: RoomData): SinkSeatCheck {
  const owned = sink.cabinetUid === base.uid;
  const setbackIn = sink.frontSetbackIn ?? null;
  if (!owned) {
    return { ok: false, centerOffsetIn: Number.NaN, setbackIn, owned, reason: `${sink.uid} does not belong to ${base.masterCode}.` };
  }
  if (sink.apronFront || sink.type === "farmhouse") {
    return { ok: true, centerOffsetIn: 0, setbackIn, owned, reason: null };
  }
  const wall = cabinetWall(base, room);
  const alongRun = wall === "left" || wall === "right";
  // The plan footprint of a base on a side wall is rotated: the run axis is y.
  const foot = placedFootprint(base);
  const baseCenter = alongRun ? base.y + foot.d / 2 : base.x + foot.w / 2;
  const sinkCenter = alongRun ? sink.y + sink.depth / 2 : sink.x + sink.width / 2;
  const centerOffsetIn = Math.round((sinkCenter - baseCenter) * 1000) / 1000;
  if (Math.abs(centerOffsetIn) > 0.01) {
    return { ok: false, centerOffsetIn, setbackIn, owned, reason: `${sink.uid} is ${centerOffsetIn}″ off the center of ${base.masterCode}.` };
  }
  if (setbackIn == null) return { ok: true, centerOffsetIn, setbackIn, owned, reason: null };
  const outside = setbackIn < NON_APRON_SINK_FRONT_SETBACK.minimumIn - COLLISION_EPSILON_IN
    || setbackIn > NON_APRON_SINK_FRONT_SETBACK.maximumIn + COLLISION_EPSILON_IN;
  return {
    ok: !outside,
    centerOffsetIn,
    setbackIn,
    owned,
    reason: outside
      ? `${sink.uid} sits ${setbackIn}″ back from the countertop front; the approved range is ${NON_APRON_SINK_FRONT_SETBACK.minimumIn}″–${NON_APRON_SINK_FRONT_SETBACK.maximumIn}″.`
      : null,
  };
}
