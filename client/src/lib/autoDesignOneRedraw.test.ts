import { describe, expect, it, vi } from "vitest";
import { AutoDesignRedrawGuard, autoDesignStepFailureText, runWithOneRetry } from "./autoDesignOneRedraw";

describe("one-redraw rule (Tom, Nov 16 2026, 12:19 PM CT)", () => {
  it("a placement throw is retried exactly once, then returns a visible error state", () => {
    const fn = vi.fn(() => { throw new Error("collision solver blew up"); });
    const result = runWithOneRetry("layout run", fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toEqual({ step: "layout run", message: "collision solver blew up", attempts: 2 });
    expect(autoDesignStepFailureText(result.failure)).toMatch(/layout run step.*collision solver blew up/);
  });

  it("a placement that fails once and then succeeds uses the one retry", () => {
    let calls = 0;
    const result = runWithOneRetry("layout run", () => { calls += 1; if (calls === 1) throw new Error("once"); return "plan"; });
    expect(result).toEqual({ ok: true, value: "plan", attempts: 2 });
  });

  it("a post-build effect that keeps throwing stops after one retry and reports once", () => {
    const onStop = vi.fn();
    const guard = new AutoDesignRedrawGuard(onStop);
    guard.beginBuild();
    const body = vi.fn(() => { throw new Error("panel sync failed"); });
    for (let render = 0; render < 50; render += 1) guard.run("dishwasher panel sync", body);
    expect(body).toHaveBeenCalledTimes(2);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStop.mock.calls[0]![0]).toMatchObject({ step: "dishwasher panel sync", message: "panel sync failed" });
  });

  it("an effect re-fired by its own write redraws once, then is stopped instead of looping", () => {
    const onStop = vi.fn();
    const guard = new AutoDesignRedrawGuard(onStop);
    guard.beginBuild();
    let plan: object = { v: 0 };
    let writes = 0;
    // A pass that never settles: every run returns a new plan from the one it just wrote.
    for (let render = 0; render < 50; render += 1) {
      const next = { v: render + 1 };
      if (!guard.allowWrite("over-range fill", plan, next)) continue;
      plan = next;
      writes += 1;
    }
    expect(writes).toBe(2);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(guard.stopped("over-range fill")?.message).toMatch(/kept redrawing/);
  });

  it("only a new user-started build resets the counter", () => {
    const guard = new AutoDesignRedrawGuard();
    const first = guard.beginBuild();
    guard.run("clearance fillers", () => { throw new Error("x"); });
    guard.run("clearance fillers", () => { throw new Error("x"); });
    expect(guard.canRun("clearance fillers")).toBe(false);
    expect(guard.beginBuild()).toBe(first + 1);
    expect(guard.canRun("clearance fillers")).toBe(true);
  });

  it("writes on unrelated input (a user edit) are not counted as redraws", () => {
    const guard = new AutoDesignRedrawGuard();
    guard.beginBuild();
    for (let edit = 0; edit < 10; edit += 1) expect(guard.allowWrite("panel sync", { edit }, { out: edit })).toBe(true);
  });
});
