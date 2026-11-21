import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApprovedDoorStyleChips } from "./ApprovedDoorStyleChips";

describe("ApprovedDoorStyleChips", () => {
  it("offers DL Shaker first as the default, then the other approved styles", () => {
    const html = renderToStaticMarkup(<ApprovedDoorStyleChips value="" onPick={() => {}} />);
    const order = ["Shaker", "Raised Panel", "Slim Shaker", "Slab"].map((v) => html.indexOf(`data-door-style="${v}"`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("DL Shaker (default)");
    expect(html).toContain("The platform starter is DL Shaker");
  });

  it("marks a saved style as selected and drops the blank hint", () => {
    const html = renderToStaticMarkup(<ApprovedDoorStyleChips value="Raised Panel" onPick={() => {}} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*data-door-style="Raised Panel"|data-door-style="Raised Panel"[^>]*aria-pressed="true"/);
    expect(html).not.toContain("No door style saved");
  });
});
