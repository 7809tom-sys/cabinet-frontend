/**
 * Owner report (Nov 8 2026): in the 2D plan a 3" filler beside a range showed
 * the ordinary arrow cursor and could not be selected, so it could not be
 * deleted.
 *
 * Two separate causes, both in PlanCanvas:
 *
 *   1. The drawn board WAS the pointer target. At a fitted zoom a 3" filler is
 *      a few pixels wide — narrower than a mouse can reliably hit — so the
 *      pointer landed on the room behind it.
 *   2. The wall band along each wall was a 14 px interactive strip at z-[5],
 *      which is above placed items. A filler butted against the wall lost its
 *      back edge to the wall, and the wall's own handler ran instead.
 *
 * These tests pin the geometry and the layers: every drawn board gets a target
 * at least PLAN_ITEM_MIN_HIT_PX across without changing its drawn size, and no
 * overlay above a placed item can swallow its pointer.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_ITEM_MIN_HIT_PX, planItemHitFrame } from "./PlanCanvas";

const source = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");

/** A 3" wide, 24" deep filler body starting at a wall. */
const body = { left: 60, top: 0, width: 3, height: 24 };

describe("planItemHitFrame", () => {
  it("widens a thin item to the minimum pointer target and keeps it centred", () => {
    const ppi = 4; // a fitted plan in a small canvas
    const { frame, padX } = planItemHitFrame(body, ppi, true);
    expect(frame.width * ppi).toBeCloseTo(PLAN_ITEM_MIN_HIT_PX, 5);
    // Centred on the drawn board: equal padding on both sides.
    expect(frame.left + padX).toBeCloseTo(body.left, 5);
    expect(body.left - frame.left).toBeCloseTo(padX, 5);
    // The depth is already wider than the minimum, so it is untouched.
    expect(frame.height).toBeCloseTo(body.height, 5);
  });

  it("never shrinks an item that is already wider than the minimum", () => {
    const wide = { left: 10, top: 0, width: 30, height: 24 };
    const { frame, padX, padY } = planItemHitFrame(wide, 4, true);
    expect(frame).toEqual(wide);
    expect(padX).toBe(0);
    expect(padY).toBe(0);
  });

  it("leaves an ordinary cabinet's body as its own target", () => {
    const cabinet = { left: 10, top: 0, width: 24, height: 24 };
    expect(planItemHitFrame(cabinet, 1.5, false)).toEqual({ frame: cabinet, padX: 0, padY: 0 });
  });

  it("scales with the plan zoom, so the target is never under 12 px", () => {
    for (const ppi of [1.5, 2, 4, 8, 12, 20]) {
      const { frame } = planItemHitFrame(body, ppi, true);
      const drawnPx = body.width * ppi;
      // A target may be larger because the board itself already is; never smaller.
      expect(frame.width * ppi).toBeGreaterThanOrEqual(PLAN_ITEM_MIN_HIT_PX - 0.001);
      expect(frame.width * ppi).toBeGreaterThanOrEqual(drawnPx - 0.001);
      if (drawnPx < PLAN_ITEM_MIN_HIT_PX) {
        expect(Math.round(frame.width * ppi)).toBe(PLAN_ITEM_MIN_HIT_PX);
      }
    }
  });

  it("keeps the drawn size identical to the body it was given", () => {
    // The frame only describes the target; the drawn body keeps `body` verbatim,
    // which is what PlanCanvas draws inside the target.
    expect(source).toContain("const hitTarget = planItemHitFrame(bodyFrame, ppi");
    expect(source).toContain("left: (bodyFrame.left - hitTarget.frame.left) * ppi,");
    expect(source).toContain("width: bodyFrame.width * ppi,");
  });
});

describe("nothing above a placed item swallows its pointer", () => {
  it("puts the drawn body inside an interactive target, with the body inert", () => {
    expect(source).toContain('data-plan-item-body="true"');
    expect(source).toContain("pointer-events-none absolute transition-[box-shadow,border-color]");
    // The outer target is what selects, drags, and opens the item menu.
    expect(source).toContain("onPointerDown={(e) => handlePointerDown(e, p)}");
    expect(source).toContain("setPlanItemMenu({ x: e.clientX, y: e.clientY, uid: p.uid");
    expect(source).toContain("onRemove={onDelete}");
  });

  it("keeps the wall band's highlight above items but its pointer target beneath them", () => {
    const visual = source.indexOf('data-testid="wall-band-visual"');
    const band = source.indexOf('data-testid="wall-band"');
    expect(visual).toBeGreaterThan(-1);
    expect(band).toBeGreaterThan(visual);
    // The highlight is painted above items and never takes a pointer.
    const visualBlock = source.slice(visual - 400, band);
    expect(visualBlock).toContain("pointer-events-none");
    expect(visualBlock).toContain("z-[5]");
    // The clickable strip sits beneath placed items, so a filler against the
    // wall keeps its back edge.
    const bandBlock = source.slice(band, band + 900);
    expect(bandBlock).toContain('className="absolute z-[1]');
  });

  it("makes the filler measurement banner part of the clickable target", () => {
    // The banner sits above the board. It used to pass a click straight through
    // to the room, so the visible label behaved like empty space.
    for (const testId of ["bbc-filler-measurement-label", "measured-filler-measurement-label"]) {
      const at = source.indexOf(`data-testid="${testId}"`);
      expect(at).toBeGreaterThan(-1);
      const block = source.slice(at, at + 900);
      expect(block).toContain("pointer-events-auto");
      expect(block).toContain("cursor-move");
    }
  });
});
