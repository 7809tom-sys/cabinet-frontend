// @vitest-environment jsdom
/**
 * Tom (owner voice, Nov 24 2026):
 * - 12:27 PM CT: choosing Wall 2 places the range and the sink on Wall 2, centered,
 *   and the customer can then readjust them.
 * - 12:28 PM CT: a 36 in sink base is offered only when it qualifies; when it does,
 *   smaller sink bases are not offered; otherwise the largest that fits is used.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROOM } from "@/lib/design";
import type { AutoDesignInputs } from "@/lib/autoDesignAutoBuild";
import { AutoDesignDialog } from "./AutoDesignDialog";

afterEach(cleanup);

const proto = HTMLElement.prototype as any;
proto.setPointerCapture ??= () => {};
proto.releasePointerCapture ??= () => {};
proto.hasPointerCapture ??= () => false;
proto.scrollIntoView ??= () => undefined;

const centerInput = (label: string) => screen.getByLabelText(`${label} center from selected wall start in inches`) as HTMLInputElement;
const pick = (trigger: string, option: string | RegExp) => {
  fireEvent.click(screen.getByLabelText(trigger));
  fireEvent.click(screen.getByRole("option", { name: option }));
};
const BIG_ROOM = { width: 180, depth: 200, ceilingHeight: 96 };

function renderDialog(room = DEFAULT_ROOM) {
  const onBuild = vi.fn((_input: AutoDesignInputs): { ok: true } => ({ ok: true }));
  render(<AutoDesignDialog open onOpenChange={vi.fn()} onBuild={onBuild} room={room} wallCount={4} />);
  return onBuild;
}

describe("Wall 2 places the range and sink, centered", () => {
  it("choosing Wall 2 for the sink moves the sink and the range onto Wall 2 as a centered pair", () => {
    renderDialog(BIG_ROOM);
    pick("Layout type", "L-shape");
    // The L-shape starting centers may already use Wall 2; choose Wall 1 first so the
    // Wall 2 choice is a real change (a Select ignores re-picking its current value).
    pick("Sink base — place on wall", /^Wall 1/);
    pick("Sink base — place on wall", /^Wall 2/);
    // Wall 2 = 200 in; 45 in kept for the corner cabinet -> usable 45-200.
    // SB36 + DW (right) + 18 in landing + 30 in range = 108 in, centered from 68.5.
    expect(centerInput("Sink base").value).toBe("86.5");
    expect(centerInput("Range / stove").value).toBe("161.5");
    expect(screen.getByLabelText("Range / stove — place on wall").textContent).toMatch(/Wall 2/);
  });

  it("choosing Wall 2 for the range does the same, and the centers stay editable", () => {
    const onBuild = renderDialog(BIG_ROOM);
    pick("Layout type", "L-shape");
    pick("Range / stove — place on wall", /^Wall 2/);
    expect(centerInput("Sink base").value).toBe("86.5");
    expect(centerInput("Range / stove").value).toBe("161.5");
    fireEvent.change(centerInput("Range / stove"), { target: { value: "170" } });
    expect(centerInput("Range / stove").value).toBe("170");
    fireEvent.click(screen.getByTestId("intake-construction-new"));
    fireEvent.click(screen.getByTestId("auto-design-build-submit"));
    const input = onBuild.mock.calls.at(-1)![0] as AutoDesignInputs;
    expect(input.sink).toEqual({ wallLabel: "Wall 2", centerOffsetIn: 86.5 });
    expect(input.stove).toEqual({ wallLabel: "Wall 2", centerOffsetIn: 170 });
  });

  it("other walls keep their behavior: only the chosen item moves", () => {
    renderDialog(BIG_ROOM);
    pick("Layout type", "L-shape");
    const sinkBefore = centerInput("Sink base").value;
    pick("Range / stove — place on wall", /^Wall 1/);
    expect(centerInput("Sink base").value).toBe(sinkBefore);
  });
});

describe("36 in sink base qualification", () => {
  it("when 36 qualifies, smaller sink bases are not offered", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText("Sink base size"));
    expect(screen.queryByRole("option", { name: "SB30 · 30″" })).toBeNull();
    expect(screen.queryByRole("option", { name: "SB33 · 33″" })).toBeNull();
    expect(screen.getByRole("option", { name: "SB36 · 36″" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "SB42 · 42″" })).toBeTruthy();
  });

  it("when 36 does not fit at the sink spot, it is disabled with a reason and the largest fit is chosen", () => {
    renderDialog();
    // Single wall, sink typed 16 in from the wall start with the dishwasher to its right.
    fireEvent.change(centerInput("Sink base"), { target: { value: "16" } });
    expect(screen.getByTestId("auto-design-sink-base-36-reason").textContent).toMatch(/SB36 needs 60 in with the dishwasher/);
    expect(screen.getByLabelText("Sink base size").textContent).toContain("SB30");
    fireEvent.click(screen.getByLabelText("Sink base size"));
    expect(screen.getByRole("option", { name: "SB36 · 36″" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("option", { name: "SB30 · 30″" }).getAttribute("aria-disabled")).not.toBe("true");
  });
});
